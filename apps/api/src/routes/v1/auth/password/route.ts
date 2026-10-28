import { getDb, schema, eq, sql } from '@setrya/db';
import { hashPassword, passwordStrength } from '@setrya/security';
import { z } from 'zod';

import { ApiError, body, rateLimit, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { verifyOwnerPassword } from '../../../../services/owner';
import { createSession } from '../../../../services/session';

/** Changing the password bumps auth_version, which signs out every other session. This one is re-issued. */
export const POST = route('unlocked', async (req, ctx) => {
  rateLimit(`pw:${ctx.sessionId}`, 5, 10 * 60_000);
  const input = await body(req, z.object({ current: z.string().max(256), next: z.string().max(256), confirm: z.string() }));
  if (!(await verifyOwnerPassword(ctx.ownerId, input.current))) throw new ApiError('FORBIDDEN', 'Current password not accepted.', { fieldErrors: { current: 'Not accepted' } });
  const strength = passwordStrength(input.next);
  if (!strength.ok) throw new ApiError('INVALID_INPUT', strength.problems[0]!, { fieldErrors: { next: strength.problems[0]! } });
  if (input.next !== input.confirm) throw new ApiError('INVALID_INPUT', 'Passwords do not match.', { fieldErrors: { confirm: 'Does not match' } });
  const [owner] = await getDb().update(schema.owners).set({ passwordHash: await hashPassword(input.next), authVersion: sql`${schema.owners.authVersion} + 1`, updatedAt: new Date() }).where(eq(schema.owners.id, ctx.ownerId)).returning({ authVersion: schema.owners.authVersion });
  await getDb().update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.ownerId, ctx.ownerId));
  await createSession(ctx.ownerId, owner!.authVersion, false, req.headers.get('user-agent'));
  await audit(ctx.cipher, 'owner', { projectId: null, eventType: 'security.password_changed' });
  return { ok: true, relock: true };
});
