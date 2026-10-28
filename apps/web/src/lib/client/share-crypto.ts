/**
 * Statement share envelope. AES-256-GCM in the browser with a 256-bit key that lives only in the URL fragment, which
 * browsers never send to the server. Associated data binds the ciphertext to its share ID, document version, expiry
 * and issuer reference, so a blob moved to another share fails to decrypt.
 */

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

export interface Envelope {
  v: 1;
  iv: string;
  ct: string;
  aad: { shareId: string; documentVersion: number; expiresAt: string; issuerRef: string };
}

function aadBytes(a: Envelope['aad']): Uint8Array<ArrayBuffer> {
  return new Uint8Array(enc.encode(`setrya-share-v1|${a.shareId}|${a.documentVersion}|${a.expiresAt}|${a.issuerRef}`));
}

export async function sealStatement(plaintext: unknown, aad: Envelope['aad']): Promise<{ envelope: string; key: string }> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadBytes(aad) }, key, enc.encode(JSON.stringify(plaintext))));
  const envelope: Envelope = { v: 1, iv: b64url(iv), ct: b64url(ct), aad };
  return { envelope: JSON.stringify(envelope), key: b64url(rawKey) };
}

export async function openStatement<T>(envelopeText: string, keyText: string, expectedShareId: string): Promise<T> {
  const envelope = JSON.parse(envelopeText) as Envelope;
  if (envelope.v !== 1 || envelope.aad.shareId !== expectedShareId) throw new Error('mismatch');
  const raw = fromB64url(keyText);
  if (raw.length !== 32) throw new Error('bad key');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt', 'encrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(envelope.iv), additionalData: aadBytes(envelope.aad) }, key, fromB64url(envelope.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function sealWithKey(keyText: string, text: string, label: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', fromB64url(keyText), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(label) }, key, enc.encode(text)));
  return `${b64url(iv)}.${b64url(ct)}`;
}

export function newShareId(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(16)));
}
