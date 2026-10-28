import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/** Canonical JSON: sorted keys, bigint as decimal strings, Dates as ISO. Hashes are stable across processes. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export interface SnapshotPayout {
  payoutKey: string;
  partnerId: string;
  agreementVersionId: string;
  addressVersionId: string;
  /** sha256 of the exact receiver string, so the snapshot never stores the address in clear. */
  addressFingerprint: string;
  amountZat: string;
  owed: string;
  currency: string;
  rateSnapshotId: string | null;
  sourceIdsHash: string;
}

export interface FrozenSnapshot {
  periodId: string;
  revision: number;
  periodStart: string;
  periodEnd: string;
  formulaVersion: string;
  network: string;
  accountId: string;
  privacyPolicy: 'FullPrivacy';
  payouts: SnapshotPayout[];
  held: { rowKey: string; partnerId: string; reasons: string[] }[];
  totalZat: string;
}

export function recipientsDigest(payouts: readonly Pick<SnapshotPayout, 'addressFingerprint' | 'amountZat' | 'payoutKey'>[]): string {
  return sha256Hex(
    payouts
      .map((p) => `${p.payoutKey}|${p.addressFingerprint}|${p.amountZat}`)
      .sort()
      .join('\n'),
  );
}

export function addressFingerprint(address: string): string {
  return sha256Hex(`setrya-address-v1|${address}`);
}

/** Short, human-checkable form of a fingerprint for approval screens. */
export function shortFingerprint(fingerprint: string): string {
  return `${fingerprint.slice(0, 4)}·${fingerprint.slice(4, 8)}·${fingerprint.slice(-4)}`.toUpperCase();
}
