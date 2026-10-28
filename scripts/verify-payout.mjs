#!/usr/bin/env node
// Checks Setrya payout commitments without Setrya's code. It reimplements the tree with node:crypto only, so an
// auditor or partner can trust the result without trusting the app.
//
//   node scripts/verify-payout.mjs proof.json             a partner's proof file, from "Download proof file"
//   node scripts/verify-payout.mjs bundle.json            an auditor's commitment bundle, from the period's close page
//   node scripts/verify-payout.mjs proof.json --memo "setrya:v1 ref=... root=..."   also compare a wallet memo
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/verify-payout.mjs <proof.json | bundle.json> [--memo "<wallet memo>"]');
  process.exit(2);
}
const memoArg = rest[0] === '--memo' ? rest[1] : undefined;
const input = JSON.parse(readFileSync(file, 'utf8'));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => [k, canonicalize(value[k])]));
  }
  return value;
}
const sha = (...parts) => createHash('sha256').update(Buffer.concat(parts)).digest('hex');
const LEAF_KEYS = ['v', 'periodId', 'revision', 'payoutKey', 'partnerRef', 'agreementVersionId', 'owed', 'currency', 'amountZat', 'salt'];
const leafHash = (leaf) => sha(Buffer.from([0]), Buffer.from(JSON.stringify(canonicalize(Object.fromEntries(LEAF_KEYS.map((k) => [k, leaf[k]])))), 'utf8'));
const nodeHash = (l, r) => sha(Buffer.from([1]), Buffer.from(l, 'hex'), Buffer.from(r, 'hex'));

function rootOf(hashes) {
  if (hashes.length === 1) return hashes[0];
  let k = 1;
  while (k * 2 < hashes.length) k *= 2;
  return nodeHash(rootOf(hashes.slice(0, k)), rootOf(hashes.slice(k)));
}

function verifyProof(leaf, proof, root) {
  let fn = proof.index;
  let sn = proof.size - 1;
  let hash = leafHash(leaf);
  for (const step of proof.siblings) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      if (step.side !== 'left') return false;
      hash = nodeHash(step.hash, hash);
      while (fn % 2 === 0 && fn !== 0) { fn = Math.floor(fn / 2); sn = Math.floor(sn / 2); }
    } else {
      if (step.side !== 'right') return false;
      hash = nodeHash(hash, step.hash);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && hash === root;
}

const MEMO = /^setrya:v1 ref=([A-Z0-9-]{1,40}) root=([0-9a-f]{64})$/;
let failed = false;
const report = (pass, label, detail = '') => {
  if (!pass) failed = true;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

if (Array.isArray(input.leaves)) {
  const ordered = [...input.leaves].sort((a, b) => a.index - b.index);
  const hashes = ordered.map(leafHash);
  report(hashes.every((h, i) => h === ordered[i].leafHash), 'Every leaf hashes to its stored hash', `${hashes.length} leaves`);
  report(rootOf(hashes) === input.root, 'The leaves rebuild the approved root', input.root);
  for (const leaf of ordered) {
    const m = MEMO.exec(leaf.memo ?? '');
    report(m !== null && m[2] === input.root, `Payout ${leaf.payoutKey} memo carries the root`);
  }
} else {
  const commitment = input.commitment;
  if (!commitment) {
    console.error('This file has no payout commitment.');
    process.exit(2);
  }
  for (const entry of commitment.entries) {
    report(entry.leaf.partnerRef === input.reference, `Line ${entry.leaf.payoutKey} names statement ${input.reference}`);
    report(verifyProof(entry.leaf, entry.proof, commitment.root), `Line ${entry.leaf.payoutKey} is in the approved payment`, `${entry.leaf.amountZat} zatoshis`);
    const m = MEMO.exec(entry.memo);
    report(m !== null && m[2] === commitment.root, 'The payment memo carries the same root', entry.memo);
    if (memoArg !== undefined) report(memoArg.trim() === entry.memo, 'Your wallet memo matches the committed memo');
  }
}
process.exit(failed ? 1 : 0);
