import type { StatementDocument } from '@setrya/api/contract';

import { sampleCalculation } from './sample';

/** A sample statement document for display only. Status is "approved, not paid": no sample ever claims a payment. */
export function sampleStatement(): StatementDocument {
  const row = sampleCalculation().rows.find((r) => r.partnerId === 'pb')!;
  return {
    id: 'sample',
    reference: 'ST-SAMPLE0001',
    documentVersion: 1,
    generatedAt: '2026-11-01T12:00:00Z',
    issuer: { label: 'Sample Studio Ltd', org: 'Sample Studio', project: 'Sample launch', logo: null },
    recipientLabel: 'Creator Bo',
    period: { label: 'October creator fees (sample)', startAt: '2026-10-01T00:00:00Z', endAt: '2026-11-01T00:00:00Z', timezone: 'UTC' },
    sources: ['Creator fees'],
    lines: [{ agreementTitle: 'Creator share', agreementVersion: 1, rule: '10% of eligible realised fees after refunds', currency: 'USD', eligibleBase: row.formula.base, owed: row.formula.owed, rateDescription: '1 USD = 0.02 ZEC', rateQuotedAt: '2026-10-31T12:00:00Z', rateSource: 'sample rate, not a market quote', zat: row.zat?.toString() ?? null, formula: row.formula, held: [] }],
    totals: { owedByCurrency: { USD: row.formula.owed }, zat: row.zat?.toString() ?? null },
    payment: { status: 'approved_not_paid', txState: null, txid: null, confirmations: 0, targetConfirmations: 3, confirmedAt: null, network: 'testnet', walletObserved: false, memoRef: 'STR-SAMPLE' },
    acknowledgment: null,
    issuerNote: 'Sample document. Illustrative data, not a real payment or statement.',
  };
}
