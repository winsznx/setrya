import { getDb, schema, eq, sql } from '@setrya/db';

import { ApiError, clientKey, rateLimit, route } from '../../../../http/route';

/** Ciphertext and expiry only. No names, amounts or project identifiers are ever returned in clear. */
export const GET = route('none', async (req, _ctx, { shareId }) => {
  rateLimit(`share:${clientKey(req)}`, 30, 60_000);
  if (!/^[A-Za-z0-9_-]{22}$/.test(shareId ?? '')) throw new ApiError('NOT_FOUND', 'This link cannot be opened.');
  const [s] = await getDb().select().from(schema.statementShares).where(eq(schema.statementShares.shareId, shareId!));
  if (!s) throw new ApiError('NOT_FOUND', 'This link cannot be opened.');
  if (s.revokedAt) throw new ApiError('STATEMENT_REVOKED', 'This link was revoked by the issuer.');
  if (s.expiresAt.getTime() <= Date.now() || !s.ciphertext) throw new ApiError('STATEMENT_EXPIRED', 'This statement link expired.');
  await getDb().update(schema.statementShares).set({ accessCount: sql`${schema.statementShares.accessCount} + 1` }).where(eq(schema.statementShares.id, s.id));
  const [ack] = await getDb().select({ at: schema.recipientAcknowledgments.createdAt }).from(schema.recipientAcknowledgments).where(eq(schema.recipientAcknowledgments.statementShareId, s.id));
  return { ciphertext: s.ciphertext, expiresAt: s.expiresAt.toISOString(), acknowledgedAt: ack?.at.toISOString() ?? null };
});
