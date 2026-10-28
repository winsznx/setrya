import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { type AgreementTerms, includedTypes, type PercentageTerms, poolCommitment, windowsOverlap } from './agreements';
import { cmp, type Dec, decToString, floorTo, isNegative, isZero, min, mul, parseDec, shift, sum, ZERO } from './money';
import { checkRate, convertToZat, type RateProblem, type RateSnapshot } from './rates';
import type { Classification, EntryType, IssueCode } from './revenue';
import { inHalfOpen } from './time';

/** Bumped whenever the formula changes, so frozen snapshots record which engine produced them. */
export const FORMULA_VERSION = 'setrya-calc-1';

/** Payouts below this are held rather than sent, because the ZIP 317 fee would rival the amount. */
export const DEFAULT_MIN_PAYOUT_ZAT = 10_000n;

export interface EngineEntry {
  id: string;
  sourceId: string;
  occurredAt: Date;
  amount: Dec;
  currency: string;
  type: EntryType;
  /** The period's effective inclusion after the operator's decisions. */
  inclusion: Classification;
  issues: readonly IssueCode[];
  fingerprint: string;
}

export interface EngineVersion {
  id: string;
  agreementId: string;
  partnerId: string;
  version: number;
  sourceIds: readonly string[];
  effectiveFrom: Date;
  effectiveTo: Date | null;
  terms: AgreementTerms;
}

export type PartnerPayability = 'ok' | 'ADDRESS_MISSING' | 'ADDRESS_UNSUPPORTED' | 'ADDRESS_UNCONFIRMED' | 'ADDRESS_WRONG_NETWORK';

export interface EnginePartner {
  id: string;
  active: boolean;
  payability: PartnerPayability;
}

export interface EngineInput {
  periodStart: Date;
  periodEnd: Date;
  entries: readonly EngineEntry[];
  versions: readonly EngineVersion[];
  partners: readonly EnginePartner[];
  rates: Readonly<Record<string, RateSnapshot | undefined>>;
  now: Date;
  minPayoutZat?: bigint;
  /** Row keys the operator explicitly held. */
  heldRows?: ReadonlyMap<string, string>;
  /** Default currency per source, used to label a row when no entries matched. */
  sourceCurrencies?: Readonly<Record<string, string>>;
  /** Overlap exception keys the operator confirmed as intentional. */
  confirmedOverlaps?: ReadonlySet<string>;
}

export type HoldCode =
  | 'UNRESOLVED_SOURCE_ROW'
  | 'RATE_REQUIRED'
  | 'RATE_EXPIRED'
  | 'RATE_UNAPPROVED'
  | 'RATE_ORIENTATION'
  | 'ADDRESS_MISSING'
  | 'ADDRESS_UNSUPPORTED'
  | 'ADDRESS_UNCONFIRMED'
  | 'ADDRESS_WRONG_NETWORK'
  | 'OVERCOMMITTED_POOL'
  | 'AGREEMENT_OVERLAP'
  | 'AGREEMENT_DATE_MISMATCH'
  | 'BELOW_MINIMUM'
  | 'NEGATIVE_NET'
  | 'OPERATOR_HOLD';

export const HOLD_TEXT: Record<HoldCode, string> = {
  UNRESOLVED_SOURCE_ROW: 'A source row in this fee base needs a decision',
  RATE_REQUIRED: 'No approved conversion rate to ZEC',
  RATE_EXPIRED: 'The conversion rate expired',
  RATE_UNAPPROVED: 'The conversion rate is not approved',
  RATE_ORIENTATION: 'The rate is set in the wrong direction',
  ADDRESS_MISSING: 'Partner has no payout address',
  ADDRESS_UNSUPPORTED: 'Payout address cannot receive a fully shielded payment',
  ADDRESS_UNCONFIRMED: 'Payout address not confirmed with the recipient',
  ADDRESS_WRONG_NETWORK: 'Payout address is for a different network',
  OVERCOMMITTED_POOL: 'Exclusive agreements on this source exceed 100%',
  AGREEMENT_OVERLAP: 'Two agreements pay this partner from the same fees',
  AGREEMENT_DATE_MISMATCH: 'More than one fixed version covers this period',
  BELOW_MINIMUM: 'Amount is below the minimum useful payout',
  NEGATIVE_NET: 'Refunds exceed fees, carried forward as a credit',
  OPERATOR_HOLD: 'Held by the operator',
};

