import { ApiError, rateLimit, route } from '../../../../../../http/route';
import { loadTx } from '../../../../../../services/payments/context';
import { reconcileTransaction } from '../../../../../../services/payments/pipeline';

export const POST = route('unlocked', async (_req, ctx, { txId }) => {
  rateLimit(`reconcile:${ctx.sessionId}`, 20, 60_000);
  const { tx } = await loadTx(ctx.ownerId, txId!);
  if (!tx.txid) throw new ApiError('CONFLICT', 'Nothing has been broadcast for this transaction yet.');
  await reconcileTransaction(tx.id);
  return { ok: true };
});
