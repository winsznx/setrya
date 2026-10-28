import { getDb, schema, eq } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, clientKey, rateLimit, route } from '../../../../../http/route';

/** A human declaration only, stored as kind self_attested. The optional comment is encrypted with the share key. */
export const POST = route('none', async (req, _ctx, { shareId }) => {
  rateLimit(`ack:${clientKey(req)}`, 5, 60_000);
  const input = await body(req, z.object({ confirm: z.literal(true), encryptedMessage: z.string().max(4000).nullable() }));
  const [s] = await getDb().select().from(schema.statementShares).where(eq(schema.statementShares.shareId, shareId ?? ''));
  if (!s) throw new ApiError('NOT_FOUND', 'This link cannot be opened.');
  if (s.revokedAt) throw new ApiError('STATEMENT_REVOKED', 'This link was revoked by the issuer.');
  if (s.expiresAt.getTime() <= Date.now()) throw new ApiError('STATEMENT_EXPIRED', 'This statement link expired.');
  try {
    await getDb().insert(schema.recipientAcknowledgments).values({ statementShareId: s.id, kind: 'self_attested', evidenceType: 'human_declaration', encryptedMessage: input.encryptedMessage });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new ApiError('CONFLICT', 'Receipt was already acknowledged for this link.');
    throw error;
  }
  return { acknowledged: true };
});
