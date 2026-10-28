import { blake2b } from '@noble/hashes/blake2';
import { bech32, bech32m } from '@scure/base';

/**
 * Zcash address parsing per ZIP 316 (Unified Addresses, Bech32m + F4Jumble), ZIP 320 (TEX) and the Sapling and
 * transparent encodings. This is a structural check: the wallet's FullPrivacy proposal is still the final authority on
 * whether a payment can be built.
 */

export type ZcashNetwork = 'mainnet' | 'testnet' | 'regtest';

export type ReceiverKind = 'p2pkh' | 'p2sh' | 'sapling' | 'orchard' | 'unknown';

export interface AddressAssessment {
  ok: boolean;
  network: ZcashNetwork | null;
  encoding: 'unified' | 'sapling' | 'transparent' | 'tex' | 'unknown';
  receivers: { kind: ReceiverKind; typecode: number }[];
  shieldedCapable: boolean;
  /** Receiver the payer pool can reach without crossing pools. */
  matchesFundPool: boolean;
  problem: null | 'INVALID' | 'WRONG_NETWORK' | 'TRANSPARENT_ONLY' | 'TEX_ONLY' | 'NO_POOL_RECEIVER';
  message: string;
}

const UA_HRP: Record<string, ZcashNetwork> = { u: 'mainnet', utest: 'testnet', uregtest: 'regtest' };
const SAPLING_HRP: Record<string, ZcashNetwork> = { zs: 'mainnet', ztestsapling: 'testnet', zregtestsapling: 'regtest' };
const TEX_HRP: Record<string, ZcashNetwork> = { tex: 'mainnet', textest: 'testnet', texregtest: 'regtest' };

const TYPECODE: Record<number, ReceiverKind> = { 0: 'p2pkh', 1: 'p2sh', 2: 'sapling', 3: 'orchard' };
const RECEIVER_LENGTH: Record<number, number> = { 0: 20, 1: 20, 2: 43, 3: 43 };
/** ZIP 316 Revision 0 forbids MUST-understand metadata, so a `u`/`utest` address carrying one is invalid. */
const MUST_UNDERSTAND = { min: 0xe0, max: 0xfc };

function personal(tag: string, i: number, j?: number): Uint8Array {
  const out = new Uint8Array(16);
  out.set(new TextEncoder().encode(tag));
  out[13] = i;
  if (j !== undefined) {
    out[14] = j & 0xff;
    out[15] = (j >> 8) & 0xff;
  }
  return out;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let k = 0; k < a.length; k += 1) out[k] = a[k]! ^ b[k]!;
  return out;
}

function hRound(i: number, u: Uint8Array, lL: number): Uint8Array {
  return blake2b(u, { dkLen: lL, personalization: personal('UA_F4Jumble_H', i) });
}

function gRound(i: number, u: Uint8Array, lR: number): Uint8Array {
  const out = new Uint8Array(lR);
  for (let j = 0, offset = 0; offset < lR; j += 1, offset += 64) {
    const block = blake2b(u, { dkLen: 64, personalization: personal('UA_F4Jumble_G', i, j) });
    out.set(block.subarray(0, Math.min(64, lR - offset)), offset);
  }
  return out;
}

export function f4jumbleInverse(message: Uint8Array): Uint8Array {
  const lM = message.length;
  if (lM < 38 || lM > 4_194_368) throw new Error('F4Jumble length out of range');
  const lL = Math.min(64, Math.floor(lM / 2));
  const lR = lM - lL;
  const c = message.subarray(0, lL);
  const d = message.subarray(lL);
  const y = xor(c, hRound(1, d, lL));
  const x = xor(d, gRound(1, y, lR));
  const a = xor(y, hRound(0, x, lL));
  const b = xor(x, gRound(0, a, lR));
  const out = new Uint8Array(lM);
  out.set(a, 0);
  out.set(b, lL);
  return out;
}

