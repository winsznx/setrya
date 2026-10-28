import { route } from '../../../../../../http/route';
import { resubmitSame } from '../../../../../../services/payments/pipeline';

export const POST = route('unlocked', async (_req, ctx, { txId }) => {
  await resubmitSame(ctx, txId!);
  return { ok: true };
});
