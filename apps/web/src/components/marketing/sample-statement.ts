import type { StatementCommitment, StatementDocument } from '@setrya/api/contract';
import { buildPayoutTree, formatCommitmentMemo, type PayoutLeaf } from '@setrya/domain';

import { SAMPLE_PARTNERS, sampleCalculation } from './sample';

/** Statement references for the sample partners, used as each leaf's partner reference as a real approval does. */
const sampleReference = (partnerId: string) => `ST-SAMPLE000${SAMPLE_PARTNERS.findIndex((p) => p.id === partnerId) + 1}`;

/** Fixed salts keep the sample's root stable across renders. A real approval draws 32 random bytes per leaf. */
const SAMPLE_SALT = (i: number) => (i + 1).toString(16).padStart(2, '0').repeat(32);

/** A real payout tree over the sample payouts, so the sample statement's verify panel runs the same checks. */
function sampleCommitment(partnerId: string): StatementCommitment | null {
  const payable = sampleCalculation().rows.filter((r) => r.status === 'payable' && r.zat !== null);
  const leaves: PayoutLeaf[] = payable.map((r, i) => ({ v: 1, periodId: 'sample-period', revision: 1, payoutKey: r.key, partnerRef: sampleReference(r.partnerId), agreementVersionId: `v-${r.partnerId}`, owed: r.formula.owed, currency: 'USD', amountZat: r.zat!.toString(), salt: SAMPLE_SALT(i) }));
  const tree = buildPayoutTree(leaves);
  const entries = tree.leaves
    .filter((entry) => payable.find((r) => r.key === entry.payoutKey)?.partnerId === partnerId)
    .map((entry) => ({ memo: formatCommitmentMemo('STR-SAMPLE', tree.root), leaf: leaves.find((l) => l.payoutKey === entry.payoutKey)!, proof: tree.proofs[entry.index]! }));
  return entries.length > 0 ? { version: 1, root: tree.root, entries } : null;
}

/** A sample statement document for display only. Status is "approved, not paid": no sample ever claims a payment. */
export function sampleStatement(): StatementDocument {
  const row = sampleCalculation().rows.find((r) => r.partnerId === 'pb')!;
  return {
    id: 'sample',
    reference: sampleReference('pb'),
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
    commitment: sampleCommitment('pb'),
  };
}
