// TEST FIXTURE ONLY. Builds structurally valid unified addresses with random receiver bytes for UI and parser
// tests. These are not spendable addresses and must never receive funds.
import { blake2b } from '@noble/hashes/blake2';
import { bech32m } from '@scure/base';
import { randomBytes } from 'node:crypto';

function personal(tag, i, j) {
  const out = new Uint8Array(16);
  out.set(new TextEncoder().encode(tag));
  out[13] = i;
  if (j !== undefined) { out[14] = j & 0xff; out[15] = (j >> 8) & 0xff; }
  return out;
}
const xor = (a, b) => a.map((v, k) => v ^ b[k]);
const H = (i, u, l) => blake2b(u, { dkLen: l, personalization: personal('UA_F4Jumble_H', i) });
function G(i, u, l) {
  const out = new Uint8Array(l);
  for (let j = 0, o = 0; o < l; j++, o += 64) out.set(blake2b(u, { dkLen: 64, personalization: personal('UA_F4Jumble_G', i, j) }).subarray(0, Math.min(64, l - o)), o);
  return out;
}
function jumble(m) {
  const lL = Math.min(64, Math.floor(m.length / 2)), lR = m.length - lL;
  const a = m.subarray(0, lL), b = m.subarray(lL);
  const x = xor(b, G(0, a, lR)), y = xor(a, H(0, x, lL)), d = xor(x, G(1, y, lR)), c = xor(y, H(1, d, lL));
  const out = new Uint8Array(m.length); out.set(c); out.set(d, lL); return out;
}
export function makeUa(hrp = 'utest', receivers = [[2, 43], [3, 43]]) {
  const parts = [];
  for (const [type, len] of receivers) parts.push(Uint8Array.of(type, len), randomBytes(len));
  const pad = new Uint8Array(16); pad.set(new TextEncoder().encode(hrp));
  const raw = Buffer.concat([...parts, pad]);
  return bech32m.encode(hrp, bech32m.toWords(jumble(new Uint8Array(raw))), 4096);
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(makeUa(process.argv[2] ?? 'utest'));
