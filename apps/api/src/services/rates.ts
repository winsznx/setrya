import { getDb, schema, eq, and, desc, inArray } from '@setrya/db';
import { describeRate, invertRational, rationalFromDecimal, type RateSnapshot } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { audit } from './audit';
import type { UnlockedContext } from './session';

export interface RateView extends RateSnapshot {
  enteredAs: string;
  sourceText: string;
  description: string;
  intendedConversionAt: Date | null;
}

function view(ctx: UnlockedContext, r: typeof schema.fxRateSnapshots.$inferSelect): RateView {
  const snap = { base: r.base, quote: r.quote, numerator: BigInt(r.numerator), denominator: BigInt(r.denominator) };
  return {
    id: r.id,
    ...snap,
    source: ctx.cipher.dec('fx_rate_snapshots', r.id, 'source', r.sourceEnc),
    sourceText: ctx.cipher.dec('fx_rate_snapshots', r.id, 'source', r.sourceEnc),
    quotedAt: r.quotedAt,
    expiresAt: r.expiresAt,
    approvedAt: r.approvedAt,
    enteredAs: r.enteredAs,
    description: describeRate(snap),
    intendedConversionAt: r.intendedConversionAt,
  };
}

export async function listRates(ctx: UnlockedContext, projectId: string): Promise<RateView[]> {
  const rows = await getDb().select().from(schema.fxRateSnapshots).where(eq(schema.fxRateSnapshots.projectId, projectId)).orderBy(desc(schema.fxRateSnapshots.createdAt)).limit(100);
  return rows.map((r) => view(ctx, r));
}

export async function ratesByIds(ctx: UnlockedContext, projectId: string, ids: string[]): Promise<RateView[]> {
  if (ids.length === 0) return [];
  const rows = await getDb().select().from(schema.fxRateSnapshots).where(and(eq(schema.fxRateSnapshots.projectId, projectId), inArray(schema.fxRateSnapshots.id, ids)));
  return rows.map((r) => view(ctx, r));
}

export interface RateInput {
  currency: string;
  /** "zec_per_unit": 1 USD = X ZEC. "unit_per_zec": 1 ZEC = X USD, inverted explicitly before storage. */
  orientation: 'zec_per_unit' | 'unit_per_zec';
  value: string;
  source: string;
  quotedAt: Date;
  expiresAt: Date;
  intendedConversionAt: Date | null;
}

/** Stores an operator-supplied quote. Setrya never fetches prices; approval is part of creating the snapshot. */
export async function createRate(ctx: UnlockedContext, projectId: string, input: RateInput): Promise<string> {
  const entered = rationalFromDecimal(input.value);
  const r = input.orientation === 'zec_per_unit' ? entered : invertRational(entered);
  const id = randomUUID();
  await getDb().insert(schema.fxRateSnapshots).values({
    id,
    projectId,
    base: input.currency,
    quote: 'ZEC',
    numerator: r.numerator.toString(),
    denominator: r.denominator.toString(),
    enteredAs: input.orientation === 'zec_per_unit' ? `1 ${input.currency} = ${input.value} ZEC` : `1 ZEC = ${input.value} ${input.currency} (inverted)`,
    sourceEnc: ctx.cipher.enc('fx_rate_snapshots', id, 'source', input.source),
    quotedAt: input.quotedAt,
    expiresAt: input.expiresAt,
    intendedConversionAt: input.intendedConversionAt,
    approvedBy: ctx.ownerId,
    approvedAt: new Date(),
  });
  await audit(ctx.cipher, 'owner', { projectId, eventType: 'rate.approved', objectType: 'rate', objectId: id, diff: { pair: `${input.currency}/ZEC`, entered: input.value, orientation: input.orientation, quotedAt: input.quotedAt } });
  return id;
}
