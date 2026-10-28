import { z } from 'zod';

import { ApiError, body, rateLimit, route } from '../../../../http/route';
import { issueStepUp, verifyOwnerPassword } from '../../../../services/owner';
import { stepUpScope } from '../../../../services/step-up-scopes';

const schema = z.object({
  password: z.string().min(1).max(256),
  action: z.enum(['approve_period', 'sign_transaction', 'export_data', 'change_security']),
  targetId: z.string().uuid(),
});

/** The scope is computed server-side from stored state, so the browser cannot mint a token for different values. */
export const POST = route('unlocked', async (req, ctx) => {
  rateLimit(`stepup:${ctx.sessionId}`, 10, 5 * 60_000);
  const input = await body(req, schema);
  if (!(await verifyOwnerPassword(ctx.ownerId, input.password))) throw new ApiError('FORBIDDEN', 'Password not accepted.', { fieldErrors: { password: 'Password not accepted' } });
  const { scope, windowSeconds } = await stepUpScope(ctx, input.action, input.targetId);
  const { token, expiresAt } = await issueStepUp(ctx.sessionId, input.action, scope, windowSeconds);
  return { token, expiresAt: expiresAt.toISOString() };
});
