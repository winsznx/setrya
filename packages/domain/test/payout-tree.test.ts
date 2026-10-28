import { describe, expect, it } from 'vitest';

import {
  buildPayoutTree,
  formatCommitmentMemo,
  leafHash,
  parseCommitmentMemo,
  proofFromLeafHashes,
  randomSalt,
  rootFromLeafHashes,
  verifyPayoutProof,
  type PayoutLeaf,
} from '../src/payout-tree';

function leaves(n: number): PayoutLeaf[] {
  return Array.from({ length: n }, (_v, i) => ({
    v: 1,
    periodId: '11111111-1111-4111-8111-111111111111',
    revision: 1,
    payoutKey: `row-${String(i).padStart(3, '0')}`,
    partnerRef: `ST-${String(1000 + i)}`,
    agreementVersionId: `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`,
    owed: `${(i + 1) * 10}.00`,
    currency: 'USD',
    amountZat: String((i + 1) * 1_000_000),
    salt: randomSalt(),
  }));
}

describe('payout tree', () => {
  for (const n of [1, 2, 3, 7, 16]) {
    it(`proves every leaf of a ${n}-leaf tree`, () => {
      const set = leaves(n);
      const tree = buildPayoutTree(set);
      expect(tree.root).toMatch(/^[0-9a-f]{64}$/);
      for (const entry of tree.leaves) {
        const leaf = set.find((l) => l.payoutKey === entry.payoutKey)!;
        expect(verifyPayoutProof({ leaf, proof: tree.proofs[entry.index]!, root: tree.root })).toBe(true);
      }
    });
  }

  it('matches the root and proofs rebuilt from stored leaf hashes', () => {
    const tree = buildPayoutTree(leaves(7));
    const hashes = tree.leaves.map((l) => l.leafHash);
    expect(rootFromLeafHashes(hashes)).toBe(tree.root);
    expect(proofFromLeafHashes(hashes, 5)).toEqual(tree.proofs[5]);
  });

  it('orders leaves by payout key regardless of input order', () => {
    const set = leaves(5);
    expect(buildPayoutTree([...set].reverse()).root).toBe(buildPayoutTree(set).root);
  });

  it('a single leaf is its own root', () => {
    const [leaf] = leaves(1);
    expect(buildPayoutTree([leaf!]).root).toBe(leafHash(leaf!));
  });

  const set = leaves(7);
  const tree = buildPayoutTree(set);
  const target = set[3]!;
  const proof = tree.proofs[tree.leaves.find((l) => l.payoutKey === target.payoutKey)!.index]!;

  for (const field of ['periodId', 'payoutKey', 'partnerRef', 'agreementVersionId', 'owed', 'currency', 'amountZat', 'salt'] as const) {
    it(`fails when the leaf's ${field} is changed`, () => {
      const changed = { ...target, [field]: field === 'salt' ? randomSalt() : `${target[field]}x` };
      expect(verifyPayoutProof({ leaf: changed, proof, root: tree.root })).toBe(false);
    });
  }

  it('fails when the revision is changed', () => {
    expect(verifyPayoutProof({ leaf: { ...target, revision: 2 }, proof, root: tree.root })).toBe(false);
  });

  const flip = (h: string) => `${h[0] === '0' ? '1' : '0'}${h.slice(1)}`;

  it('fails when a sibling hash is changed', () => {
    // #given a proof whose first sibling is altered
    const tampered = { ...proof, siblings: proof.siblings.map((step, i) => (i === 0 ? { ...step, hash: flip(step.hash) } : step)) };
    // #then it no longer reaches the root
    expect(verifyPayoutProof({ leaf: target, proof: tampered, root: tree.root })).toBe(false);
  });

  it('fails when a sibling side is relabelled', () => {
    const tampered = { ...proof, siblings: proof.siblings.map((step, i) => (i === 0 ? { ...step, side: step.side === 'left' ? ('right' as const) : ('left' as const) } : step)) };
    expect(verifyPayoutProof({ leaf: target, proof: tampered, root: tree.root })).toBe(false);
  });

  it('fails when the index is changed', () => {
    expect(verifyPayoutProof({ leaf: target, proof: { ...proof, index: proof.index + 1 }, root: tree.root })).toBe(false);
  });

  it('fails when the claimed size changes the path shape', () => {
    // #given the last leaf of a 7-leaf tree, whose path depends on the size
    const last = set[6]!;
    const lastProof = tree.proofs[6]!;
    // #then claiming a 5-leaf tree breaks it
    expect(verifyPayoutProof({ leaf: last, proof: { ...lastProof, size: 5 }, root: tree.root })).toBe(false);
  });

  it('fails against a different root', () => {
    expect(verifyPayoutProof({ leaf: target, proof, root: flip(tree.root) })).toBe(false);
  });

  it('never puts another leaf’s plaintext in a proof', () => {
    const text = JSON.stringify(proof);
    for (const other of set.filter((l) => l !== target)) {
      for (const value of [other.partnerRef, other.amountZat, other.salt, other.payoutKey, other.owed]) expect(text).not.toContain(value);
    }
  });

  it('rejects duplicate payout keys and missing salts', () => {
    const [a] = leaves(1);
    expect(() => buildPayoutTree([a!, a!])).toThrow(/Duplicate/);
    expect(() => buildPayoutTree([{ ...a!, salt: 'short' }])).toThrow(/salt/);
  });
});

describe('commitment memo', () => {
  const root = 'a'.repeat(64);

  it('round trips and fits a Zcash memo', () => {
    const memo = formatCommitmentMemo('STR-1A2B3C4D', root);
    expect(memo).toBe(`setrya:v1 ref=STR-1A2B3C4D root=${root}`);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(512);
    expect(parseCommitmentMemo(`  ${memo}\n`)).toEqual({ memoRef: 'STR-1A2B3C4D', root });
  });

  it('rejects malformed memos', () => {
    expect(parseCommitmentMemo('setrya:v1 ref=STR-1 root=xyz')).toBeNull();
    expect(parseCommitmentMemo('hello')).toBeNull();
    expect(() => formatCommitmentMemo('bad ref', root)).toThrow();
  });
});
