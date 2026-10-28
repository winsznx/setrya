import { webcrypto } from 'node:crypto';

/**
 * The share envelope the recipient page opens, sealed on the server for sandbox claims. Same format and associated
 * data as the operator's browser seal; the key goes back to the claimant once and is never stored.
 */
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export interface ShareAad {
  shareId: string;
  documentVersion: number;
  expiresAt: string;
  issuerRef: string;
}

export function newShareId(): string {
  return b64url(webcrypto.getRandomValues(new Uint8Array(16)));
}

export async function sealStatement(plaintext: unknown, aad: ShareAad): Promise<{ envelope: string; key: string }> {
  const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
  const key = await webcrypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const additionalData = enc.encode(`setrya-share-v1|${aad.shareId}|${aad.documentVersion}|${aad.expiresAt}|${aad.issuerRef}`);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, enc.encode(JSON.stringify(plaintext))));
  return { envelope: JSON.stringify({ v: 1, iv: b64url(iv), ct: b64url(ct), aad }), key: b64url(rawKey) };
}
