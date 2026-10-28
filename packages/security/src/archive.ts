import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';

/**
 * Password-sealed JSON for backups. PBKDF2-SHA256 derives an AES-256-GCM key; the purpose string is bound as
 * associated data so a file sealed for one purpose cannot be opened as another. Bigints survive the round trip.
 */

const ITERATIONS = 600_000;

export function sealJson(value: unknown, password: string, purpose: string): Buffer {
  const plaintext = Buffer.from(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? { $bigint: v.toString() } : v)));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${purpose}-v1`));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return Buffer.from(JSON.stringify({ format: purpose, v: 1, kdf: { name: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: salt.toString('base64url') }, iv: iv.toString('base64url'), ct: ct.toString('base64url') }));
}

export function openJson<T>(file: string, password: string, purpose: string): T {
  const f = JSON.parse(file) as { format: string; v: number; kdf: { iterations: number; salt: string }; iv: string; ct: string };
  if (f.format !== purpose || f.v !== 1) throw new Error(`Not a ${purpose} file`);
  const key = pbkdf2Sync(password, Buffer.from(f.kdf.salt, 'base64url'), f.kdf.iterations, 32, 'sha256');
  const ct = Buffer.from(f.ct, 'base64url');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(f.iv, 'base64url'));
  d.setAAD(Buffer.from(`${purpose}-v1`));
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return JSON.parse(pt.toString('utf8'), (_k, v) => (v && typeof v === 'object' && '$bigint' in v ? BigInt(v.$bigint) : v)) as T;
}
