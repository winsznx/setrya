import { getDb, schema, eq, and, desc } from '@setrya/db';
import { HOLD_TEXT, TERMINAL_FAILURE, type TxState } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { activeApproval } from './approvals';
import { audit } from './audit';
import { periodRows, type PeriodRowView, type PeriodView } from './periods';
import type { ProjectView } from './projects';
import type { UnlockedContext } from './session';

export type Disposition = 'carry_forward' | 'waived' | 'remain_open';

export interface ReconLine {
  row: PeriodRowView;
  paid: boolean;
  txState: TxState | null;
  intentId: string | null;
  needsDisposition: boolean;
  reason: string;
}

/** Joins each calculation row to its payout and latest transaction. Only CONFIRMED counts as paid. */
export async function reconciliation(ctx: UnlockedContext, period: PeriodView) {
  const rows = await periodRows(ctx, period);
  const approval = await activeApproval(period.id, period.revision);
  const intents = approval ? await getDb().select().from(schema.payoutIntents).where(eq(schema.payoutIntents.approvalId, approval.id)) : [];
  const batches = approval ? await getDb().select().from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approval.id)) : [];
  const latestByBatch = new Map<string, typeof schema.chainTransactions.$inferSelect>();
  for (const b of batches) {
    const [t] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.batchId, b.id)).orderBy(desc(schema.chainTransactions.lineage)).limit(1);
    if (t) latestByBatch.set(b.id, t);
  }
  let feesZat = 0n;
  for (const t of latestByBatch.values()) if (t.state === 'CONFIRMED' && t.feeZat) feesZat += t.feeZat;
  const lines: ReconLine[] = rows
    .filter((r) => r.status !== 'nothing_owed')
    .map((row) => {
      const intent = intents.find((i) => i.calculationRowId === row.id) ?? null;
      const tx = intent?.batchId ? (latestByBatch.get(intent.batchId) ?? null) : null;
      const txState = (tx?.state as TxState | undefined) ?? null;
      const paid = txState === 'CONFIRMED';
      const reason = paid ? 'Confirmed on chain' : row.status === 'payable' ? (txState ? `Payment ${txState.toLowerCase().replaceAll('_', ' ')}` : 'Approved, not sent') : row.holds.map((h) => HOLD_TEXT[h.code]).join('; ');
      return { row, paid, txState, intentId: intent?.id ?? null, needsDisposition: !paid, reason };
    });
  const inFlight = [...latestByBatch.values()].filter((t) => t.state !== 'CONFIRMED' && !TERMINAL_FAILURE.has(t.state as TxState));
  return { lines, feesZat, inFlight: inFlight.length, approval };
}

export async function closePeriod(ctx: UnlockedContext, project: ProjectView, period: PeriodView, dispositions: Record<string, { disposition: Disposition; reason: string }>, note: string): Promise<void> {
  if (!['approved', 'in_payment', 'settled'].includes(period.status)) throw new ApiError('STALE_PERIOD_REVISION', 'Only an approved period can be closed. Drafts can be revised instead.');
  const recon = await reconciliation(ctx, period);
  if (recon.inFlight > 0) throw new ApiError('CONFLICT', `${recon.inFlight} transaction(s) are still in flight or under investigation. Resolve them before closing.`);
  for (const line of recon.lines.filter((l) => l.needsDisposition)) {
    const d = dispositions[line.row.key];
    if (!d) throw new ApiError('INVALID_INPUT', 'Choose carry forward, waive or remain open for every unpaid row.', { fieldErrors: { [line.row.key]: 'Required' } });
    if (d.disposition === 'waived' && d.reason.trim().length < 3) throw new ApiError('INVALID_INPUT', 'Waiving needs a reason.', { fieldErrors: { [line.row.key]: 'Give a reason' } });
  }
  await getDb().transaction(async (tx) => {
    for (const line of recon.lines.filter((l) => l.needsDisposition)) {
      const d = dispositions[line.row.key]!;
      if (line.intentId) await tx.update(schema.payoutIntents).set({ disposition: d.disposition }).where(eq(schema.payoutIntents.id, line.intentId));
      if (d.disposition === 'carry_forward' || line.row.status === 'credit') {
        const id = randomUUID();
        await tx.insert(schema.adjustments).values({ id, projectId: project.id, originPeriodId: period.id, partnerId: line.row.partnerId, calculationRowId: line.row.id, kind: line.row.status === 'credit' ? 'negative_carry_forward' : 'carry_forward', amountDecimal: line.row.owed, currency: line.row.currency, reasonEnc: ctx.cipher.enc('adjustments', id, 'reason', d.reason || line.reason) });
      }
    }
    const record = { closedBy: ctx.ownerId, note, dispositions, paidRows: recon.lines.filter((l) => l.paid).length, feesZat: recon.feesZat.toString(), revision: period.revision };
    const [u] = await tx.update(schema.periods).set({ status: 'closed', closedAt: new Date(), closeRecordEnc: ctx.cipher.encJson('periods', period.id, 'close_record', record), version: period.version + 1, updatedAt: new Date() }).where(and(eq(schema.periods.id, period.id), eq(schema.periods.version, period.version))).returning({ id: schema.periods.id });
    if (!u) throw new ApiError('CONFLICT', 'The period changed. Reload.');
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.closed', objectType: 'period', objectId: period.id, diff: record, reason: note }, tx);
  });
}

export async function listAdjustments(ctx: UnlockedContext, projectId: string) {
  const rows = await getDb().select().from(schema.adjustments).where(eq(schema.adjustments.projectId, projectId)).orderBy(desc(schema.adjustments.createdAt));
  return rows.map((r) => ({ ...r, reason: ctx.cipher.dec('adjustments', r.id, 'reason', r.reasonEnc) }));
}