export function f4jumble(message: Uint8Array): Uint8Array {
  const lM = message.length;
  const lL = Math.min(64, Math.floor(lM / 2));
  const lR = lM - lL;
  const a = message.subarray(0, lL);
  const b = message.subarray(lL);
  const x = xor(b, gRound(0, a, lR));
  const y = xor(a, hRound(0, x, lL));
  const d = xor(x, gRound(1, y, lR));
  const c = xor(y, hRound(1, d, lL));
  const out = new Uint8Array(lM);
  out.set(c, 0);
  out.set(d, lL);
  return out;
}

function readCompactSize(bytes: Uint8Array, offset: number): [number, number] {
  const first = bytes[offset];
  if (first === undefined) throw new Error('truncated');
  if (first < 0xfd) return [first, offset + 1];
  if (first === 0xfd) {
    if (offset + 2 >= bytes.length) throw new Error('truncated');
    const v = bytes[offset + 1]! | (bytes[offset + 2]! << 8);
    if (v < 0xfd) throw new Error('non-canonical compactsize');
    return [v, offset + 3];
  }
  throw new Error('compactsize too large');
}

export function parseUnifiedReceivers(hrp: string, data: Uint8Array): { kind: ReceiverKind; typecode: number }[] {
  const raw = f4jumbleInverse(data);
  const padding = raw.subarray(raw.length - 16);
  const expected = new Uint8Array(16);
  expected.set(new TextEncoder().encode(hrp));
  if (!padding.every((v, k) => v === expected[k])) throw new Error('padding mismatch');
  const body = raw.subarray(0, raw.length - 16);
  const receivers: { kind: ReceiverKind; typecode: number }[] = [];
  let offset = 0;
  let lastTypecode = -1;
  while (offset < body.length) {
    const [typecode, afterType] = readCompactSize(body, offset);
    const [length, afterLength] = readCompactSize(body, afterType);
    if (afterLength + length > body.length) throw new Error('receiver overruns encoding');
    if (typecode <= lastTypecode) throw new Error('receivers out of order');
    if (typecode >= MUST_UNDERSTAND.min && typecode <= MUST_UNDERSTAND.max) throw new Error('unsupported metadata item');
    const expectedLength = RECEIVER_LENGTH[typecode];
    if (expectedLength !== undefined && length !== expectedLength) throw new Error('receiver has the wrong length');
    lastTypecode = typecode;
    receivers.push({ kind: TYPECODE[typecode] ?? 'unknown', typecode });
    offset = afterLength + length;
  }
  if (receivers.length === 0) throw new Error('no receivers');
  if (receivers.some((r) => r.kind === 'p2pkh') && receivers.some((r) => r.kind === 'p2sh')) throw new Error('both transparent receiver types');
  if (receivers.every((r) => r.kind === 'p2pkh' || r.kind === 'p2sh')) {
    throw new Error('transparent-only unified address');
  }
  if (!receivers.some((r) => r.kind === 'sapling' || r.kind === 'orchard')) throw new Error('no shielded receiver');
  return receivers;
}

function fail(problem: Exclude<AddressAssessment['problem'], null>, message: string, partial: Partial<AddressAssessment> = {}): AddressAssessment {
  return {
    ok: false,
    network: null,
    encoding: 'unknown',
    receivers: [],
    shieldedCapable: false,
    matchesFundPool: false,
    ...partial,
    problem,
    message,
  };
}

/**
 * The receiver family the payer spends from. Since NU6.3 an Orchard receiver delivers into the Ironwood pool, so
 * `'orchard'` means "paid in Ironwood through an Orchard receiver" (ZIP 258, ZIP 326).
 */
export type FundPool = 'orchard' | 'sapling';

