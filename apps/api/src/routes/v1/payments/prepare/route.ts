import { z } from 'zod';

import { body, rateLimit, route } from '../../../../http/route';
import { prepareBatch } from '../../../../services/payments/pipeline';

/** Snapshot-bound and idempotent: an existing in-progress transaction for the batch is returned, never duplicated. */
export const POST = route('unlocked', async (req, ctx) => {
  rateLimit(`prepare:${ctx.sessionId}`, 10, 60_000);
  const { batchId } = await body(req, z.object({ batchId: z.string().uuid() }));
  const result = await prepareBatch(ctx, batchId);
  return { txId: result.txId, state: result.state, review: result.review ? { ...result.review, feeZat: result.review.feeZat?.toString() ?? null, matched: result.review.matched.length } : null };
});
