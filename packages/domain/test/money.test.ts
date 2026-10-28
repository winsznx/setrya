import { describe, expect, it } from 'vitest';

import {
  agreementTermsSchema,
  calculatePeriod,
  convertToZat,
  csvCell,
  decToString,
  type EngineEntry,
  type EngineInput,
  type EngineVersion,
  invertRational,
  MoneyError,
  normalizeRows,
  parseCsv,
  parseDec,
  poolCommitment,
  rationalFromDecimal,
  type RateSnapshot,
  startOfDayInZone,
  zecToZat,
  zatToZecString,
} from '../src';

const P_START = new Date('2026-10-01T00:00:00Z');
const P_END = new Date('2026-11-01T00:00:00Z');
const NOW = new Date('2026-11-02T00:00:00Z');

function entry(id: string, amount: string, type: EngineEntry['type'], inclusion: EngineEntry['inclusion'] = 'eligible', currency = 'USD', at = '2026-10-10T12:00:00Z'): EngineEntry {
  return { id, sourceId: 'src', occurredAt: new Date(at), amount: parseDec(amount), currency, type, inclusion, issues: [], fingerprint: `fp-${id}` };
}

function pct(id: string, partnerId: string, ratePct: string, extra: Partial<EngineVersion> = {}): EngineVersion {
  return {
    id,
    agreementId: `ag-${id}`,
    partnerId,
    version: 1,
    sourceIds: ['src'],
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: null,
    terms: agreementTermsSchema.parse({ kind: 'percentage', ratePct }),
    ...extra,
  };
}

const usdRate: RateSnapshot = {
  id: 'rate-1',
  base: 'USD',
  quote: 'ZEC',
  ...rationalFromDecimal('0.02'),
  source: 'TEST FIXTURE, not a market quote',
  quotedAt: new Date('2026-11-01T00:00:00Z'),
  expiresAt: new Date('2026-11-05T00:00:00Z'),
  approvedAt: new Date('2026-11-01T00:00:00Z'),
};

function base(extra: Partial<EngineInput> = {}): EngineInput {
  return {
    periodStart: P_START,
    periodEnd: P_END,
    entries: [entry('fee', '1200.00', 'realised_fee'), entry('vol', '20000.00', 'gross_volume', 'excluded'), entry('ref', '-50.00', 'refund')],
    versions: [pct('a', 'pa', '20'), pct('b', 'pb', '10')],
    partners: [
      { id: 'pa', active: true, payability: 'ok' },
      { id: 'pb', active: true, payability: 'ok' },
    ],
    rates: { USD: usdRate },
    now: NOW,
    ...extra,
  };
}

describe('canonical example (PRD 11.5)', () => {
  const result = calculatePeriod(base());
  const owed = (partner: string) => decToString(result.rows.find((r) => r.partnerId === partner)!.owed);

  it('M01 20% of 1,150.00 USD is exactly 230', () => expect(owed('pa')).toBe('230'));
  it('M02 10% of 1,150.00 USD is exactly 115', () => expect(owed('pb')).toBe('115'));
  it('M03 eligible base is 1,150 not 21,150', () => {
    expect(result.rows[0]!.formula.base).toBe('1150');
    expect(result.totals.excludedByCurrency.USD).toBe('20000');
  });
  it('converts with the approved snapshot and rounds down', () => {
    expect(result.rows.find((r) => r.partnerId === 'pa')!.zat).toBe(460_000_000n);
    expect(result.totals.payableZat).toBe('690000000');
  });
});

