import { b64url } from './share-crypto';

/**
 * Password-encrypted export: PBKDF2-SHA256 (600,000 iterations) derives an AES-256-GCM key. The file is
 * self-describing so `node scripts/decrypt-export.mjs` can open it without Setrya running.
 */
export async function sealArchive(payload: unknown, password: string, purpose: string): Promise<Blob> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 600_000;
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = enc.encode(`setrya-archive-v1|${purpose}`);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, enc.encode(JSON.stringify(payload))));
  const file = { format: 'setrya-archive', v: 1, purpose, kdf: { name: 'PBKDF2-SHA256', salt: b64url(salt), iterations }, cipher: 'AES-256-GCM', iv: b64url(iv), ct: b64url(ct), createdAt: new Date().toISOString() };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
