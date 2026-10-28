import { getDb, schema, eq, and, desc, inArray, isNull, sql } from '@setrya/db';
import { type Classification, type ColumnMapping, decodeCsvBytes, decToString, type EntryType, guessMapping, normalizeRows, type NormalizedRow, parseCsv, type DateFormat } from '@setrya/domain';
import { sha256 } from '@setrya/security';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { audit } from './audit';
import type { SourceView } from './sources';
import type { UnlockedContext } from './session';

/**
 * Upload previews are held in server memory only, keyed by an opaque token and dropped after 30 minutes or on commit.
 * Raw CSV never touches the database in clear and never leaves the host.
 */
interface Draft {
  ownerId: string;
  projectId: string;
  sourceId: string;
  filename: string;
  fileHash: string;
  header: string[];
  rows: string[][];
  delimiter: string;
  createdAt: number;
}
const drafts: Map<string, Draft> = ((globalThis as { setryaImportDrafts?: Map<string, Draft> }).setryaImportDrafts ??= new Map());
const DRAFT_TTL = 30 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [k, d] of drafts) if (now - d.createdAt > DRAFT_TTL) drafts.delete(k);
}

export async function createDraft(ctx: UnlockedContext, projectId: string, source: SourceView, filename: string, bytes: Uint8Array) {
  sweep();
  let text: string;
  let parsed: ReturnType<typeof parseCsv>;
  try {
    text = decodeCsvBytes(bytes);
    parsed = parseCsv(text);
  } catch (error) {
    throw new ApiError('INVALID_INPUT', error instanceof Error ? error.message : 'The file could not be read.');
  }
  const fileHash = sha256(Buffer.from(bytes));
  const [existing] = await getDb().select({ id: schema.importBatches.id, createdAt: schema.importBatches.createdAt }).from(schema.importBatches).where(and(eq(schema.importBatches.projectId, projectId), eq(schema.importBatches.sourceId, source.id), eq(schema.importBatches.fileHash, fileHash), isNull(schema.importBatches.voidedAt))).limit(1);
  const token = randomUUID();
  drafts.set(token, { ownerId: ctx.ownerId, projectId, sourceId: source.id, filename: filename.slice(0, 200), fileHash, header: parsed.header, rows: parsed.rows, delimiter: parsed.delimiter, createdAt: Date.now() });
  return {
    token,
    filename,
    fileHash,
    delimiter: parsed.delimiter === '\t' ? 'tab' : parsed.delimiter,
    rowCount: parsed.rows.length,
    header: parsed.header,
    sample: parsed.rows.slice(0, 10),
    guessedMapping: guessMapping(parsed.header),
    duplicateOfImportId: existing?.id ?? null,
  };
}

function getDraft(ctx: UnlockedContext, projectId: string, token: string): Draft {
  sweep();
  const d = drafts.get(token);
  if (!d || d.ownerId !== ctx.ownerId || d.projectId !== projectId) throw new ApiError('NOT_FOUND', 'This upload expired. Upload the file again.', { recoveryAction: 'reupload' });
  return d;
}

export interface NormalizeRequest {
  token: string;
  mapping: ColumnMapping;
  dateFormat: DateFormat;
  decimalSeparator: '.' | ',';
  timeZone: string;
}

async function existingIds(ctx: UnlockedContext, sourceId: string, ids: (string | null)[]): Promise<Set<string>> {
  const hashes = ids.filter((x): x is string => x !== null).map((id) => ctx.cipher.hash(`external:${sourceId}`, id));
  if (hashes.length === 0) return new Set();
  const found = await getDb().select({ h: schema.revenueEntries.externalIdHash }).from(schema.revenueEntries).where(and(eq(schema.revenueEntries.sourceId, sourceId), inArray(schema.revenueEntries.externalIdHash, hashes), isNull(schema.revenueEntries.voidedAt)));
  const foundSet = new Set(found.map((f) => f.h));
  return new Set(ids.filter((x): x is string => x !== null && foundSet.has(ctx.cipher.hash(`external:${sourceId}`, x))));
}

