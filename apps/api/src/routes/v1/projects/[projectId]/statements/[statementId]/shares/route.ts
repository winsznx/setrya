import { getDb, schema, eq, and } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { requireProjectApi } from '../../../../../../../services/projects';

/** Stores client-encrypted ciphertext only. The decryption key never reaches this server. */
export const POST = route('unlocked', async (req, ctx, { projectId, statementId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const [st] = await getDb().select().from(schema.statements).where(and(eq(schema.statements.id, statementId!), eq(schema.statements.projectId, project.id)));
  if (!st) throw new ApiError('NOT_FOUND', 'Not found.');
  const input = await body(req, z.object({ shareId: z.string().regex(/^[A-Za-z0-9_-]{22}$/), ciphertext: z.string().min(40).max(200_000), expiresAt: z.string().datetime(), documentVersion: z.number().int() }));
  if (input.documentVersion !== st.documentVersion) throw new ApiError('CONFLICT', 'The statement changed. Reload and share again.');
  const expiresAt = new Date(input.expiresAt);
  if (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 366 * 86_400_000) throw new ApiError('INVALID_INPUT', 'Choose an expiry within the next year.');
  try {
    const [share] = await getDb().insert(schema.statementShares).values({ statementId: st.id, shareId: input.shareId, ciphertext: input.ciphertext, documentVersion: st.documentVersion, expiresAt }).returning({ id: schema.statementShares.id });
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'statement.shared', objectType: 'statement', objectId: st.id, diff: { expiresAt: input.expiresAt, shareRowId: share!.id } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new ApiError('CONFLICT', 'Share ID collision. Try again.', { canRetry: true });
    throw error;
  }
  return { shareId: input.shareId };
});
