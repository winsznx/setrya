import { getDb, schema, eq, and, isNull } from '@setrya/db';
import { hashCanonical, type FrozenSnapshot } from '@setrya/domain';
import { randomBytes, randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { audit } from './audit';
import { consumeStepUp } from './owner';
import { buildSnapshot, frozenSnapshot, type PeriodView, snapshotScope } from './periods';
import type { ProjectView } from './projects';
import type { UnlockedContext } from './session';
import { approvalTarget } from './step-up-scopes';
import { walletHealth } from './wallet';

export interface ApprovalCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

/** Each pre-approval condition reported on its own, never folded into one opaque badge. */
export async function approvalChecks(ctx: UnlockedContext, project: ProjectView, period: PeriodView) {
  const frozen = await frozenSnapshot(ctx, period.id);
  const { network, accountId } = approvalTarget();
  const checks: ApprovalCheck[] = [];
  let current: FrozenSnapshot | null = null;
  try {
    current = await buildSnapshot(ctx, project, period, network, accountId);
  } catch (error) {
    checks.push({ id: 'addresses', label: 'No payee address changed after review', pass: false, detail: error instanceof Error ? error.message : 'Snapshot could not be rebuilt' });
  }
  const health = await walletHealth({ minConf: project.minConfirmations });
  const total = BigInt(frozen?.totalZat ?? '0');
  const spendable = BigInt(health.balance?.spendableZat ?? '0');
  if (current) {
    const same = frozen !== null && hashCanonical(current) === period.frozenSnapshotHash;
    const changed = frozen === null ? [] : [
      frozen.accountId !== current.accountId ? `payer account (frozen ${frozen.accountId.slice(0, 8)}…, now ${current.accountId.slice(0, 8)}…)` : null,
      frozen.network !== current.network ? `network (frozen ${frozen.network}, now ${current.network})` : null,
      hashCanonical(frozen.payouts) !== hashCanonical(current.payouts) ? 'payout amounts, rates or addresses' : null,
      hashCanonical(frozen.held) !== hashCanonical(current.held) ? 'held rows' : null,
    ].filter(Boolean);
    checks.push({ id: 'snapshot', label: 'Frozen inputs unchanged', pass: same, detail: frozen === null ? 'No frozen snapshot' : same ? `Snapshot ${period.frozenSnapshotHash?.slice(0, 12)}… matches source rows, agreements, rates, addresses and payer account` : `Changed since freezing: ${changed.join('; ') || 'calculation inputs'}. Create a new revision.` });
    checks.push({ id: 'addresses', label: 'No payee address changed after review', pass: frozen !== null && current.payouts.every((p) => frozen.payouts.some((f) => f.payoutKey === p.payoutKey && f.addressVersionId === p.addressVersionId)), detail: 'Each payout uses the address version that was frozen' });
  }
  checks.push({ id: 'network', label: `Wallet is on ${network}`, pass: health.network.match, detail: health.network.detected === 'unknown' ? 'Network could not be confirmed from the wallet' : `Wallet reports ${health.network.detected}` });
  checks.push({ id: 'account', label: 'Payer account exists in the wallet', pass: health.account.found, detail: health.account.uuid ? `Account ${health.account.uuid.slice(0, 8)}…` : 'No payer account configured' });
  checks.push({ id: 'sync', label: 'Chain connection and wallet are in sync', pass: health.zebra.synced && health.zallet.synced, detail: health.zebra.blocks !== null ? `Chain at ${health.zebra.blocks} of ~${health.zebra.estimatedHeight ?? '?'}` : 'Chain connection not reachable' });
  checks.push({ id: 'funds', label: 'Enough confirmed shielded ZEC in one pool', pass: health.balance !== null && spendable > total, detail: health.balance ? `${spendable} zat spendable under FullPrivacy for ${total} zat of payouts, plus the network fee` : 'Balance unavailable' });
  checks.push({ id: 'privacy', label: 'FullPrivacy enforced, no transparent outputs', pass: true, detail: 'Fixed policy. Setrya has no setting that weakens it.' });
  checks.push({ id: 'capabilities', label: 'Wallet supports the PCZT path', pass: health.zallet.reachable && health.zallet.missingMethods.length === 0, detail: health.zallet.missingMethods.length ? `Missing: ${health.zallet.missingMethods.join(', ')}` : health.zallet.reachable ? 'pczt_create, inspect, prove, sign and extract available' : 'Wallet not reachable' });
  return { checks, frozen, health, scope: frozen ? snapshotScope(frozen) : null };
}

/**
 * Approval binds the frozen snapshot to the payer account and network with a one-time step-up. It creates payout
 * intents, splits them into batches, and issues statements. Nothing is signed or sent here.
 */
export async function approvePeriod(ctx: UnlockedContext, project: ProjectView, period: PeriodView, stepUpToken: string | undefined, confirmTotalZat: string): Promise<{ approvalId: string }> {
  if (period.status !== 'review') throw new ApiError('STALE_PERIOD_REVISION', 'Only a frozen period can be approved.');
  const { checks, frozen } = await approvalChecks(ctx, project, period);
  const failed = checks.filter((c) => !c.pass);
  if (!frozen || failed.length > 0) throw new ApiError(failed.some((c) => c.id === 'addresses') ? 'ADDRESS_CHANGED' : failed.some((c) => c.id === 'funds') ? 'INSUFFICIENT_SHIELDED_FUNDS' : 'WALLET_UNAVAILABLE', `Approval blocked: ${failed.map((c) => c.label).join('; ')}.`);
  if (confirmTotalZat !== frozen.totalZat) throw new ApiError('TRANSACTION_MISMATCH', 'The total you confirmed does not match the frozen total. Reload and review again.');
  await consumeStepUp(ctx.sessionId, stepUpToken, 'approve_period', { action: 'approve_period', ...snapshotScope(frozen) });

  const approvalId = randomUUID();
  await getDb().transaction(async (tx) => {
    const [locked] = await tx.update(schema.periods).set({ status: 'approved', approvedSnapshotId: approvalId, version: period.version + 1, updatedAt: new Date() }).where(and(eq(schema.periods.id, period.id), eq(schema.periods.status, 'review'), eq(schema.periods.revision, period.revision))).returning({ id: schema.periods.id });
    if (!locked) throw new ApiError('STALE_PERIOD_REVISION', 'The period changed. Reload.');
    await tx.insert(schema.approvals).values({ id: approvalId, periodId: period.id, revision: period.revision, snapshotHash: period.frozenSnapshotHash!, snapshotEnc: ctx.cipher.encJson('approvals', approvalId, 'snapshot', frozen), recipientsDigest: snapshotScope(frozen).recipientsDigest, approvedBy: ctx.ownerId, network: frozen.network, accountId: frozen.accountId, totalZat: BigInt(frozen.totalZat) });

    const rows = await tx.select({ id: schema.calculationRows.id, key: schema.calculationRows.rowKey }).from(schema.calculationRows).where(and(eq(schema.calculationRows.periodId, period.id), eq(schema.calculationRows.revision, period.revision)));
    const rowIds = new Map(rows.map((r) => [r.key, r.id]));
    const intents = frozen.payouts.map((p) => ({ id: randomUUID(), p }));
    const size = Math.max(1, project.maxRecipientsPerBatch);
    const chunks: (typeof intents)[] = [];
    for (let i = 0; i < intents.length; i += size) chunks.push(intents.slice(i, i + size));
    for (const [i, chunk] of chunks.entries()) {
      const batchId = randomUUID();
      await tx.insert(schema.paymentBatches).values({ id: batchId, approvalId, sequence: i + 1, of: chunks.length, network: frozen.network, payerAccountId: frozen.accountId, status: 'approved', totalZat: chunk.reduce((s, c) => s + BigInt(c.p.amountZat), 0n), idempotencyKey: `${approvalId}:${i + 1}` });
      for (const { id, p } of chunk) {
        await tx.insert(schema.payoutIntents).values({ id, approvalId, batchId, periodId: period.id, partnerId: p.partnerId, calculationRowId: rowIds.get(p.payoutKey)!, addressVersionId: p.addressVersionId, addressFingerprint: p.addressFingerprint, amountZat: BigInt(p.amountZat), memoRef: `STR-${randomBytes(4).toString('hex').toUpperCase()}`, state: 'approved', idempotencyKey: `${approvalId}:${p.payoutKey}` });
      }
    }

    const partnerIds = new Set([...frozen.payouts.map((p) => p.partnerId), ...frozen.held.map((h) => h.partnerId)]);
    for (const partnerId of partnerIds) {
      const intent = intents.find((x) => x.p.partnerId === partnerId);
      const statementId = randomUUID();
      const [existing] = await tx.select({ id: schema.statements.id, v: schema.statements.documentVersion }).from(schema.statements).where(and(eq(schema.statements.periodId, period.id), eq(schema.statements.partnerId, partnerId)));
      const snapshot = { approvalId, revision: period.revision, payouts: frozen.payouts.filter((p) => p.partnerId === partnerId), held: frozen.held.filter((h) => h.partnerId === partnerId) };
      if (existing) {
        await tx.update(schema.statements).set({ payoutIntentId: intent?.id ?? null, documentVersion: existing.v + 1, snapshotEnc: ctx.cipher.encJson('statements', existing.id, 'snapshot', snapshot), evidenceLevel: 'created', generatedAt: new Date() }).where(eq(schema.statements.id, existing.id));
      } else {
        await tx.insert(schema.statements).values({ id: statementId, projectId: project.id, periodId: period.id, partnerId, payoutIntentId: intent?.id ?? null, reference: `ST-${randomBytes(5).toString('hex').toUpperCase()}`, snapshotEnc: ctx.cipher.encJson('statements', statementId, 'snapshot', snapshot), evidenceLevel: 'created' });
      }
    }
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.approved', objectType: 'period', objectId: period.id, diff: { approvalId, revision: period.revision, snapshotHash: period.frozenSnapshotHash, payouts: intents.length, batches: chunks.length, totalZat: frozen.totalZat } }, tx);
  });
  return { approvalId };
}

export async function activeApproval(periodId: string, revision: number) {
  const [a] = await getDb().select().from(schema.approvals).where(and(eq(schema.approvals.periodId, periodId), eq(schema.approvals.revision, revision), isNull(schema.approvals.invalidatedAt)));
  return a ?? null;
}