export async function normalizeDraft(ctx: UnlockedContext, projectId: string, source: SourceView, req: NormalizeRequest): Promise<{ draft: Draft; rows: NormalizedRow[] }> {
  const draft = getDraft(ctx, projectId, req.token);
  if (draft.sourceId !== source.id) throw new ApiError('INVALID_INPUT', 'The upload belongs to a different source.');
  for (const f of ['date', 'amount'] as const) if (req.mapping[f] === undefined) throw new ApiError('INVALID_INPUT', `Map a column to ${f}.`, { fieldErrors: { [`mapping.${f}`]: 'Required' } });
  const used = Object.values(req.mapping).filter((v) => v !== undefined);
  if (new Set(used).size !== used.length) throw new ApiError('INVALID_INPUT', 'Each column can map to one field only.');
  if (used.some((i) => i! < 0 || i! >= draft.header.length)) throw new ApiError('INVALID_INPUT', 'A mapping points at a column that does not exist.');
  const idIndex = req.mapping.externalId;
  const existing = await existingIds(ctx, source.id, idIndex === undefined ? [] : draft.rows.map((r) => r[idIndex]?.trim() || null));
  const rows = normalizeRows(draft.header, draft.rows, { mapping: req.mapping, timeZone: req.timeZone, dateFormat: req.dateFormat, decimalSeparator: req.decimalSeparator, defaultCurrency: source.defaultCurrency, defaultType: source.feeType, existingExternalIds: existing });
  return { draft, rows };
}

export function serializeRow(r: NormalizedRow) {
  return {
    rowIndex: r.rowIndex,
    externalId: r.externalId,
    occurredAt: r.occurredAt?.toISOString() ?? null,
    amountRaw: r.amountRaw,
    amount: r.amount ? decToString(r.amount) : null,
    currency: r.currency,
    description: r.description,
    type: r.type,
    issues: r.issues,
    suggested: r.suggested,
    suggestedNote: r.suggestedNote,
    unusable: r.unusable,
  };
}

export interface CommitRequest extends NormalizeRequest {
  duplicatePolicy: 'skip_duplicates' | 'import_as_held';
  decisions: { rowIndex: number; classification: Classification; type: EntryType; note: string }[];
  acknowledgeUnverified: true;
}

export async function commitImport(ctx: UnlockedContext, projectId: string, source: SourceView, req: CommitRequest): Promise<{ importId: string }> {
  const { draft, rows } = await normalizeDraft(ctx, projectId, source, req);
  const decisions = new Map(req.decisions.map((d) => [d.rowIndex, d]));
  const missingNote = req.decisions.find((d) => d.classification === 'excluded' && d.note.trim() === '');
  if (missingNote) throw new ApiError('INVALID_INPUT', `Row ${missingNote.rowIndex + 1} is excluded without a reason.`, { fieldErrors: { [`decisions.${missingNote.rowIndex}`]: 'Explain the exclusion' } });

  const importId = randomUUID();
  let eligible = 0, held = 0, excluded = 0, duplicates = 0;
  const values: (typeof schema.revenueEntries.$inferInsert)[] = [];
  for (const row of rows) {
    // Rows without a readable amount or date cannot become money records; they stay visible in the preview only.
    if (row.amount === null || row.occurredAt === null) continue;
    const isDuplicate = row.issues.includes('DUPLICATE_EXISTING') || row.issues.includes('DUPLICATE_IN_FILE');
    if (isDuplicate) {
      duplicates += 1;
      if (req.duplicatePolicy === 'skip_duplicates' && row.issues.includes('DUPLICATE_EXISTING')) continue;
    }
    const decision = decisions.get(row.rowIndex);
    let classification: Classification = decision?.classification ?? row.suggested;
    if (isDuplicate && classification === 'eligible') classification = 'held';
    const type = decision?.type ?? row.type;
    if (classification === 'eligible') eligible += 1;
    else if (classification === 'held') held += 1;
    else excluded += 1;
    const id = randomUUID();
    const note = decision?.note.trim() || row.suggestedNote || null;
    values.push({
      id,
      projectId,
      batchId: importId,
      sourceId: source.id,
      externalIdHash: row.externalId ? ctx.cipher.hash(`external:${source.id}`, row.externalId) : null,
      rawFieldsEnc: ctx.cipher.encJson('revenue_entries', id, 'raw_fields', { raw: row.raw, externalId: row.externalId }),
      descriptionEnc: ctx.cipher.encOpt('revenue_entries', id, 'description', row.description),
      referenceEnc: ctx.cipher.encOpt('revenue_entries', id, 'reference', row.reference),
      amountDecimal: decToString(row.amount),
      amountRaw: row.amountRaw,
      currency: row.currency,
      occurredAt: row.occurredAt,
      entryType: type,
      classification,
      issues: row.issues,
      noteEnc: note ? ctx.cipher.enc('revenue_entries', id, 'note', note) : null,
      rowHash: row.rawHash,
      rowIndex: row.rowIndex,
      origin: 'csv',
    });
  }
  if (values.length === 0) throw new ApiError('INVALID_INPUT', 'No rows can be imported. Every row is unreadable or a skipped duplicate.');

  await getDb().transaction(async (tx) => {
    try {
      await tx.insert(schema.importBatches).values({
        id: importId,
        projectId,
        sourceId: source.id,
        fileHash: draft.fileHash,
        filenameEnc: ctx.cipher.enc('import_batches', importId, 'filename', draft.filename),
        mappingEnc: ctx.cipher.encJson('import_batches', importId, 'mapping', { mapping: req.mapping, header: draft.header, dateFormat: req.dateFormat, decimalSeparator: req.decimalSeparator, timeZone: req.timeZone, delimiter: draft.delimiter }),
        status: held > 0 ? 'needs_review' : 'committed',
        rowCount: draft.rows.length,
        eligibleCount: eligible,
        heldCount: held,
        excludedCount: excluded,
        duplicateCount: duplicates,
        duplicatePolicy: req.duplicatePolicy,
      });
    } catch (error) {
      if (String((error as { code?: string }).code) === '23505') throw new ApiError('DUPLICATE_IMPORT', 'This exact file was already imported for this source. Open the existing import instead.');
      throw error;
    }
    for (let i = 0; i < values.length; i += 500) await tx.insert(schema.revenueEntries).values(values.slice(i, i + 500));
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'import.committed', objectType: 'import', objectId: importId, diff: { rows: draft.rows.length, eligible, held, excluded, duplicates, fileHash: draft.fileHash } }, tx);
  });
  drafts.delete(req.token);
  return { importId };
}