describe('exact arithmetic', () => {
  it('M04 never adds USD and ZEC', () => {
    const r = calculatePeriod(base({ entries: [entry('u', '100', 'realised_fee'), entry('z', '2', 'realised_fee', 'eligible', 'ZEC')] }));
    const aRows = r.rows.filter((x) => x.partnerId === 'pa');
    expect(aRows.map((x) => x.currency).sort()).toEqual(['USD', 'ZEC']);
    expect(r.totals.eligibleByCurrency).toEqual({ USD: '100', ZEC: '2' });
  });
  it('M05 rejects more than 8 ZEC decimals', () => {
    expect(() => zecToZat('0.123456789')).toThrow(MoneyError);
  });
  it('M06 keeps zatoshi precision', () => {
    expect(zecToZat('20999999.99999999')).toBe(2_099_999_999_999_999n);
    expect(zatToZecString(2_099_999_999_999_999n)).toBe('20999999.99999999');
  });
  it('M07 refunds exceeding fees produce a credit, never a negative transfer', () => {
    const r = calculatePeriod(base({ entries: [entry('f', '10', 'realised_fee'), entry('r', '-50', 'refund')] }));
    const row = r.rows.find((x) => x.partnerId === 'pa')!;
    expect(row.status).toBe('credit');
    expect(row.zat).toBeNull();
    expect(r.totals.payableZat).toBe('0');
  });
  it('M08 fixed ZEC needs no price', () => {
    const fixed: EngineVersion = { ...pct('f', 'pa', '1'), terms: agreementTermsSchema.parse({ kind: 'fixed', amount: '1', currency: 'ZEC' }) };
    const r = calculatePeriod(base({ versions: [fixed], rates: {} }));
    expect(r.rows[0]!.zat).toBe(100_000_000n);
    expect(r.rows[0]!.status).toBe('payable');
  });
  it('M09 USD with no rate is held RATE_REQUIRED', () => {
    const r = calculatePeriod(base({ rates: {} }));
    expect(r.rows.every((x) => x.status === 'held' && x.holds.some((h) => h.code === 'RATE_REQUIRED'))).toBe(true);
  });
  it('M10 expired rate holds', () => {
    const r = calculatePeriod(base({ now: new Date('2026-12-01T00:00:00Z') }));
    expect(r.rows[0]!.holds.map((h) => h.code)).toContain('RATE_EXPIRED');
  });
  it('M11 a later rate does not change a stored calculation', () => {
    const before = calculatePeriod(base());
    const frozen = JSON.stringify(before.rows.map((x) => x.formula));
    calculatePeriod(base({ rates: { USD: { ...usdRate, id: 'rate-2', ...rationalFromDecimal('0.03') } } }));
    expect(JSON.stringify(before.rows.map((x) => x.formula))).toBe(frozen);
  });
  it('M12 residuals are itemised and output sum equals displayed total', () => {
    const third: RateSnapshot = { ...usdRate, numerator: 1n, denominator: 3n };
    const r = calculatePeriod(base({ entries: [entry('f', '1', 'realised_fee')], versions: [pct('a', 'pa', '33.3333'), pct('b', 'pb', '33.3333'), pct('c', 'pc', '33.3333')], partners: ['pa', 'pb', 'pc'].map((id) => ({ id, active: true, payability: 'ok' as const })), rates: { USD: third }, minPayoutZat: 1n }));
    const sumZat = r.rows.reduce((s, x) => s + (x.zat ?? 0n), 0n);
    expect(sumZat.toString()).toBe(r.totals.payableZat);
    expect(r.rows.every((x) => x.residualZat !== null)).toBe(true);
  });
  it('M13 overlapping agreements for one partner are flagged, not double applied', () => {
    const r = calculatePeriod(base({ versions: [pct('a', 'pa', '20'), pct('a2', 'pa', '5')] }));
    expect(r.exceptions.map((e) => e.code)).toContain('AGREEMENT_OVERLAP');
    expect(r.rows.every((x) => x.status === 'held')).toBe(true);
  });
  it('M13 version date slicing splits the base', () => {
    const v1 = pct('v1', 'pa', '20', { agreementId: 'ag', effectiveTo: new Date('2026-10-15T00:00:00Z') });
    const v2 = pct('v2', 'pa', '30', { agreementId: 'ag', version: 2, effectiveFrom: new Date('2026-10-15T00:00:00Z') });
    const r = calculatePeriod(base({ versions: [v1, v2], entries: [entry('e1', '100', 'realised_fee', 'eligible', 'USD', '2026-10-05T00:00:00Z'), entry('e2', '100', 'realised_fee', 'eligible', 'USD', '2026-10-20T00:00:00Z')] }));
    expect(r.rows.map((x) => decToString(x.owed))).toEqual(['20', '30']);
  });
  it('M14 a held duplicate blocks rows depending on the base', () => {
    const dup = { ...entry('d', '100', 'realised_fee', 'held'), issues: ['DUPLICATE_EXISTING' as const] };
    const r = calculatePeriod(base({ entries: [entry('f', '100', 'realised_fee'), dup] }));
    expect(r.exceptions.find((e) => e.code === 'DUPLICATE_REFERENCE')?.severity).toBe('blocking');
    expect(r.rows.every((x) => x.holds.some((h) => h.code === 'UNRESOLVED_SOURCE_ROW'))).toBe(true);
    expect(r.rows[0]!.formula.base).toBe('100');
  });
  it('M15 duplicate external ids in a file are held', () => {
    const csv = parseCsv('external_id,occurred_at,amount\nA,2026-10-01,10\nA,2026-10-02,10\n');
    const rows = normalizeRows(csv.header, csv.rows, { mapping: { externalId: 0, date: 1, amount: 2 }, timeZone: 'UTC', dateFormat: 'iso', decimalSeparator: '.', defaultCurrency: 'USD', defaultType: 'realised_fee', existingExternalIds: new Set() });
    expect(rows.every((r) => r.suggested === 'held')).toBe(true);
    const again = normalizeRows(csv.header, [csv.rows[0]!], { mapping: { externalId: 0, date: 1, amount: 2 }, timeZone: 'UTC', dateFormat: 'iso', decimalSeparator: '.', defaultCurrency: 'USD', defaultType: 'realised_fee', existingExternalIds: new Set(['A']) });
    expect(again[0]!.issues).toContain('DUPLICATE_EXISTING');
  });
  it('M16 formula cells are neutralised on export', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(csvCell('-50.00', { numeric: true })).toBe('-50.00');
  });
  it('M17 excluding an eligible fee changes the base', () => {
    const r = calculatePeriod(base({ entries: [entry('f', '1200', 'realised_fee', 'excluded'), entry('g', '100', 'realised_fee')] }));
    expect(r.rows[0]!.formula.base).toBe('100');
  });
  it('M19 exclusive pool over 100% is blocked', () => {
    const r = calculatePeriod(base({ versions: [pct('a', 'pa', '60'), pct('b', 'pb', '50')] }));
    expect(r.exceptions.map((e) => e.code)).toContain('OVERCOMMITTED_POOL');
  });
  it('M20 independent obligations over 100% need acknowledgement', () => {
    const ind = (id: string, p: string, rate: string, ack: boolean) => ({ ...pct(id, p, rate), terms: agreementTermsSchema.parse({ kind: 'percentage', ratePct: rate, poolSemantics: 'independent', overcommitAcknowledged: ack }) });
    const a = ind('a', 'pa', '60', false);
    const b = ind('b', 'pb', '50', false);
    expect(poolCommitment([b], a)[0]!.independentUnacknowledged).toBe(true);
    const r = calculatePeriod(base({ versions: [ind('a', 'pa', '60', true), ind('b', 'pb', '50', true)] }));
    expect(r.exceptions.map((e) => e.code)).not.toContain('OVERCOMMITTED_POOL');
  });
  it('M21 huge rationals do not overflow', () => {
    const c = convertToZat(parseDec('99999999.99999999'), { base: 'USD', quote: 'ZEC', numerator: 123456789012345678901234567890n, denominator: 987654321098765432109876543210n }, 'USD');
    expect(c.zat).toBe(1249999988609374n);
  });
  it('M22 a midnight boundary belongs to one period only', () => {
    const atEnd = entry('m', '100', 'realised_fee', 'eligible', 'USD', '2026-11-01T00:00:00Z');
    const oct = calculatePeriod(base({ entries: [atEnd] }));
    const nov = calculatePeriod(base({ entries: [atEnd], periodStart: P_END, periodEnd: new Date('2026-12-01T00:00:00Z') }));
    expect(oct.totals.sourceByCurrency.USD).toBeUndefined();
    expect(nov.totals.sourceByCurrency.USD).toBe('100');
  });
  it('M23 DST boundaries resolve to correct UTC instants', () => {
    expect(startOfDayInZone('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfDayInZone('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
  it('M24 a ZEC/USD snapshot cannot convert USD without explicit inversion', () => {
    const wrong = { base: 'ZEC', quote: 'USD', ...rationalFromDecimal('50') };
    expect(() => convertToZat(parseDec('100'), wrong, 'USD')).toThrow(MoneyError);
    const inverted = { base: 'USD', quote: 'ZEC', ...invertRational(rationalFromDecimal('50')) };
    expect(convertToZat(parseDec('100'), inverted, 'USD').zat).toBe(200_000_000n);
  });
  it('below-minimum payouts are held, not rounded to zero', () => {
    const r = calculatePeriod(base({ entries: [entry('f', '0.01', 'realised_fee')] }));
    expect(r.rows[0]!.holds.map((h) => h.code)).toContain('BELOW_MINIMUM');
  });
  it('missing address holds the row even if everything else is fine', () => {
    const r = calculatePeriod(base({ partners: [{ id: 'pa', active: true, payability: 'ADDRESS_MISSING' }, { id: 'pb', active: true, payability: 'ok' }] }));
    expect(r.rows.find((x) => x.partnerId === 'pa')!.status).toBe('held');
    expect(r.rows.find((x) => x.partnerId === 'pb')!.status).toBe('payable');
  });
});

describe('import classification', () => {
  it('flags gross volume and mislabelled volume', () => {
    const csv = parseCsv('external_id,occurred_at,description,amount,currency,fee_type\n1,2026-10-01,Creator fees,1200.00,USD,realised_fee\n2,2026-10-01,Trading volume,20000.00,USD,realised_fee\n3,2026-10-02,Refund,-50.00,USD,refund\n4,2026-10-02,Gross volume,5000,USD,gross_volume\n');
    const rows = normalizeRows(csv.header, csv.rows, { mapping: { externalId: 0, date: 1, description: 2, amount: 3, currency: 4, type: 5 }, timeZone: 'UTC', dateFormat: 'iso', decimalSeparator: '.', defaultCurrency: 'USD', defaultType: 'realised_fee', existingExternalIds: new Set() });
    expect(rows.map((r) => r.suggested)).toEqual(['eligible', 'held', 'held', 'excluded']);
    expect(rows[1]!.issues).toContain('VOLUME_MISLABELED');
  });
});
