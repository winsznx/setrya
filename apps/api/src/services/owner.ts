import { getDb, schema, eq, and, isNull, gt, sql } from '@setrya/db';
import { hashCanonical } from '@setrya/domain';
import { constantTimeEqual, createVault, hashPassword, loadMasterKey, randomToken, sha256, unwrapVault, verifyPassword } from '@setrya/security';

import { ApiError } from '../http/route';
import { DEMO_MAX_UNLOCK_MS, demoConfig } from './demo-mode';
import { putKey } from './vault-store';

export async function ownerExists(): Promise<boolean> {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(schema.owners);
  return (row?.n ?? 0) > 0;
}

export function checkSetupToken(token: string): boolean {
  const expected = process.env.SETRYA_SETUP_TOKEN;
  return expected !== undefined && expected.length >= 24 && constantTimeEqual(token, expected);
}

export interface ProvisionInput {
  displayName: string;
  email: string;
  password: string;
  timezone: string;
  vaultPassphrase: string;
}

export async function provisionOwner(input: ProvisionInput): Promise<{ ownerId: string; dek: Buffer }> {
  const masterKey = loadMasterKey();
  const passwordHash = await hashPassword(input.password);
  const { vault, dek } = await createVault(input.vaultPassphrase, masterKey);
  const db = getDb();
  const ownerId = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: schema.owners.id }).from(schema.owners).for('update').limit(1);
    if (existing) throw new ApiError('FORBIDDEN', 'This installation already has an owner.');
    const [owner] = await tx
      .insert(schema.owners)
      .values({ emailNormalized: input.email.trim().toLowerCase(), displayName: input.displayName.trim(), passwordHash, timezone: input.timezone })
      .returning({ id: schema.owners.id });
    await tx
      .insert(schema.systemSettings)
      .values({ id: 1, vaultSalt: vault.salt, vaultWrappedDek: vault.wrappedDek, vaultVersion: vault.version, network: process.env.SETRYA_NETWORK ?? null })
      .onConflictDoUpdate({ target: schema.systemSettings.id, set: { vaultSalt: vault.salt, vaultWrappedDek: vault.wrappedDek, vaultVersion: vault.version } });
    return owner!.id;
  });
  return { ownerId, dek };
}

/** Constant work whether or not the email matches, so timing does not reveal the account. */
let dummyHash: Promise<string> | undefined;

export async function authenticate(email: string, password: string): Promise<{ id: string; authVersion: number } | null> {
  const [owner] = await getDb().select().from(schema.owners).where(eq(schema.owners.emailNormalized, email.trim().toLowerCase())).limit(1);
  const ok = await verifyPassword(owner?.passwordHash ?? (await (dummyHash ??= hashPassword(randomToken()))), password);
  return owner && ok ? { id: owner.id, authVersion: owner.authVersion } : null;
}

export async function verifyOwnerPassword(ownerId: string, password: string): Promise<boolean> {
  const [owner] = await getDb().select({ hash: schema.owners.passwordHash }).from(schema.owners).where(eq(schema.owners.id, ownerId)).limit(1);
  return owner ? verifyPassword(owner.hash, password) : false;
}

export async function unlockVault(sessionId: string, passphrase: string): Promise<boolean> {
  const [settings] = await getDb().select().from(schema.systemSettings).where(eq(schema.systemSettings.id, 1)).limit(1);
  if (!settings?.vaultSalt || !settings.vaultWrappedDek) return false;
  const dek = await unwrapVault({ salt: settings.vaultSalt, wrappedDek: settings.vaultWrappedDek, version: 1 }, passphrase, loadMasterKey());
  if (!dek) return false;
  putKey(sessionId, dek, settings.autoLockMinutes, demoConfig().enabled ? DEMO_MAX_UNLOCK_MS : Infinity);
  return true;
}

export type StepUpAction = 'approve_period' | 'sign_transaction' | 'export_data' | 'change_security';

export async function issueStepUp(sessionId: string, action: StepUpAction, scope: Record<string, unknown>, windowSeconds: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + windowSeconds * 1000);
  await getDb().insert(schema.stepUpTokens).values({ sessionId, hashedToken: sha256(token), action, scopeDigest: hashCanonical(scope), expiresAt });
  return { token, expiresAt };
}

/**
 * One-time, short-lived, bound to the session, the action and the exact scope (snapshot hash, account, network,
 * total, recipients). A replay or a token minted for a different transaction is refused.
 */
export async function consumeStepUp(sessionId: string, token: string | undefined, action: StepUpAction, scope: Record<string, unknown>): Promise<void> {
  if (!token) throw new ApiError('STEP_UP_REQUIRED', 'Confirm with your password to continue.');
  const [row] = await getDb()
    .update(schema.stepUpTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.stepUpTokens.hashedToken, sha256(token)), eq(schema.stepUpTokens.sessionId, sessionId), eq(schema.stepUpTokens.action, action), eq(schema.stepUpTokens.scopeDigest, hashCanonical(scope)), isNull(schema.stepUpTokens.usedAt), gt(schema.stepUpTokens.expiresAt, new Date())))
    .returning({ id: schema.stepUpTokens.id });
  if (!row) throw new ApiError('STEP_UP_REQUIRED', 'That confirmation expired, was already used, or was for a different action. Confirm again.');
}
