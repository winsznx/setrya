/**
 * Illustrative sample data for public pages and the demo. Labelled SAMPLE DATA wherever it appears. It is computed
 * with the real engine so the arithmetic is honest, but it is not a real business, payment or market rate.
 */
import { calculatePeriod, type EngineInput, parseDec, rationalFromDecimal } from '@setrya/domain';

export const SAMPLE_RATE = { id: 'sample-rate', base: 'USD', quote: 'ZEC', ...rationalFromDecimal('0.02'), source: 'Sample rate, not a market quote', quotedAt: new Date('2026-10-31T12:00:00Z'), expiresAt: new Date('2099-01-01T00:00:00Z'), approvedAt: new Date('2026-10-31T12:00:00Z') };

export const SAMPLE_ROWS = [
  { id: 's1', ref: 'FEE-4401', label: 'Creator fees, week 40', amount: '1200.00', type: 'realised_fee' as const, inclusion: 'eligible' as const, note: '' },
  { id: 's2', ref: 'VOL-4402', label: 'Trading volume, week 40', amount: '20000.00', type: 'gross_volume' as const, inclusion: 'excluded' as const, note: 'Volume is not fees earned' },
  { id: 's3', ref: 'RFD-4403', label: 'Refund of disputed launch fee', amount: '-50.00', type: 'refund' as const, inclusion: 'eligible' as const, note: 'Nets against this period' },
];

export const SAMPLE_PARTNERS = [
  { id: 'pa', name: 'Promoter Ana', ratePct: '20' },
  { id: 'pb', name: 'Creator Bo', ratePct: '10' },
  { id: 'pc', name: 'Studio Cy', ratePct: '5' },
];

export function sampleCalculation() {
  const input: EngineInput = {
    periodStart: new Date('2026-10-01T00:00:00Z'),
    periodEnd: new Date('2026-11-01T00:00:00Z'),
    entries: SAMPLE_ROWS.map((r) => ({ id: r.id, sourceId: 'src', occurredAt: new Date('2026-10-10T00:00:00Z'), amount: parseDec(r.amount), currency: 'USD', type: r.type, inclusion: r.inclusion, issues: [], fingerprint: r.id })),
    versions: SAMPLE_PARTNERS.map((p) => ({ id: `v-${p.id}`, agreementId: `a-${p.id}`, partnerId: p.id, version: 1, sourceIds: ['src'], effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, terms: { kind: 'percentage' as const, ratePct: p.ratePct, refundTreatment: 'net_adjustment' as const, cap: null, poolSemantics: 'exclusive' as const, overcommitAcknowledged: false, conversionBasis: 'rate_snapshot' as const, basisDefinition: '', exclusions: '', cadence: 'per_period' as const, notes: '' } })),
    partners: SAMPLE_PARTNERS.map((p) => ({ id: p.id, active: true, payability: p.id === 'pc' ? ('ADDRESS_MISSING' as const) : ('ok' as const) })),
    rates: { USD: SAMPLE_RATE },
    now: new Date('2026-11-01T00:00:00Z'),
  };
  return calculatePeriod(input);
}
