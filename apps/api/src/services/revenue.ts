import { getDb, schema, eq, and, desc, inArray, isNull, sql } from '@setrya/db';
import { type Classification, decToString, type EntryType, parseDec, sum } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { audit } from './audit';
import type { UnlockedContext } from './session';

export interface EntryView {
  id: string;
  batchId: string | null;
  sourceId: string;
  externalId: string | null;
  raw: Record<string, string>;
  description: string | null;
  reference: string | null;
  amount: string;
  amountRaw: string;
  currency: string;
  occurredAt: Date;
  type: EntryType;
  classification: Classification;
  issues: string[];
  note: string | null;
  rowHash: string;
  rowIndex: number | null;
  origin: string;
  voided: boolean;
  periodIds: string[];
}

type Row = typeof schema.revenueEntries.$inferSelect;

export function viewEntry(ctx: UnlockedContext, r: Row, periodIds: string[] = []): EntryView {
  const raw = ctx.cipher.decJson<{ raw: Record<string, string>; externalId: string | null }>('revenue_entries', r.id, 'raw_fields', r.rawFieldsEnc);
  return {
    id: r.id,
    batchId: r.batchId,
    sourceId: r.sourceId,
    externalId: raw.externalId,
    raw: raw.raw,
    description: ctx.cipher.decOpt('revenue_entries', r.id, 'description', r.descriptionEnc),
    reference: ctx.cipher.decOpt('revenue_entries', r.id, 'reference', r.referenceEnc),
    amount: r.amountDecimal,
    amountRaw: r.amountRaw,
    currency: r.currency,
    occurredAt: r.occurredAt,
    type: r.entryType as EntryType,
    classification: r.classification as Classification,
    issues: r.issues,
    note: ctx.cipher.decOpt('revenue_entries', r.id, 'note', r.noteEnc),
    rowHash: r.rowHash,
    rowIndex: r.rowIndex,
    origin: r.origin,
    voided: r.voidedAt !== null,
    periodIds,
  };
}

async function periodLinks(entryIds: string[]): Promise<Map<string, string[]>> {
  if (entryIds.length === 0) return new Map();
  const links = await getDb().select({ entryId: schema.periodSources.revenueEntryId, periodId: schema.periodSources.periodId }).from(schema.periodSources).where(inArray(schema.periodSources.revenueEntryId, entryIds));
  const map = new Map<string, string[]>();
  for (const l of links) map.set(l.entryId, [...(map.get(l.entryId) ?? []), l.periodId]);
  return map;
}

export async function listEntries(ctx: UnlockedContext, projectId: string, filter: { batchId?: string; sourceId?: string; ids?: string[]; includeVoided?: boolean } = {}): Promise<EntryView[]> {
  const conditions = [eq(schema.revenueEntries.projectId, projectId)];
  if (filter.batchId) conditions.push(eq(schema.revenueEntries.batchId, filter.batchId));
  if (filter.sourceId) conditions.push(eq(schema.revenueEntries.sourceId, filter.sourceId));
  if (filter.ids) conditions.push(inArray(schema.revenueEntries.id, filter.ids.length ? filter.ids : ['00000000-0000-0000-0000-000000000000']));
  if (!filter.includeVoided) conditions.push(isNull(schema.revenueEntries.voidedAt));
  const rows = await getDb().select().from(schema.revenueEntries).where(and(...conditions)).orderBy(desc(schema.revenueEntries.occurredAt)).limit(5000);
  const links = await periodLinks(rows.map((r) => r.id));
  return rows.map((r) => viewEntry(ctx, r, links.get(r.id) ?? []));
}

export function summarize(entries: EntryView[]) {
  const group = (pred: (e: EntryView) => boolean) => {
    const out: Record<string, string> = {};
    const by = new Map<string, string[]>();
    for (const e of entries.filter(pred)) by.set(e.currency, [...(by.get(e.currency) ?? []), e.amount]);
    for (const [c, list] of [...by].sort()) out[c] = decToString(sum(list.map((v) => parseDec(v))));
    return out;
  };
  return {
    count: entries.length,
    total: group(() => true),
    eligible: group((e) => e.classification === 'eligible'),
    excluded: group((e) => e.classification === 'excluded'),
    held: group((e) => e.classification === 'held'),
    heldCount: entries.filter((e) => e.classification === 'held').length,
  };
}

/** Entries consumed by a frozen or later period cannot be reclassified in place; that would rewrite settled books. */
async function lockedEntryIds(entryIds: string[]): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: schema.periodSources.revenueEntryId })
    .from(schema.periodSources)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.periodSources.periodId))
    .where(and(inArray(schema.periodSources.revenueEntryId, entryIds), inArray(schema.periods.status, ['review', 'approved', 'in_payment', 'settled', 'closed'])));
  return new Set(rows.map((r) => r.id));
}

