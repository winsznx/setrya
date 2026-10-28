import { getDb, schema } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, clientKey, rateLimit, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { authenticate } from '../../../../services/owner';
import { createSession, revokeCurrentSession } from '../../../../services/session';
import { dropKey } from '../../../../services/vault-store';

const schema_ = z.object({ email: z.string().trim().max(200), password: z.string().max(256), remember: z.boolean().default(false) });

export const POST = route('none', async (req) => {
  const ip = clientKey(req);
  rateLimit(`signin:${ip}`, 8, 5 * 60_000);
  const input = await body(req, schema_);
  rateLimit(`signin-email:${input.email.toLowerCase()}`, 8, 5 * 60_000);
  await getDb().insert(schema.loginAttempts).values({ bucket: `ip:${ip}` });
  const owner = await authenticate(input.email, input.password);
  if (!owner) throw new ApiError('UNAUTHENTICATED', 'That email and password do not match.');
  await createSession(owner.id, owner.authVersion, input.remember, req.headers.get('user-agent'));
  await audit(null, 'owner', { projectId: null, eventType: 'session.created' });
  return { signedIn: true };
});

export const DELETE = route('none', async () => {
  const sessionId = await revokeCurrentSession();
  if (sessionId) {
    dropKey(sessionId);
    await audit(null, 'owner', { projectId: null, eventType: 'session.revoked' });
  }
  return { signedOut: true };
});
