import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

import { canonicalJson } from './snapshot';

/**
 * A commitment over every payout in an approved snapshot, so each partner can check that their own line is part of
 * the exact snapshot they were paid against without learning anything about the other lines.
 *
 * Leaves carry a random 32-byte salt, so a sibling hash in a proof is a hiding commitment: it cannot be brute-forced
 * back to an amount or a partner. Hashing follows RFC 6962: 0x00 prefixes a leaf, 0x01 an interior node, and an odd
 * node at the end of a level is promoted unchanged rather than duplicated.
 */

export interface PayoutLeaf {
  v: 1;
  periodId: string;
  revision: number;
  payoutKey: string;
  /** The partner's statement reference. Opaque, never the partner's name. */
  partnerRef: string;
  agreementVersionId: string;
  owed: string;
  currency: string;
  amountZat: string;
  /** 32 random bytes, hex. */
  salt: string;
}

export interface ProofStep {
  hash: string;
  side: 'left' | 'right';
}

export interface PayoutProof {
  index: number;
  /** Number of leaves in the tree. With the index it fixes the path, per RFC 9162 inclusion verification. */
  size: number;
  /** Bottom-up, from the leaf's sibling to the root's child. */
  siblings: ProofStep[];
}

export interface PayoutTree {
  root: string;
  /** Leaves in tree order, which is ascending payoutKey. */
  leaves: { index: number; payoutKey: string; leafHash: string }[];
  proofs: PayoutProof[];
}

const LEAF_PREFIX = 0x00;
const NODE_PREFIX = 0x01;
const HEX64 = /^[0-9a-f]{64}$/;

function prefixed(prefix: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 1);
  out[0] = prefix;
  out.set(body, 1);
  return out;
}

export function leafHash(leaf: PayoutLeaf): string {
  return bytesToHex(sha256(prefixed(LEAF_PREFIX, utf8ToBytes(canonicalJson(leaf)))));
}

function nodeHash(left: string, right: string): string {
  const body = new Uint8Array(64);
  body.set(hexToBytes(left), 0);
  body.set(hexToBytes(right), 32);
  return bytesToHex(sha256(prefixed(NODE_PREFIX, body)));
}

/** Largest power of two strictly below n, the RFC 6962 split point. */
function split(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

function rootOf(hashes: readonly string[]): string {
  if (hashes.length === 0) throw new Error('A payout tree needs at least one leaf.');
  if (hashes.length === 1) return hashes[0]!;
  const k = split(hashes.length);
  return nodeHash(rootOf(hashes.slice(0, k)), rootOf(hashes.slice(k)));
}

function pathOf(hashes: readonly string[], index: number): ProofStep[] {
  if (hashes.length <= 1) return [];
  const k = split(hashes.length);
  if (index < k) return [...pathOf(hashes.slice(0, k), index), { hash: rootOf(hashes.slice(k)), side: 'right' }];
  return [...pathOf(hashes.slice(k), index - k), { hash: rootOf(hashes.slice(0, k)), side: 'left' }];
}

/** The tree's root from leaf hashes already in tree order. */
export function rootFromLeafHashes(hashes: readonly string[]): string {
  return rootOf(hashes);
}

/** The inclusion proof for one leaf, from all leaf hashes in tree order. Contains hashes only, never plaintext. */
export function proofFromLeafHashes(hashes: readonly string[], index: number): PayoutProof {
  if (!Number.isInteger(index) || index < 0 || index >= hashes.length) throw new Error('Leaf index is out of range.');
  return { index, size: hashes.length, siblings: pathOf(hashes, index) };
}

export function buildPayoutTree(leaves: readonly PayoutLeaf[]): PayoutTree {
  const keys = new Set<string>();
  for (const l of leaves) {
    if (keys.has(l.payoutKey)) throw new Error(`Duplicate payout key ${l.payoutKey}.`);
    keys.add(l.payoutKey);
    if (!HEX64.test(l.salt)) throw new Error('Every leaf needs a 32-byte hex salt.');
  }
  const ordered = [...leaves].sort((a, b) => (a.payoutKey < b.payoutKey ? -1 : a.payoutKey > b.payoutKey ? 1 : 0));
  const hashes = ordered.map(leafHash);
  return {
    root: rootOf(hashes),
    leaves: ordered.map((l, index) => ({ index, payoutKey: l.payoutKey, leafHash: hashes[index]! })),
    proofs: hashes.map((_h, index) => proofFromLeafHashes(hashes, index)),
  };
}

/**
 * Recomputes the root from one leaf and its proof (RFC 9162, section 2.1.3.2). The index and size decide on which side
 * each sibling joins, and each step's recorded side must agree, so a reordered or relabelled proof fails.
 */
export function verifyPayoutProof({ leaf, proof, root }: { leaf: PayoutLeaf; proof: PayoutProof; root: string }): boolean {
  const { index, size, siblings } = proof;
  if (!HEX64.test(root) || !Number.isInteger(index) || !Number.isInteger(size) || index < 0 || index >= size) return false;
  let fn = index;
  let sn = size - 1;
  let hash = leafHash(leaf);
  for (const step of siblings) {
    if (!HEX64.test(step.hash) || sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      if (step.side !== 'left') return false;
      hash = nodeHash(step.hash, hash);
      while (fn % 2 === 0 && fn !== 0) {
        fn = Math.floor(fn / 2);
        sn = Math.floor(sn / 2);
      }
    } else {
      if (step.side !== 'right') return false;
      hash = nodeHash(hash, step.hash);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && hash === root;
}

export function randomSalt(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

const MEMO = /^setrya:v1 ref=([A-Z0-9-]{1,40}) root=([0-9a-f]{64})$/;
export const COMMITMENT_MEMO_FORMAT = 'setrya:v1 ref=<statement memo reference> root=<64 hex payout root>';

/** The memo every payout in a committed batch carries: its own reference plus the snapshot's payout root. */
export function formatCommitmentMemo(memoRef: string, root: string): string {
  const memo = `setrya:v1 ref=${memoRef} root=${root}`;
  if (!MEMO.test(memo)) throw new Error('Memo reference or root is malformed.');
  return memo;
}

export function parseCommitmentMemo(text: string): { memoRef: string; root: string } | null {
  const m = MEMO.exec(text.trim());
  return m ? { memoRef: m[1]!, root: m[2]! } : null;
}
