import { getDb, schema, eq } from '@setrya/db';
import { loadMasterKey, passwordStrength, rewrapVault, unwrapVault } from '@setrya/security';
import { z } from 'zod';

import { ApiError, body, rateLimit, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { blockedInDemo } from '../../../../services/demo-mode';

/** Re-wraps the same data key under a new passphrase. No record is re-encrypted, so nothing can be half-migrated. */
export const POST = blockedInDemo(route('unlocked', async (req, ctx) => {
  rateLimit(`vaultpw:${ctx.sessionId}`, 5, 10 * 60_000);
  const input = await body(req, z.object({ current: z.string().max(256), next: z.string().max(256), confirm: z.string(), backupAcknowledged: z.literal(true) }));
  const [settings] = await getDb().select().from(schema.systemSettings).where(eq(schema.systemSettings.id, 1));
  const master = loadMasterKey();
  const dek = await unwrapVault({ salt: settings!.vaultSalt!, wrappedDek: settings!.vaultWrappedDek!, version: 1 }, input.current, master);
  if (!dek) throw new ApiError('FORBIDDEN', 'Current passphrase not accepted.', { fieldErrors: { current: 'Not accepted' } });
  const strength = passwordStrength(input.next);
  if (!strength.ok) throw new ApiError('INVALID_INPUT', strength.problems[0]!, { fieldErrors: { next: strength.problems[0]! } });
  if (input.next !== input.confirm) throw new ApiError('INVALID_INPUT', 'Passphrases do not match.', { fieldErrors: { confirm: 'Does not match' } });
  const vault = await rewrapVault(dek, input.next, master);
  if (!(await unwrapVault(vault, input.next, master))?.equals(dek)) throw new ApiError('INTERNAL', 'The new wrapping could not be verified. Nothing was changed.');
  await getDb().update(schema.systemSettings).set({ vaultSalt: vault.salt, vaultWrappedDek: vault.wrappedDek, updatedAt: new Date() }).where(eq(schema.systemSettings.id, 1));
  await audit(ctx.cipher, 'owner', { projectId: null, eventType: 'security.vault_passphrase_changed' });
  return { ok: true };
}));
