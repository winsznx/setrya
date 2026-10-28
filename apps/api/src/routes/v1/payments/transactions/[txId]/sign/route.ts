import { z } from 'zod';

import { body, route } from '../../../../../../http/route';
import { authoriseTransaction } from '../../../../../../services/payments/pipeline';

export const POST = route('unlocked', async (req, ctx, { txId }) => {
  const { stepUpToken } = await body(req, z.object({ stepUpToken: z.string().min(10) }));
  await authoriseTransaction(ctx, txId!, stepUpToken);
  return { queued: true };
});
