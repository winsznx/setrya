import { hash, hashRaw, verify } from '@node-rs/argon2';

/** Argon2id at OWASP's 2024 minimum or above: 19 MiB is the floor, we use 64 MiB and t=3. */
const PARAMS = { algorithm: 2 /* Argon2id */, memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** Raw 32-byte Argon2id output for key derivation (vault passphrase → key-encryption key input). */
export async function argon2Raw(secret: string, salt: Buffer): Promise<Buffer> {
  return hashRaw(secret, { ...PARAMS, salt, outputLen: 32 });
}

export interface PasswordStrength {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  problems: string[];
}

export function passwordStrength(password: string): PasswordStrength {
  const problems: string[] = [];
  if (password.length < 12) problems.push('Use at least 12 characters');
  if (password.length > 256) problems.push('Use at most 256 characters');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3 && password.length < 20) problems.push('Mix letters, numbers and symbols, or use a longer passphrase');
  if (/^(.)\1+$/.test(password) || /password|setrya|123456|qwerty/i.test(password)) problems.push('Avoid common words and repeats');
  const lengthScore = password.length >= 20 ? 2 : password.length >= 14 ? 1 : 0;
  const score = Math.max(0, Math.min(4, lengthScore + (classes >= 3 ? 2 : classes >= 2 ? 1 : 0) - (problems.length > 0 ? 1 : 0))) as PasswordStrength['score'];
  return { ok: problems.length === 0, score, problems };
}