export interface FormulaTrail {
  kind: AgreementTerms['kind'];
  windowStart: string;
  windowEnd: string;
  eligibleEntryCount: number;
  base: string | null;
  ratePct: string | null;
  uncapped: string;
  cap: string | null;
  owed: string;
  rate: { snapshotId: string; numerator: string; denominator: string; base: string; quote: string } | null;
  zat: string | null;
  residualZat: string | null;
  formulaVersion: string;
}

export type RowStatus = 'payable' | 'held' | 'credit' | 'nothing_owed';

export interface CalcRow {
  key: string;
  partnerId: string;
  agreementId: string;
  agreementVersionId: string;
  currency: string;
  sourceEntryIds: string[];
  sourceIdsHash: string;
  base: Dec | null;
  owed: Dec;
  zat: bigint | null;
  residualZat: Dec | null;
  rateSnapshotId: string | null;
  status: RowStatus;
  holds: { code: HoldCode; detail?: string }[];
  formula: FormulaTrail;
}

export type ExceptionCode =
  | 'VOLUME_NOT_FEES'
  | 'DUPLICATE_REFERENCE'
  | 'REFUND_REVIEW'
  | 'UNRESOLVED_SOURCE_ROW'
  | 'AGREEMENT_OVERLAP'
  | 'AGREEMENT_DATE_MISMATCH'
  | 'RATE_MISSING'
  | 'ADDRESS_INVALID'
  | 'OVERCOMMITTED_POOL'
  | 'BELOW_MINIMUM'
  | 'NEGATIVE_NET';

export const EXCEPTION_TITLE: Record<ExceptionCode, string> = {
  VOLUME_NOT_FEES: 'Source row appears to represent volume, not earned fees',
  DUPLICATE_REFERENCE: 'Duplicate external reference',
  REFUND_REVIEW: 'Refund reverses prior fee',
  UNRESOLVED_SOURCE_ROW: 'Source row needs classification',
  AGREEMENT_OVERLAP: 'Agreements overlap for the same partner and fees',
  AGREEMENT_DATE_MISMATCH: 'Agreement date mismatch',
  RATE_MISSING: 'Source currency missing rate',
  ADDRESS_INVALID: 'Missing or invalid shielded address',
  OVERCOMMITTED_POOL: 'Overcommitted payout pool',
  BELOW_MINIMUM: 'Payout below minimum',
  NEGATIVE_NET: 'Net amount is negative',
};

export interface EngineException {
  key: string;
  code: ExceptionCode;
  severity: 'blocking' | 'warning';
  entryIds: string[];
  rowKeys: string[];
  partnerId: string | null;
  moneyAtRisk: { amount: string; currency: string } | null;
  detail: string;
}

export interface EngineResult {
  rows: CalcRow[];
  exceptions: EngineException[];
  totals: {
    sourceByCurrency: Record<string, string>;
    eligibleByCurrency: Record<string, string>;
    excludedByCurrency: Record<string, string>;
    heldByCurrency: Record<string, string>;
    owedByCurrency: Record<string, string>;
    payableZat: string;
    payableCount: number;
    heldCount: number;
  };
}

function hashIds(ids: readonly string[]): string {
  return bytesToHex(sha256(utf8ToBytes([...ids].sort().join('\n'))));
}

function addTo(map: Map<string, Dec[]>, currency: string, amount: Dec): void {
  const list = map.get(currency) ?? [];
  list.push(amount);
  map.set(currency, list);
}

function totalsOf(map: Map<string, Dec[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [currency, list] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) out[currency] = decToString(sum(list));
  return out;
}

function windowFor(version: EngineVersion, start: Date, end: Date): { start: Date; end: Date } | null {
  const s = Math.max(start.getTime(), version.effectiveFrom.getTime());
  const e = Math.min(end.getTime(), version.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY);
  return s < e ? { start: new Date(s), end: new Date(e) } : null;
}

function exceptionCodeForEntry(entry: EngineEntry): ExceptionCode {
  if (entry.issues.includes('VOLUME_MISLABELED') || entry.type === 'gross_volume') return 'VOLUME_NOT_FEES';
  if (entry.issues.includes('DUPLICATE_EXISTING') || entry.issues.includes('DUPLICATE_IN_FILE')) return 'DUPLICATE_REFERENCE';
  if (entry.type === 'refund' || entry.type === 'chargeback') return 'REFUND_REVIEW';
  return 'UNRESOLVED_SOURCE_ROW';
}

const RATE_HOLD: Record<RateProblem, HoldCode> = {
  RATE_REQUIRED: 'RATE_REQUIRED',
  RATE_EXPIRED: 'RATE_EXPIRED',
  RATE_UNAPPROVED: 'RATE_UNAPPROVED',
  RATE_ORIENTATION: 'RATE_ORIENTATION',
};