export async function classifyEntries(ctx: UnlockedContext, projectId: string, entryIds: string[], classification: Classification, type: EntryType | null, reason: string): Promise<{ updated: number }> {
  const locked = await lockedEntryIds(entryIds);
  if (locked.size > 0) throw new ApiError('FORBIDDEN', `${locked.size} selected row(s) belong to a frozen or closed period. Record a correction in a new period instead.`);
  return getDb().transaction(async (tx) => {
    const before = await tx.select({ id: schema.revenueEntries.id, classification: schema.revenueEntries.classification, type: schema.revenueEntries.entryType }).from(schema.revenueEntries).where(and(eq(schema.revenueEntries.projectId, projectId), inArray(schema.revenueEntries.id, entryIds), isNull(schema.revenueEntries.voidedAt)));
    if (before.length === 0) throw new ApiError('NOT_FOUND', 'No matching rows.');
    for (const b of before) {
      await tx.update(schema.revenueEntries).set({ classification, entryType: type ?? b.type, noteEnc: ctx.cipher.enc('revenue_entries', b.id, 'note', reason), updatedAt: new Date() }).where(eq(schema.revenueEntries.id, b.id));
    }
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'revenue.reclassified', objectType: 'revenue_entries', objectId: before.length === 1 ? before[0]!.id : undefined, diff: { count: before.length, to: { classification, type }, from: before.map((b) => ({ id: b.id, classification: b.classification, type: b.type })) }, reason }, tx);
    await recountBatches(tx, before.map((b) => b.id));
    return { updated: before.length };
  });
}

async function recountBatches(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], entryIds: string[]) {
  const batches = await tx.selectDistinct({ id: schema.revenueEntries.batchId }).from(schema.revenueEntries).where(inArray(schema.revenueEntries.id, entryIds));
  for (const { id } of batches) {
    if (!id) continue;
    const [c] = await tx
      .select({
        eligible: sql<number>`count(*) filter (where ${schema.revenueEntries.classification} = 'eligible')::int`,
        held: sql<number>`count(*) filter (where ${schema.revenueEntries.classification} = 'held')::int`,
        excluded: sql<number>`count(*) filter (where ${schema.revenueEntries.classification} = 'excluded')::int`,
      })
      .from(schema.revenueEntries)
      .where(and(eq(schema.revenueEntries.batchId, id), isNull(schema.revenueEntries.voidedAt)));
    await tx.update(schema.importBatches).set({ eligibleCount: c!.eligible, heldCount: c!.held, excludedCount: c!.excluded, status: c!.held > 0 ? 'needs_review' : 'committed' }).where(eq(schema.importBatches.id, id));
  }
}

export interface ManualEntryInput {
  sourceId: string;
  occurredAt: Date;
  amount: string;
  currency: string;
  type: EntryType;
  description: string;
  externalId: string | null;
  note: string;
}

export async function addManualEntry(ctx: UnlockedContext, projectId: string, input: ManualEntryInput): Promise<string> {
  const id = randomUUID();
  const amount = decToString(parseDec(input.amount, 8));
  const classification: Classification = input.type === 'realised_fee' && !amount.startsWith('-') ? 'eligible' : input.type === 'refund' || input.type === 'chargeback' ? 'held' : 'excluded';
  const externalIdHash = input.externalId ? ctx.cipher.hash(`external:${input.sourceId}`, input.externalId) : null;
  if (externalIdHash) {
    const [dup] = await getDb().select({ id: schema.revenueEntries.id }).from(schema.revenueEntries).where(and(eq(schema.revenueEntries.sourceId, input.sourceId), eq(schema.revenueEntries.externalIdHash, externalIdHash), isNull(schema.revenueEntries.voidedAt))).limit(1);
    if (dup) throw new ApiError('DUPLICATE_IMPORT', 'An entry with this external ID already exists for this source.', { fieldErrors: { externalId: 'Already recorded' } });
  }
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.revenueEntries).values({
      id,
      projectId,
      sourceId: input.sourceId,
      externalIdHash,
      rawFieldsEnc: ctx.cipher.encJson('revenue_entries', id, 'raw_fields', { raw: { occurred_at: input.occurredAt.toISOString(), amount: input.amount, currency: input.currency, description: input.description, entered: 'manual' }, externalId: input.externalId }),
      descriptionEnc: ctx.cipher.encOpt('revenue_entries', id, 'description', input.description),
      amountDecimal: amount,
      amountRaw: input.amount,
      currency: input.currency,
      occurredAt: input.occurredAt,
      entryType: input.type,
      classification,
      issues: [],
      noteEnc: ctx.cipher.encOpt('revenue_entries', id, 'note', input.note),
      rowHash: id,
      origin: 'manual',
    });
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'revenue.manual_entry', objectType: 'revenue_entries', objectId: id, diff: { amount, currency: input.currency, type: input.type } }, tx);
  });
  return id;
}
