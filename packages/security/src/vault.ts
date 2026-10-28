import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { decryptField, encryptField, deriveSubkey } from './crypto';
import { argon2Raw } from './password';

/**
 * Two keys protect the data-encryption key (DEK): the owner's vault passphrase (Argon2id) and a host master key kept
 * outside the database. Neither alone unwraps the DEK. The unwrapped DEK lives only in server memory while unlocked.
 */

export interface WrappedVault {
  salt: string;
  wrappedDek: string;
  version: 1;
}

const WRAP_AAD = 'setrya:vault:dek:v1';

export function loadMasterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const file = env.SETRYA_MASTER_KEY_FILE;
  const inline = env.SETRYA_MASTER_KEY;
  let text: string | undefined;
  if (file) text = readFileSync(file, 'utf8').trim();
  else if (inline) text = inline.trim();
  if (!text) throw new Error('SETRYA_MASTER_KEY_FILE is not configured. Run `pnpm setup:keys` or set it to a 32-byte base64 key file.');
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32) throw new Error('The master key must decode to exactly 32 bytes');
  return key;
}

async function deriveKek(passphrase: string, salt: Buffer, masterKey: Buffer): Promise<Buffer> {
  const stretched = await argon2Raw(passphrase, salt);
  return deriveSubkey(Buffer.concat([stretched, masterKey]), 'vault-kek');
}

export async function createVault(passphrase: string, masterKey: Buffer): Promise<{ vault: WrappedVault; dek: Buffer }> {
  const salt = randomBytes(16);
  const dek = randomBytes(32);
  const kek = await deriveKek(passphrase, salt, masterKey);
  return { vault: { salt: salt.toString('base64'), wrappedDek: encryptField(kek, dek.toString('base64'), WRAP_AAD), version: 1 }, dek };
}

/** Returns null on a wrong passphrase; the caller must not distinguish further. */
export async function unwrapVault(vault: WrappedVault, passphrase: string, masterKey: Buffer): Promise<Buffer | null> {
  const kek = await deriveKek(passphrase, Buffer.from(vault.salt, 'base64'), masterKey);
  try {
    return Buffer.from(decryptField(kek, vault.wrappedDek, WRAP_AAD), 'base64');
  } catch {
    return null;
  }
}

/** Re-wraps the same DEK under a new passphrase, so no data needs re-encrypting. */
export async function rewrapVault(dek: Buffer, newPassphrase: string, masterKey: Buffer): Promise<WrappedVault> {
  const salt = randomBytes(16);
  const kek = await deriveKek(newPassphrase, salt, masterKey);
  return { salt: salt.toString('base64'), wrappedDek: encryptField(kek, dek.toString('base64'), WRAP_AAD), version: 1 };
}
