import type { FundPool } from '@setrya/domain';

import type { PcztInspection } from './types';

export interface ExpectedOutput {
  payoutId: string;
  address: string;
  amountZat: bigint;
}

export interface InspectionCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface InspectionReview {
  ok: boolean;
  feeZat: bigint | null;
  expiryHeight: number | null;
  pool: string | null;
  checks: InspectionCheck[];
  matched: { payoutId: string; outputRef: string; amountZat: bigint }[];
}

/** ZIP 317 conventional fee: marginal fee times the logical action count, never fewer than the grace actions. */
const MARGINAL_FEE = 5000n;
const GRACE_ACTIONS = 2n;

export function conventionalFeeZat(inspection: PcztInspection): bigint {
  const max = (a: number, b: number) => BigInt(Math.max(a, b));
  const transparent = max(inspection.transparent?.inputs?.length ?? 0, inspection.transparent?.outputs?.length ?? 0);
  const sapling = max(inspection.sapling?.spends ?? 0, inspection.sapling?.outputs?.length ?? 0);
  const logical = transparent + sapling + BigInt(inspection.orchard?.actions ?? 0) + BigInt(inspection.ironwood?.actions ?? 0);
  return MARGINAL_FEE * (logical > GRACE_ACTIONS ? logical : GRACE_ACTIONS);
}

function toZat(v: number | string | undefined): bigint | null {
  if (v === undefined || v === null) return null;
  const s = typeof v === 'number' ? (Number.isSafeInteger(v) ? String(v) : '') : v;
  return /^-?\d+$/.test(s) ? BigInt(s) : null;
}

/**
 * Compares the wallet's PCZT inspection with the frozen business snapshot. Any difference blocks signing. Inspect
 * output is constructor metadata, not cryptographic proof; extract re-verifies proofs and signatures.
 */
export function reviewInspection(inspection: PcztInspection, createdPolicy: string, expected: readonly ExpectedOutput[], fundPool: FundPool): InspectionReview {
  const checks: InspectionCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });

  add('policy', 'Wallet proposal requires only FullPrivacy', createdPolicy === 'FullPrivacy' && inspection.privacy_policy === 'FullPrivacy', `Proposal policy: ${createdPolicy}, inspected: ${inspection.privacy_policy ?? 'not reported'}`);
  add('wallet_created', 'Transaction was created by this wallet', inspection.wallet_created !== false, inspection.wallet_created === false ? 'PCZT was not created by this wallet' : 'Created by this wallet');

  const tIn = inspection.transparent?.inputs?.length ?? 0;
  const tOut = inspection.transparent?.outputs?.length ?? 0;
  add('transparent', 'No transparent inputs or outputs', tIn === 0 && tOut === 0, `${tIn} transparent input(s), ${tOut} transparent output(s)`);

  const pools = (['sapling', 'orchard', 'ironwood'] as const).map((name) => {
    const p = inspection[name];
    const balance = toZat(p?.value_balance_zat) ?? 0n;
    const activity = (p?.actions ?? 0) + (p?.spends ?? 0) + (p?.outputs?.length ?? 0);
    return { name, balance, activity };
  });
  const moving = pools.filter((p) => p.balance !== 0n);
  const fee = toZat(inspection.fee_zat);
  const singlePool = moving.length === 1 && fee !== null && moving[0]!.balance === fee;
  // Since NU6.3 nothing may flow into Orchard, so an Orchard-receiver payer spends and pays inside Ironwood (ZIP 326).
  const allowedPools: readonly string[] = fundPool === 'orchard' ? ['ironwood'] : ['sapling'];
  const poolName = moving[0]?.name ?? null;
  add(
    'single_pool',
    'Value stays inside one shielded pool',
    singlePool && poolName !== null && allowedPools.includes(poolName),
    moving.length === 0 ? 'No pool reports the fee leaving it' : moving.map((p) => `${p.name} value balance ${p.balance} zat`).join(', '),
  );
  const orchardValue = (inspection.orchard?.outputs ?? []).filter((o) => (toZat(o.value_zat) ?? 0n) > 0n).length;
  add('no_orchard_outputs', 'Nothing is sent into the closed Orchard pool', orchardValue === 0, orchardValue === 0 ? 'No valued Orchard outputs' : `${orchardValue} Orchard output(s) carry value`);
  if (moving[0]?.name === 'orchard') {
    add('legacy_orchard', 'Funds are not legacy Orchard notes', false, 'These funds are still in Orchard. Moving them to Ironwood reveals the amount on-chain (ZIP 318), so migrate them separately with explicit consent before paying.');
  }
  const strayActivity = pools.filter((p) => p.name !== poolName && p.activity > 0 && p.balance !== 0n);
  add('no_cross_pool', 'No cross-pool amount is revealed', strayActivity.length === 0 && moving.length <= 1, strayActivity.length === 0 ? 'No turnstile crossing' : `Value crosses ${strayActivity.map((p) => p.name).join(', ')}`);

  const outputs = (['sapling', 'orchard', 'ironwood'] as const).flatMap((name) =>
    (inspection[name]?.outputs ?? []).map((o, index) => ({ ref: `${name}:${index}`, address: o.user_address ?? null, zat: toZat(o.value_zat) })),
  );
  const remaining = [...expected];
  const matched: InspectionReview['matched'] = [];
  const unexpected: string[] = [];
  for (const output of outputs) {
    if (output.address === null) continue;
    const i = remaining.findIndex((e) => e.address === output.address && output.zat === e.amountZat);
    if (i === -1) unexpected.push(`${output.ref} ${output.zat ?? '?'} zat`);
    else {
      matched.push({ payoutId: remaining[i]!.payoutId, outputRef: output.ref, amountZat: remaining[i]!.amountZat });
      remaining.splice(i, 1);
    }
  }
  add('recipients', 'Every approved payee has exactly one matching output', remaining.length === 0, remaining.length === 0 ? `${matched.length} of ${expected.length} payees matched by address and zatoshi amount` : `${remaining.length} approved payee(s) have no exactly matching output`);
  add('no_unexpected', 'No unexpected recipient outputs', unexpected.length === 0, unexpected.length === 0 ? 'Only approved recipients and wallet change' : `Unexpected: ${unexpected.join('; ')}`);
  const sentTotal = matched.reduce((s, m) => s + m.amountZat, 0n);
  const expectedTotal = expected.reduce((s, e) => s + e.amountZat, 0n);
  add('total', 'Output total equals the approved total', sentTotal === expectedTotal, `${sentTotal} of ${expectedTotal} zat`);
  const conventional = conventionalFeeZat(inspection);
  add('fee', 'Network fee matches the ZIP 317 conventional fee', fee === conventional, fee === null ? 'Fee not reported' : `${fee} zat, expected ${conventional} zat (paid by operator)`);

  return { ok: checks.every((c) => c.pass), feeZat: fee, expiryHeight: inspection.expiry_height ?? null, pool: poolName, checks, matched };
}
