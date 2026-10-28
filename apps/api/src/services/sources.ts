import { getDb, schema, eq, and, asc, sql } from '@setrya/db';
import type { EntryType } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import type { UnlockedContext } from './session';

export interface SourceView {
  id: string;
  name: string;
  platform: string | null;
  note: string | null;
  referenceUrl: string | null;
  defaultCurrency: string;
  feeType: EntryType;
  timezone: string;
  kind: string;
  enabled: boolean;
  version: number;
  createdAt: Date;
}

type Row = typeof schema.sources.$inferSelect;

export function viewSource(ctx: UnlockedContext, r: Row): SourceView {
  const d = (c: string, v: string | null) => ctx.cipher.decOpt('sources', r.id, c, v);
  return { id: r.id, name: d('name', r.nameEnc)!, platform: d('platform', r.platformEnc), note: d('note', r.noteEnc), referenceUrl: d('reference_url', r.referenceUrlEnc), defaultCurrency: r.defaultCurrency, feeType: r.feeType as EntryType, timezone: r.timezone, kind: r.kind, enabled: r.enabled, version: r.version, createdAt: r.createdAt };
}

export async function listSources(ctx: UnlockedContext, projectId: string): Promise<SourceView[]> {
  const rows = await getDb().select().from(schema.sources).where(eq(schema.sources.projectId, projectId)).orderBy(asc(schema.sources.createdAt));
  return rows.map((r) => viewSource(ctx, r));
}

export async function getSource(ctx: UnlockedContext, projectId: string, sourceId: string): Promise<SourceView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) return null;
  const [r] = await getDb().select().from(schema.sources).where(and(eq(schema.sources.id, sourceId), eq(schema.sources.projectId, projectId))).limit(1);
  return r ? viewSource(ctx, r) : null;
}

export interface SourceInput {
  name: string;
  platform?: string | null;
  note?: string | null;
  referenceUrl?: string | null;
  defaultCurrency: string;
  feeType: EntryType;
  timezone: string;
  kind: 'csv' | 'manual';
}

export async function createSource(ctx: UnlockedContext, projectId: string, input: SourceInput): Promise<string> {
  const id = randomUUID();
  await getDb().insert(schema.sources).values({
    id,
    projectId,
    nameEnc: ctx.cipher.enc('sources', id, 'name', input.name),
    platformEnc: ctx.cipher.encOpt('sources', id, 'platform', input.platform),
    noteEnc: ctx.cipher.encOpt('sources', id, 'note', input.note),
    referenceUrlEnc: ctx.cipher.encOpt('sources', id, 'reference_url', input.referenceUrl),
    defaultCurrency: input.defaultCurrency,
    feeType: input.feeType,
    timezone: input.timezone,
    kind: input.kind,
  });
  return id;
}

export async function sourceStats(projectId: string): Promise<Map<string, { lastImport: Date | null; held: number }>> {
  const imports = await getDb()
    .select({ sourceId: schema.importBatches.sourceId, last: sql<Date>`max(${schema.importBatches.createdAt})`, held: sql<number>`sum(${schema.importBatches.heldCount})::int` })
    .from(schema.importBatches)
    .where(eq(schema.importBatches.projectId, projectId))
    .groupBy(schema.importBatches.sourceId);
  return new Map(imports.map((r) => [r.sourceId, { lastImport: r.last ? new Date(r.last) : null, held: r.held ?? 0 }]));
}