export function assessAddress(input: string, expectedNetwork: ZcashNetwork, fundPool: FundPool = 'orchard'): AddressAssessment {
  const address = input.trim();
  if (address.length === 0 || address.length > 2048 || /\s/.test(address)) return fail('INVALID', 'Enter a single Zcash address.');

  if (/^(t1|t3|tm|t2)[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    const network: ZcashNetwork = address.startsWith('t1') || address.startsWith('t3') ? 'mainnet' : 'testnet';
    return fail('TRANSPARENT_ONLY', 'Transparent addresses reveal the amount and recipient. Ask for a shielded or unified address.', {
      network,
      encoding: 'transparent',
      receivers: [{ kind: address.startsWith('t3') || address.startsWith('t2') ? 'p2sh' : 'p2pkh', typecode: 0 }],
    });
  }

  const lower = address.toLowerCase();
  if (address !== lower && address !== address.toUpperCase()) return fail('INVALID', 'Mixed-case Bech32 strings are not valid.');
  const separator = lower.lastIndexOf('1');
  const hrp = separator > 0 ? lower.slice(0, separator) : '';

  if (hrp in TEX_HRP) {
    return fail('TEX_ONLY', 'TEX addresses only accept transparent funds and cannot receive a shielded payment.', {
      network: TEX_HRP[hrp]!,
      encoding: 'tex',
    });
  }

  if (hrp in UA_HRP) {
    const network = UA_HRP[hrp]!;
    let receivers: { kind: ReceiverKind; typecode: number }[];
    try {
      const decoded = bech32m.decode(lower as `${string}1${string}`, 4096);
      receivers = parseUnifiedReceivers(decoded.prefix, bech32m.fromWords(decoded.words));
    } catch (error) {
      const message = error instanceof Error && error.message === 'transparent-only unified address'
        ? 'This unified address only has transparent receivers.'
        : 'This is not a valid unified address. Check it was copied completely.';
      return fail(error instanceof Error && error.message === 'transparent-only unified address' ? 'TRANSPARENT_ONLY' : 'INVALID', message, { network, encoding: 'unified' });
    }
    const shieldedCapable = receivers.some((r) => r.kind === 'orchard' || r.kind === 'sapling');
    const matchesFundPool = receivers.some((r) => r.kind === fundPool);
    const base = { network, encoding: 'unified' as const, receivers, shieldedCapable, matchesFundPool };
    if (network !== expectedNetwork) return fail('WRONG_NETWORK', `This address is for ${network}, but Setrya is running on ${expectedNetwork}.`, base);
    if (!matchesFundPool) {
      const reachable = fundPool === 'orchard' ? 'Orchard receiver (which receives into the Ironwood pool)' : 'Sapling receiver';
      return fail('NO_POOL_RECEIVER', `This address has no ${reachable}, so paying it would move value across pools and reveal the amount.`, base);
    }
    return { ...base, ok: true, problem: null, message: `Unified address with ${receivers.map((r) => r.kind).join(', ')} receivers.` };
  }

  if (hrp in SAPLING_HRP) {
    const network = SAPLING_HRP[hrp]!;
    try {
      const decoded = bech32.decode(lower as `${string}1${string}`, 1023);
      if (bech32.fromWords(decoded.words).length !== 43) throw new Error('length');
    } catch {
      return fail('INVALID', 'This is not a valid Sapling address.', { network, encoding: 'sapling' });
    }
    const base = { network, encoding: 'sapling' as const, receivers: [{ kind: 'sapling' as const, typecode: 2 }], shieldedCapable: true, matchesFundPool: fundPool === 'sapling' };
    if (network !== expectedNetwork) return fail('WRONG_NETWORK', `This address is for ${network}, but Setrya is running on ${expectedNetwork}.`, base);
    if (fundPool !== 'sapling') {
      return fail('NO_POOL_RECEIVER', 'Sapling-only addresses cannot be paid from the Ironwood pool without crossing pools and revealing the amount. Ask for a unified address with an Orchard receiver.', base);
    }
    return { ...base, ok: true, problem: null, message: 'Sapling shielded address.' };
  }

  return fail('INVALID', 'This does not look like a Zcash address.');
}

/** First and last characters only, for lists. Full addresses are revealed by an explicit click. */
export function maskAddress(address: string): string {
  if (address.length <= 18) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}