/**
 * Deterministic settlement calculation. Same inputs, same rows: no clock reads except `input.now`, no floating
 * point, and entries are consumed at most once per agreement version and period.
 */
export function calculatePeriod(input: EngineInput): EngineResult {
  const minPayout = input.minPayoutZat ?? DEFAULT_MIN_PAYOUT_ZAT;
  const partners = new Map(input.partners.map((p) => [p.id, p]));
  const inPeriod = input.entries.filter((e) => inHalfOpen(e.occurredAt, input.periodStart, input.periodEnd));
  const rows: CalcRow[] = [];
  const exceptions = new Map<string, EngineException>();
  const addException = (ex: EngineException) => {
    const existing = exceptions.get(ex.key);
    if (existing) {
      existing.rowKeys = [...new Set([...existing.rowKeys, ...ex.rowKeys])];
      existing.entryIds = [...new Set([...existing.entryIds, ...ex.entryIds])];
    } else exceptions.set(ex.key, ex);
  };

  const sourceTotals = new Map<string, Dec[]>();
  const eligibleTotals = new Map<string, Dec[]>();
  const excludedTotals = new Map<string, Dec[]>();
  const heldTotals = new Map<string, Dec[]>();
  for (const entry of inPeriod) {
    addTo(sourceTotals, entry.currency, entry.amount);
    if (entry.inclusion === 'eligible') addTo(eligibleTotals, entry.currency, entry.amount);
    else if (entry.inclusion === 'excluded') addTo(excludedTotals, entry.currency, entry.amount);
    else addTo(heldTotals, entry.currency, entry.amount);
  }

  const activeVersions = input.versions
    .filter((v) => partners.get(v.partnerId)?.active !== false)
    .filter((v) => windowFor(v, input.periodStart, input.periodEnd) !== null)
    .sort((a, b) => a.agreementId.localeCompare(b.agreementId) || a.version - b.version);

  // Overcommitted exclusive pools.
  const overcommitted = new Set<string>();
  for (const v of activeVersions) {
    const members = activeVersions.filter((m) => m.id !== v.id).map((m) => ({ ...m, agreementId: m.agreementId }));
    for (const result of poolCommitment(members, v)) {
      if (result.overcommitted || result.independentUnacknowledged) overcommitted.add(v.id);
    }
  }

  // Same partner, same source, different agreements, overlapping windows.
  const overlapKeys = new Map<string, string>();
  for (const a of activeVersions) {
    for (const b of activeVersions) {
      if (a.agreementId >= b.agreementId || a.partnerId !== b.partnerId) continue;
      if (!a.sourceIds.some((s) => b.sourceIds.includes(s)) || !windowsOverlap(a, b)) continue;
      const key = `AGREEMENT_OVERLAP:${a.id}:${b.id}`;
      if (input.confirmedOverlaps?.has(key)) continue;
      overlapKeys.set(a.id, key);
      overlapKeys.set(b.id, key);
    }
  }

  // Fixed agreements with more than one version touching the period.
  const fixedVersionsByAgreement = new Map<string, EngineVersion[]>();
  for (const v of activeVersions) {
    if (v.terms.kind !== 'fixed') continue;
    fixedVersionsByAgreement.set(v.agreementId, [...(fixedVersionsByAgreement.get(v.agreementId) ?? []), v]);
  }

  for (const version of activeVersions) {
    const window = windowFor(version, input.periodStart, input.periodEnd)!;
    const partner = partners.get(version.partnerId);
    const terms = version.terms;
    const groups = new Map<string, { eligible: EngineEntry[]; blocking: EngineEntry[] }>();

    if (terms.kind === 'percentage') {
      const types = includedTypes(terms);
      for (const entry of inPeriod) {
        if (!version.sourceIds.includes(entry.sourceId) || !inHalfOpen(entry.occurredAt, window.start, window.end)) continue;
        const group = groups.get(entry.currency) ?? { eligible: [], blocking: [] };
        if (entry.inclusion === 'held') group.blocking.push(entry);
        else if (entry.inclusion === 'eligible' && types.has(entry.type)) group.eligible.push(entry);
        groups.set(entry.currency, group);
      }
      if (groups.size === 0) {
        const fallback = version.sourceIds.map((id) => input.sourceCurrencies?.[id]).find((c) => c !== undefined) ?? 'ZEC';
        groups.set(fallback, { eligible: [], blocking: [] });
      }
    } else {
      groups.set(terms.currency, { eligible: [], blocking: [] });
    }

    for (const [currency, group] of groups) {
      const key = `${version.id}:${currency}`;
      const holds: { code: HoldCode; detail?: string }[] = [];
      let base: Dec | null = null;
      let uncapped: Dec;
      let owed: Dec;
      let capText: string | null = null;

      if (terms.kind === 'percentage') {
        base = sum(group.eligible.map((e) => e.amount));
        const rate = parseDec((terms as PercentageTerms).ratePct, 4);
        uncapped = shift(mul(base, rate), 2);
        owed = uncapped;
        if (terms.cap && terms.cap.currency === currency) {
          const cap = parseDec(terms.cap.amount, 8);
          owed = min(uncapped, cap);
          capText = decToString(cap);
        }
        for (const blocked of group.blocking) {
          const code = exceptionCodeForEntry(blocked);
          addException({
            key: `${code}:${blocked.id}`,
            code,
            severity: 'blocking',
            entryIds: [blocked.id],
            rowKeys: [key],
            partnerId: null,
            moneyAtRisk: { amount: decToString(blocked.amount), currency: blocked.currency },
            detail: 'Every agreement that draws on this fee base waits until the row is classified.',
          });
        }
        if (group.blocking.length > 0) holds.push({ code: 'UNRESOLVED_SOURCE_ROW', detail: `${group.blocking.length} row(s)` });
      } else {
        uncapped = parseDec(terms.amount, 8);
        owed = uncapped;
        const siblings = fixedVersionsByAgreement.get(version.agreementId) ?? [];
        if (siblings.length > 1) {
          holds.push({ code: 'AGREEMENT_DATE_MISMATCH' });
          addException({
            key: `AGREEMENT_DATE_MISMATCH:${version.agreementId}`,
            code: 'AGREEMENT_DATE_MISMATCH',
            severity: 'blocking',
            entryIds: [],
            rowKeys: [key],
            partnerId: version.partnerId,
            moneyAtRisk: { amount: terms.amount, currency: terms.currency },
            detail: 'Fixed amounts are owed once per period, but more than one version covers these dates.',
          });
        }
      }

      if (overcommitted.has(version.id)) {
        holds.push({ code: 'OVERCOMMITTED_POOL' });
        addException({
          key: `OVERCOMMITTED_POOL:${version.sourceIds.join(',')}`,
          code: 'OVERCOMMITTED_POOL',
          severity: 'blocking',
          entryIds: [],
          rowKeys: [key],
          partnerId: null,
          moneyAtRisk: { amount: decToString(owed), currency },
          detail: 'Revise the agreements so exclusive shares total 100% or less, or mark them as independent obligations.',
        });
      }
      const overlapKey = overlapKeys.get(version.id);
      if (overlapKey !== undefined) {
        holds.push({ code: 'AGREEMENT_OVERLAP' });
        addException({
          key: overlapKey,
          code: 'AGREEMENT_OVERLAP',
          severity: 'blocking',
          entryIds: [],
          rowKeys: [key],
          partnerId: version.partnerId,
          moneyAtRisk: { amount: decToString(owed), currency },
          detail: 'Both agreements would pay this partner from the same fees. Confirm both are intended or hold one.',
        });
      }

      let status: RowStatus = 'payable';
      let zat: bigint | null = null;
      let residual: Dec | null = null;
      let rateSnapshotId: string | null = null;
      let rateTrail: FormulaTrail['rate'] = null;

      if (isNegative(owed)) {
        status = 'credit';
        holds.push({ code: 'NEGATIVE_NET' });
        addException({
          key: `NEGATIVE_NET:${key}`,
          code: 'NEGATIVE_NET',
          severity: 'warning',
          entryIds: group.eligible.map((e) => e.id),
          rowKeys: [key],
          partnerId: version.partnerId,
          moneyAtRisk: { amount: decToString(owed), currency },
          detail: 'No negative payment is ever sent. The credit carries forward when the period closes.',
        });
      } else if (isZero(owed)) {
        status = 'nothing_owed';
      } else if (currency === 'ZEC') {
        const floored = floorTo(owed, 8);
        zat = floored.value.units;
        residual = mul(floored.remainder, parseDec('100000000'));
      } else {
        const snapshot = input.rates[currency];
        const problem = checkRate(snapshot, currency, input.now);
        if (problem !== null) {
          holds.push({ code: RATE_HOLD[problem] });
          addException({
            key: `RATE_MISSING:${currency}`,
            code: 'RATE_MISSING',
            severity: 'blocking',
            entryIds: [],
            rowKeys: [key],
            partnerId: null,
            moneyAtRisk: { amount: decToString(owed), currency },
            detail: `Add an approved ${currency} to ZEC rate snapshot. Setrya never fetches or invents a price.`,
          });
        } else {
          const conversion = convertToZat(owed, snapshot!, currency);
          zat = conversion.zat;
          residual = conversion.residualZat;
          rateSnapshotId = snapshot!.id;
          rateTrail = { snapshotId: snapshot!.id, numerator: snapshot!.numerator.toString(), denominator: snapshot!.denominator.toString(), base: snapshot!.base, quote: snapshot!.quote };
        }
      }

      if (status === 'payable' && zat !== null && zat < minPayout) {
        holds.push({ code: 'BELOW_MINIMUM' });
        addException({
          key: `BELOW_MINIMUM:${key}`,
          code: 'BELOW_MINIMUM',
          severity: 'warning',
          entryIds: [],
          rowKeys: [key],
          partnerId: version.partnerId,
          moneyAtRisk: { amount: decToString(owed), currency },
          detail: 'Held instead of rounding to zero. It can carry forward to a later period.',
        });
      }

      if (status === 'payable' && partner !== undefined && partner.payability !== 'ok') {
        holds.push({ code: partner.payability });
        addException({
          key: `ADDRESS_INVALID:${partner.id}`,
          code: 'ADDRESS_INVALID',
          severity: 'blocking',
          entryIds: [],
          rowKeys: [key],
          partnerId: partner.id,
          moneyAtRisk: { amount: decToString(owed), currency },
          detail: HOLD_TEXT[partner.payability],
        });
      }

      const operatorHold = input.heldRows?.get(key);
      if (operatorHold !== undefined) holds.push({ code: 'OPERATOR_HOLD', detail: operatorHold });
      if (status === 'payable' && holds.length > 0) status = 'held';

      const sourceEntryIds = group.eligible.map((e) => e.id).sort();
      rows.push({
        key,
        partnerId: version.partnerId,
        agreementId: version.agreementId,
        agreementVersionId: version.id,
        currency,
        sourceEntryIds,
        sourceIdsHash: hashIds(group.eligible.map((e) => e.fingerprint)),
        base,
        owed,
        zat,
        residualZat: residual,
        rateSnapshotId,
        status,
        holds,
        formula: {
          kind: terms.kind,
          windowStart: window.start.toISOString(),
          windowEnd: window.end.toISOString(),
          eligibleEntryCount: group.eligible.length,
          base: base === null ? null : decToString(base),
          ratePct: terms.kind === 'percentage' ? terms.ratePct : null,
          uncapped: decToString(uncapped),
          cap: capText,
          owed: decToString(owed),
          rate: rateTrail,
          zat: zat === null ? null : zat.toString(),
          residualZat: residual === null ? null : decToString(residual),
          formulaVersion: FORMULA_VERSION,
        },
      });
    }
  }

  // Held entries outside any agreement still need a decision before close, but block nothing.
  for (const entry of inPeriod) {
    if (entry.inclusion !== 'held') continue;
    const code = exceptionCodeForEntry(entry);
    const key = `${code}:${entry.id}`;
    if (!exceptions.has(key)) {
      addException({
        key,
        code,
        severity: 'warning',
        entryIds: [entry.id],
        rowKeys: [],
        partnerId: null,
        moneyAtRisk: { amount: decToString(entry.amount), currency: entry.currency },
        detail: 'No agreement in this period uses this row yet.',
      });
    }
  }

  const owedTotals = new Map<string, Dec[]>();
  let payableZat = 0n;
  let payableCount = 0;
  let heldCount = 0;
  for (const row of rows) {
    if (row.status !== 'nothing_owed') addTo(owedTotals, row.currency, row.owed);
    if (row.status === 'payable' && row.zat !== null) {
      payableZat += row.zat;
      payableCount += 1;
    } else if (row.status === 'held' || row.status === 'credit') heldCount += 1;
  }

  return {
    rows,
    exceptions: [...exceptions.values()].sort((a, b) => (a.severity === b.severity ? a.key.localeCompare(b.key) : a.severity === 'blocking' ? -1 : 1)),
    totals: {
      sourceByCurrency: totalsOf(sourceTotals),
      eligibleByCurrency: totalsOf(eligibleTotals),
      excludedByCurrency: totalsOf(excludedTotals),
      heldByCurrency: totalsOf(heldTotals),
      owedByCurrency: totalsOf(owedTotals),
      payableZat: payableZat.toString(),
      payableCount,
      heldCount,
    },
  };
}

export { ZERO, cmp };
