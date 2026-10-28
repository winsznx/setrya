import { getDb, schema, eq, and, inArray, asc } from '@setrya/db';
import { recipientsDigest } from '@setrya/domain';
import type { ExpectedOutput } from '@setrya/wallet-adapter';

import { ApiError } from '../../http/route';
import type { Cipher } from '../crypto-ctx';

export type ChainTxRow = typeof schema.chainTransactions.$inferSelect;
export type BatchRow = typeof schema.paymentBatches.$inferSelect;
export type ApprovalRow = typeof schema.approvals.$inferSelect;
export type IntentRow = typeof schema.payoutIntents.$inferSelect;

export interface BatchContext {
  batch: BatchRow;
  approval: ApprovalRow;
  projectId: string;
  periodId: string;
  intents: IntentRow[];
}

/** Batch → approval → period → project, with the owner check done in the join. */
export async function loadBatch(ownerId: string, batchId: string): Promise<BatchContext> {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw new ApiError('NOT_FOUND', 'Not found.');
  const db = getDb();
  const [row] = await db
    .select({ batch: schema.paymentBatches, approval: schema.approvals, projectId: schema.periods.projectId, periodId: schema.periods.id })
    .from(schema.paymentBatches)
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.paymentBatches.approvalId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.approvals.periodId))
    .innerJoin(schema.projects, and(eq(schema.projects.id, schema.periods.projectId), eq(schema.projects.ownerId, ownerId)))
    .where(eq(schema.paymentBatches.id, batchId));
  if (!row) throw new ApiError('NOT_FOUND', 'Not found.');
  const intents = await batchIntents(row.batch);
  return { ...row, intents };
}

export async function batchIntents(batch: BatchRow): Promise<IntentRow[]> {
  return getDb().select().from(schema.payoutIntents).where(eq(schema.payoutIntents.batchId, batch.id)).orderBy(asc(schema.payoutIntents.idempotencyKey));
}

export async function expectedOutputs(cipher: Cipher, intents: IntentRow[]): Promise<ExpectedOutput[]> {
  if (intents.length === 0) return [];
  const addresses = await getDb().select().from(schema.partnerAddresses).where(inArray(schema.partnerAddresses.id, intents.map((i) => i.addressVersionId)));
  const byId = new Map(addresses.map((a) => [a.id, cipher.dec('partner_addresses', a.id, 'address', a.addressEnc)]));
  return intents.map((i) => ({ payoutId: i.id, address: byId.get(i.addressVersionId)!, amountZat: i.amountZat }));
}

export function batchDigest(intents: IntentRow[]): string {
  return recipientsDigest(intents.map((i) => ({ payoutKey: i.id, addressFingerprint: i.addressFingerprint, amountZat: i.amountZat.toString() })));
}

export async function loadTx(ownerId: string, txId: string): Promise<{ tx: ChainTxRow } & BatchContext> {
  if (!/^[0-9a-f-]{36}$/i.test(txId)) throw new ApiError('NOT_FOUND', 'Not found.');
  const [tx] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
  if (!tx) throw new ApiError('NOT_FOUND', 'Not found.');
  return { tx, ...(await loadBatch(ownerId, tx.batchId)) };
}
