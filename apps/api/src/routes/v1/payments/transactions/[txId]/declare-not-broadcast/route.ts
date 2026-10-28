import { z } from 'zod';

import { body, route } from '../../../../../../http/route';
import { declareNotBroadcast } from '../../../../../../services/payments/pipeline';
import { reason } from '../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { txId }) => {
  const input = await body(req, z.object({ reason }));
  await declareNotBroadcast(ctx, txId!, input.reason);
  return { ok: true };
});
