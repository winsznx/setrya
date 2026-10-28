import { z } from 'zod';

import { cmp, type Dec, parseDec, sum } from './money';
import type { EntryType } from './revenue';

export const RATE_PCT_MAX_SCALE = 4;

const decimalString = (maxScale: number) =>
  z
    .string()
    .trim()
    .refine((v) => {
      try {
        parseDec(v, maxScale);
        return true;
      } catch {
        return false;
      }
    }, `Use a plain number with at most ${maxScale} decimal places`);

const common = {
  basisDefinition: z.string().trim().max(600).default(''),
  exclusions: z.string().trim().max(600).default(''),
  cadence: z.enum(['per_period', 'weekly', 'monthly']).default('per_period'),
  notes: z.string().trim().max(2000).default(''),
};

export const percentageTermsSchema = z.object({
  kind: z.literal('percentage'),
  ratePct: decimalString(RATE_PCT_MAX_SCALE).refine((v) => cmp(parseDec(v, 4), parseDec('0')) > 0 && cmp(parseDec(v, 4), parseDec('100')) <= 0, 'Rate must be above 0% and at most 100%'),
  refundTreatment: z.enum(['net_adjustment', 'exclude']).default('net_adjustment'),
  cap: z.object({ amount: decimalString(8), currency: z.string().regex(/^[A-Z]{3,5}$/) }).nullable().default(null),
  poolSemantics: z.enum(['exclusive', 'independent']).default('exclusive'),
  overcommitAcknowledged: z.boolean().default(false),
  conversionBasis: z.enum(['zec_denominated', 'rate_snapshot']).default('rate_snapshot'),
  ...common,
});

export const fixedTermsSchema = z.object({
  kind: z.literal('fixed'),
  amount: decimalString(8).refine((v) => cmp(parseDec(v, 8), parseDec('0')) > 0, 'Amount must be greater than zero'),
  currency: z.string().regex(/^[A-Z]{3,5}$/),
  poolSemantics: z.literal('independent').default('independent'),
  overcommitAcknowledged: z.boolean().default(false),
  conversionBasis: z.enum(['zec_denominated', 'rate_snapshot']).default('zec_denominated'),
  ...common,
});

export const agreementTermsSchema = z.discriminatedUnion('kind', [percentageTermsSchema, fixedTermsSchema]);
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;
export type PercentageTerms = z.infer<typeof percentageTermsSchema>;

export function includedTypes(terms: AgreementTerms): ReadonlySet<EntryType> {
  if (terms.kind === 'fixed') return new Set();
  return new Set<EntryType>(terms.refundTreatment === 'net_adjustment' ? ['realised_fee', 'refund', 'chargeback'] : ['realised_fee']);
}

export function describeTerms(terms: AgreementTerms): string {
  if (terms.kind === 'fixed') return `Fixed ${terms.amount} ${terms.currency} per period`;
  const rate = terms.ratePct.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const refunds = terms.refundTreatment === 'net_adjustment' ? ' after refunds' : '';
  return `${rate}% of eligible realised fees${refunds}`;
}

export function basisLabel(terms: AgreementTerms): string {
  if (terms.kind === 'percentage') return '% of eligible realised fees';
  return terms.currency === 'ZEC' ? 'Fixed ZEC' : 'Fixed accounting currency';
}

export interface VersionWindow {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export function windowsOverlap(a: VersionWindow, b: VersionWindow): boolean {
  const aEnd = a.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.effectiveFrom.getTime() < bEnd && b.effectiveFrom.getTime() < aEnd;
}

export interface PoolMember extends VersionWindow {
  agreementId: string;
  sourceIds: readonly string[];
  terms: AgreementTerms;
}

/**
 * Exclusive percentage agreements that share a source and overlap in time must not promise more than 100% of that
 * pool. Independent obligations may exceed it, but only with the owner's acknowledgement on each agreement.
 */
export function poolCommitment(members: readonly PoolMember[], candidate: PoolMember): { sourceId: string; totalPct: Dec; overcommitted: boolean; independentUnacknowledged: boolean }[] {
  const results = [];
  for (const sourceId of candidate.sourceIds) {
    const relevant = [candidate, ...members.filter((m) => m.agreementId !== candidate.agreementId && m.sourceIds.includes(sourceId) && windowsOverlap(m, candidate))];
    const pct = relevant.filter((m) => m.terms.kind === 'percentage').map((m) => parseDec((m.terms as PercentageTerms).ratePct, 4));
    const totalPct = sum(pct);
    const over = cmp(totalPct, parseDec('100')) > 0;
    const exclusiveInvolved = relevant.some((m) => m.terms.kind === 'percentage' && m.terms.poolSemantics === 'exclusive');
    results.push({
      sourceId,
      totalPct,
      overcommitted: over && exclusiveInvolved,
      independentUnacknowledged: over && !exclusiveInvolved && !candidate.terms.overcommitAcknowledged,
    });
  }
  return results;
}