export interface ImportView {
  id: string;
  sourceId: string;
  filename: string;
  fileHash: string;
  mapping: { mapping: ColumnMapping; header: string[]; dateFormat: string; decimalSeparator: string; timeZone: string; delimiter: string };
  status: string;
  rowCount: number;
  eligibleCount: number;
  heldCount: number;
  excludedCount: number;
  duplicateCount: number;
  duplicatePolicy: string;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
}

export function viewImport(ctx: UnlockedContext, r: typeof schema.importBatches.$inferSelect): ImportView {
  return {
    id: r.id,
    sourceId: r.sourceId,
    filename: ctx.cipher.dec('import_batches', r.id, 'filename', r.filenameEnc),
    fileHash: r.fileHash,
    mapping: ctx.cipher.decJson('import_batches', r.id, 'mapping', r.mappingEnc),
    status: r.status,
    rowCount: r.rowCount,
    eligibleCount: r.eligibleCount,
    heldCount: r.heldCount,
    excludedCount: r.excludedCount,
    duplicateCount: r.duplicateCount,
    duplicatePolicy: r.duplicatePolicy,
    voidedAt: r.voidedAt,
    voidReason: ctx.cipher.decOpt('import_batches', r.id, 'void_reason', r.voidReasonEnc),
    createdAt: r.createdAt,
  };
}

export async function listImports(ctx: UnlockedContext, projectId: string): Promise<ImportView[]> {
  const rows = await getDb().select().from(schema.importBatches).where(eq(schema.importBatches.projectId, projectId)).orderBy(desc(schema.importBatches.createdAt));
  return rows.map((r) => viewImport(ctx, r));
}

export async function getImport(ctx: UnlockedContext, projectId: string, importId: string): Promise<ImportView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(importId)) return null;
  const [r] = await getDb().select().from(schema.importBatches).where(and(eq(schema.importBatches.id, importId), eq(schema.importBatches.projectId, projectId))).limit(1);
  return r ? viewImport(ctx, r) : null;
}

/** An import consumed by a frozen, approved or closed period can never be voided; corrections go in a later period. */
export async function importLockedByPeriods(importId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(distinct ${schema.periods.id})::int` })
    .from(schema.periodSources)
    .innerJoin(schema.revenueEntries, eq(schema.revenueEntries.id, schema.periodSources.revenueEntryId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.periodSources.periodId))
    .where(and(eq(schema.revenueEntries.batchId, importId), inArray(schema.periods.status, ['review', 'approved', 'in_payment', 'settled', 'closed'])));
  return row?.n ?? 0;
}

export async function voidImport(ctx: UnlockedContext, projectId: string, importId: string, reason: string): Promise<void> {
  if ((await importLockedByPeriods(importId)) > 0) throw new ApiError('FORBIDDEN', 'Rows from this import are part of a frozen or closed period. Record a correction in a new period instead.');
  await getDb().transaction(async (tx) => {
    const now = new Date();
    const [r] = await tx.update(schema.importBatches).set({ voidedAt: now, voidReasonEnc: ctx.cipher.enc('import_batches', importId, 'void_reason', reason), status: 'voided' }).where(and(eq(schema.importBatches.id, importId), eq(schema.importBatches.projectId, projectId), isNull(schema.importBatches.voidedAt))).returning({ id: schema.importBatches.id });
    if (!r) throw new ApiError('CONFLICT', 'This import is already voided.');
    await tx.update(schema.revenueEntries).set({ voidedAt: now }).where(eq(schema.revenueEntries.batchId, importId));
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'import.voided', objectType: 'import', objectId: importId, reason }, tx);
  });
}

