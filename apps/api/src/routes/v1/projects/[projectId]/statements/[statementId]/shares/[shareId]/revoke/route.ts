import { getDb, schema, eq, and, isNull } from '@setrya/db';

import { ApiError, route } from '../../../../../../../../../http/route';
import { audit } from '../../../../../../../../../services/audit';
import { requireProjectApi } from '../../../../../../../../../services/projects';

/** Revocation deletes the ciphertext at once. Copies the recipient already downloaded cannot be recalled. */
export const POST = route('unlocked', async (_req, ctx, { projectId, statementId, shareId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const [st] = await getDb().select({ id: schema.statements.id }).from(schema.statements).where(and(eq(schema.statements.id, statementId!), eq(schema.statements.projectId, project.id)));
  if (!st) throw new ApiError('NOT_FOUND', 'Not found.');
  const [r] = await getDb().update(schema.statementShares).set({ revokedAt: new Date(), ciphertext: null, purgedAt: new Date() }).where(and(eq(schema.statementShares.statementId, st.id), eq(schema.statementShares.shareId, shareId!), isNull(schema.statementShares.revokedAt))).returning({ id: schema.statementShares.id });
  if (!r) throw new ApiError('NOT_FOUND', 'Not found.');
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'statement.share_revoked', objectType: 'statement', objectId: st.id });
  return { ok: true };
});
