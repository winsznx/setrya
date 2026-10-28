import { addressFingerprint, zatToZecString } from '@setrya/domain';
import { and, eq, getDb, schema } from '@setrya/db';
import { log } from '@setrya/security';

import { walletAdapter } from '../services/wallet';

import type { SandboxOperator } from './client';
import { SandboxStepError } from './client';
import type { SandboxConfig } from './config';
import { newShareId, sealStatement } from './seal';

/** The stages a claim moves through, in order. The public page shows them as they happen. */
export const CLAIM_STAGES = ['queued', 'setting_up', 'approved', 'inspected', 'authorised', 'confirmed', 'ready'] as const;
export type ClaimState = (typeof CLAIM_STAGES)[number] | 'failed';

const JUDGE_SHARE_PCT = '20';
const HOUSE_SHARE_PCT = '10';
const CONFIRM_TIMEOUT_MS = 25 * 60_000;
const SHARE_DAYS = 30;

/** Share keys go back to the claimant only; a restart forgets them and the next status read seals a fresh link. */
const shareKeys = new Map<string, { shareId: string; key: string }>();

interface ClaimRow {
  id: string;
  address: string;
}

export class SandboxWorker {
  private readonly queue: ClaimRow[] = [];
  private running = false;

  constructor(
    private readonly operator: SandboxOperator,
    private readonly config: SandboxConfig,
  ) {}

  enqueue(claim: ClaimRow): void {
    this.queue.push(claim);
    void this.drain();
  }

  get queueLength(): number {
    return this.queue.length;
  }

  position(claimId: string): number | null {
    const i = this.queue.findIndex((c) => c.id === claimId);
    return i === -1 ? null : i + 1;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const claim = this.queue[0]!;
        try {
          await this.run(claim);
        } catch (error) {
          const message = error instanceof SandboxStepError ? error.message : 'The sandbox hit an unexpected error. Try again in a few minutes.';
          log('error', 'sandbox.claim_failed', { claimId: claim.id, code: error instanceof SandboxStepError ? error.code : 'INTERNAL', error });
          await setState(claim.id, 'failed', { error: message });
        } finally {
          this.queue.shift();
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async signedIn(): Promise<void> {
    const { email, password, vaultPassphrase } = this.config.owner;
    await this.operator.signIn(email, password, vaultPassphrase);
  }

  private async run(claim: ClaimRow): Promise<void> {
    const op = this.operator;
    const { password } = this.config.owner;
    await this.signedIn();
    await setState(claim.id, 'setting_up');

    const today = new Date().toISOString().slice(0, 10);
    const short = claim.id.slice(0, 8);
    const project = await op.call<{ id: string }>('POST', '/api/v1/projects', { orgName: 'Setrya sandbox', name: `Sandbox payout ${short}`, issuerLabel: 'Setrya sandbox', currency: 'ZEC', timezone: 'UTC' });
    const p = `/api/v1/projects/${project.id}`;
    await setState(claim.id, 'setting_up', { projectId: project.id });
    const source = await op.call<{ id: string }>('POST', `${p}/sources`, { name: 'Sandbox revenue', defaultCurrency: 'ZEC', feeType: 'realised_fee', timezone: 'UTC', kind: 'manual' });

    const houseAddress = process.env.SETRYA_SANDBOX_HOUSE_ADDRESS ?? (await ownAddress());
    const judge = await op.call<{ id: string }>('POST', `${p}/partners`, { displayName: 'You', category: 'other', active: true, address: claim.address, addressConfirmed: true });
    const house = await op.call<{ id: string }>('POST', `${p}/partners`, { displayName: 'Sandbox house account', category: 'other', active: true, address: houseAddress, addressConfirmed: true });
    for (const [partnerId, ratePct, title] of [[judge.id, JUDGE_SHARE_PCT, 'Your revenue share'], [house.id, HOUSE_SHARE_PCT, 'House revenue share']] as const) {
      await op.call('POST', `${p}/agreements`, {
        partnerId,
        sourceIds: [source.id],
        title,
        effectiveFrom: '2026-01-01',
        terms: { kind: 'percentage', ratePct, refundTreatment: 'net_adjustment', cap: null, poolSemantics: 'exclusive', overcommitAcknowledged: false, conversionBasis: 'zec_denominated' },
        activate: true,
        acknowledgeSnapshot: true,
      });
    }
    // The judge's 20% share of this fee is exactly the configured payout.
    const fee = this.config.payoutZat * 5n;
    await op.call('POST', `${p}/revenue/manual`, { sourceId: source.id, occurredAt: new Date().toISOString(), amount: zatToZecString(fee), currency: 'ZEC', type: 'realised_fee', description: 'Sandbox launch fees', externalId: null, note: 'Sample revenue for the public testnet sandbox' });

    const period = await op.call<{ id: string }>('POST', `${p}/periods`, { label: 'Sandbox payout', startDate: today, endDate: today, sourceIds: [source.id], rateSnapshotIds: {} });
    await setState(claim.id, 'setting_up', { periodId: period.id });
    const draft = await op.call<{ period: { revision: number } }>('GET', `${p}/periods/${period.id}`);
    await op.call('POST', `${p}/periods/${period.id}/freeze`, { expectedRevision: draft.period.revision });
    const frozen = await op.call<{ period: { revision: number }; rows: { status: string; zat: string | null }[] }>('GET', `${p}/periods/${period.id}`);
    const total = frozen.rows.filter((r) => r.status === 'payable').reduce((s, r) => s + BigInt(r.zat ?? '0'), 0n);
    const approveToken = await op.stepUp(password, 'approve_period', period.id);
    const { approvalId } = await op.call<{ approvalId: string }>('POST', `${p}/periods/${period.id}/approve`, { stepUpToken: approveToken, expectedRevision: frozen.period.revision, confirmTotalZat: total.toString() });
    await setState(claim.id, 'approved');

    const [batch] = await getDb().select({ id: schema.paymentBatches.id }).from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approvalId));
    if (!batch) throw new SandboxStepError('INTERNAL', 'The approval created no payment batch.');
    const prepared = await op.call<{ txId: string; state: string; review: { ok: boolean } | null }>('POST', '/api/v1/payments/prepare', { batchId: batch.id });
    await setState(claim.id, 'approved', { transactionId: prepared.txId });
    if (prepared.state !== 'PREPARED_INSPECTED' || !prepared.review?.ok) {
      throw new SandboxStepError('TRANSACTION_MISMATCH', 'The wallet built a transaction that failed inspection, so nothing was signed.');
    }
    await setState(claim.id, 'inspected');

    const signToken = await op.stepUp(password, 'sign_transaction', prepared.txId);
    await op.call('POST', `/api/v1/payments/transactions/${prepared.txId}/sign`, { stepUpToken: signToken });
    await setState(claim.id, 'authorised');

    await waitForConfirmation(prepared.txId);
    await setState(claim.id, 'confirmed');

    const [statement] = await getDb()
      .select({ id: schema.statements.id })
      .from(schema.statements)
      .where(and(eq(schema.statements.periodId, period.id), eq(schema.statements.partnerId, judge.id)));
    if (!statement) throw new SandboxStepError('INTERNAL', 'No statement was issued for your payout.');
    await setState(claim.id, 'confirmed', { statementId: statement.id });
    await this.share(claim.id, project.id, statement.id);
    await setState(claim.id, 'ready');
  }

