import { isValidTimeZone } from '@setrya/domain';
import { passwordStrength } from '@setrya/security';
import { z } from 'zod';

import { ApiError, body, clientKey, rateLimit, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { Cipher } from '../../../../services/crypto-ctx';
import { checkSetupToken, ownerExists, provisionOwner } from '../../../../services/owner';
import { createSession, readSession } from '../../../../services/session';
import { putKey } from '../../../../services/vault-store';

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name').max(80),
    email: z.string().trim().email('Enter an email address').max(200),
    password: z.string().min(1).max(256),
    confirmPassword: z.string(),
    vaultPassphrase: z.string().min(1).max(256),
    confirmVaultPassphrase: z.string(),
    setupToken: z.string().min(1, 'Enter the setup token from your deployment'),
    timezone: z.string().refine(isValidTimeZone, 'Choose a valid time zone'),
    acknowledge: z.literal(true, { errorMap: () => ({ message: 'Confirm you understand the recovery boundary' }) }),
  })
  .superRefine((v, ctx) => {
    const strength = passwordStrength(v.password);
    if (!strength.ok) ctx.addIssue({ code: 'custom', path: ['password'], message: strength.problems[0]! });
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    const vault = passwordStrength(v.vaultPassphrase);
    if (!vault.ok) ctx.addIssue({ code: 'custom', path: ['vaultPassphrase'], message: vault.problems[0]! });
    if (v.vaultPassphrase !== v.confirmVaultPassphrase) ctx.addIssue({ code: 'custom', path: ['confirmVaultPassphrase'], message: 'Passphrases do not match' });
    if (v.vaultPassphrase === v.password) ctx.addIssue({ code: 'custom', path: ['vaultPassphrase'], message: 'Use a different secret from your sign-in password' });
  });

export const POST = route('none', async (req) => {
  rateLimit(`setup:${clientKey(req)}`, 5, 60_000);
  if (await ownerExists()) throw new ApiError('FORBIDDEN', 'This installation already has an owner.', { status: 403 });
  const input = await body(req, schema);
  if (!checkSetupToken(input.setupToken)) throw new ApiError('FORBIDDEN', 'The setup token is not valid for this installation.', { fieldErrors: { setupToken: 'Setup token not accepted' }, status: 403 });
  const { ownerId, dek } = await provisionOwner(input);
  await createSession(ownerId, 1, false, req.headers.get('user-agent'));
  const session = await readSession();
  if (session) putKey(session.sessionId, dek, 15);
  await audit(new Cipher(dek), 'owner', { projectId: null, eventType: 'owner.provisioned', objectType: 'owner', objectId: ownerId });
  return { ownerId };
});
