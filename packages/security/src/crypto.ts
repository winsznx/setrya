import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Field encryption: AES-256-GCM with a random 96-bit nonce and caller-supplied associated data, so a ciphertext copied
 * into another row or column fails to decrypt. Format: `v1.<nonce b64url>.<ciphertext||tag b64url>`.
 */

const VERSION = 'v1';

export class DecryptError extends Error {
  constructor() {
    super('Ciphertext failed authentication');
    this.name = 'DecryptError';
  }
}

export function encryptField(key: Buffer, plaintext: string, aad: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${nonce.toString('base64url')}.${body.toString('base64url')}`;
}

export function decryptField(key: Buffer, value: string, aad: string): string {
  const [version, nonceText, bodyText] = value.split('.');
  if (version !== VERSION || nonceText === undefined || bodyText === undefined) throw new DecryptError();
  const body = Buffer.from(bodyText, 'base64url');
  if (body.length < 16) throw new DecryptError();
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonceText, 'base64url'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptError();
  }
}

export function deriveSubkey(key: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), `setrya:${purpose}`, 32));
}

/** Keyed hash for exact-match lookups (external IDs) without storing the value in clear. */
export function keyedHash(key: Buffer, purpose: string, value: string): string {
  return createHmac('sha256', deriveSubkey(key, `hash:${purpose}`)).update(value, 'utf8').digest('hex');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
