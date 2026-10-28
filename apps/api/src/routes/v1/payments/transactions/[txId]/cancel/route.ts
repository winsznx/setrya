import { z } from 'zod';

import { body, route } from '../../../../../../http/route';
import { cancelPrepared } from '../../../../../../services/payments/pipeline';
import { reason } from '../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { txId }) => {
  const input = await body(req, z.object({ reason }));
  await cancelPrepared(ctx, txId!, input.reason);
  return { ok: true };
});