  /** Seals the claimant's statement into a fresh encrypted link and remembers only its key, in memory. */
  async share(claimId: string, projectId: string, statementId: string): Promise<{ shareId: string; key: string }> {
    const { doc } = await this.operator.view<{ doc: { documentVersion: number; reference: string } }>('statements.detail', { projectId, statementId });
    const shareId = newShareId();
    const expiresAt = new Date(Date.now() + SHARE_DAYS * 86_400_000).toISOString();
    const { envelope, key } = await sealStatement(doc, { shareId, documentVersion: doc.documentVersion, expiresAt, issuerRef: doc.reference });
    await this.operator.call('POST', `/api/v1/projects/${projectId}/statements/${statementId}/shares`, { shareId, ciphertext: envelope, expiresAt, documentVersion: doc.documentVersion });
    shareKeys.set(claimId, { shareId, key });
    await setState(claimId, 'ready', { shareId });
    return { shareId, key };
  }

  /** The link for a ready claim, re-sealed if this process no longer holds the key. */
  async link(claim: { id: string; projectId: string | null; statementId: string | null }): Promise<{ shareId: string; key: string } | null> {
    const known = shareKeys.get(claim.id);
    if (known) return known;
    if (!claim.projectId || !claim.statementId) return null;
    await this.signedIn();
    return this.share(claim.id, claim.projectId, claim.statementId);
  }
}

async function ownAddress(): Promise<string> {
  const adapter = walletAdapter();
  if (!('deriveReceiveAddress' in adapter)) throw new SandboxStepError('WALLET_UNAVAILABLE', 'The sandbox wallet is not connected.');
  return adapter.deriveReceiveAddress();
}

async function waitForConfirmation(txId: string): Promise<void> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const [tx] = await getDb().select({ state: schema.chainTransactions.state }).from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
    if (tx?.state === 'CONFIRMED') return;
    if (tx && ['FAILED_PRE_BROADCAST', 'BROADCAST_REJECTED', 'CANCELLED_BEFORE_SIGN'].includes(tx.state)) {
      throw new SandboxStepError('BROADCAST_REJECTED', `The payment stopped at ${tx.state.toLowerCase().replace(/_/g, ' ')}.`);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new SandboxStepError('BROADCAST_OUTCOME_UNKNOWN', 'The payment has not confirmed yet. It may still confirm; check back soon.');
}

async function setState(claimId: string, state: ClaimState, extra: Partial<{ projectId: string; periodId: string; transactionId: string; statementId: string; shareId: string; error: string }> = {}): Promise<void> {
  await getDb().update(schema.sandboxClaims).set({ state, ...extra, updatedAt: new Date() }).where(eq(schema.sandboxClaims.id, claimId));
}

export function claimFingerprint(address: string): string {
  return addressFingerprint(address);
}
