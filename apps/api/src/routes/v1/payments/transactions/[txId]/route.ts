import { getDb, schema, eq, asc } from '@setrya/db';

import { route } from '../../../../../http/route';
import { loadTx } from '../../../../../services/payments/context';

/** Safe review data only: never the PCZT, signed bytes or RPC detail. */
export const GET = route('unlocked', async (_req, ctx, { txId }) => {
  const { tx, batch } = await loadTx(ctx.ownerId, txId!);
  const attempts = await getDb().select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.batchId, batch.id)).orderBy(asc(schema.paymentAttempts.createdAt));
  return {
    id: tx.id,
    state: tx.state,
    txid: tx.txid,
    feeZat: tx.feeZat?.toString() ?? null,
    confirmations: tx.confirmations,
    height: tx.height,
    diagnosis: tx.diagnosis,
    lastCheckedAt: tx.lastCheckedAt,
    attempts: attempts.filter((a) => a.chainTransactionId === tx.id).map((a) => ({ stage: a.stage, outcome: a.outcome, at: a.createdAt, detail: a.detail, errorCode: a.errorCode })),
  };
});
