import { getDb, schema, eq, and, ne, isNull } from '@setrya/db';

import { route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { blockedInDemo } from '../../../../services/demo-mode';
import { dropKey } from '../../../../services/vault-store';

/** Revokes every session except the current one and drops their unlocked keys from memory. */
export const DELETE = blockedInDemo(route('unlocked', async (_req, ctx) => {
  const revoked = await getDb().update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.ownerId, ctx.ownerId), ne(schema.sessions.id, ctx.sessionId), isNull(schema.sessions.revokedAt))).returning({ id: schema.sessions.id });
  revoked.forEach((s) => dropKey(s.id));
  await audit(ctx.cipher, 'owner', { projectId: null, eventType: 'security.sessions_revoked', diff: { count: revoked.length } });
  return { revoked: revoked.length };
}));
