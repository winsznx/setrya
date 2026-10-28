import { getDb, schema, eq, and, desc, inArray, isNull, ne, notInArray, type Tx } from '@setrya/db';
import {
  addressFingerprint,
  calculatePeriod,
  type CalcRow,
  type Classification,
  DEFAULT_MIN_PAYOUT_ZAT,
  type EngineEntry,
  type EngineException,
  type EngineResult,
  type EngineVersion,
  type EntryType,
  FORMULA_VERSION,
  type FormulaTrail,
  type FrozenSnapshot,
  hashCanonical,
  HOLD_TEXT,
  type HoldCode,
  type IssueCode,
  parseDec,
  type PeriodStatus,
  recipientsDigest,
  type SnapshotPayout,
} from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { listAgreements } from './agreements';
import { ApiError } from '../http/route';
import { audit } from './audit';
import { listPartners, type PartnerView } from './partners';
import type { ProjectView } from './projects';
import { ratesByIds, type RateView } from './rates';
import type { UnlockedContext } from './session';


export interface PeriodRowView {
  id: string;
  key: string;
  partnerId: string;
  agreementId: string;
  agreementVersionId: string;
  currency: string;
  owed: string;
  zat: bigint | null;
  residualZat: string | null;
  rateSnapshotId: string | null;
  status: CalcRow['status'];
  holds: { code: HoldCode; detail?: string }[];
  formula: FormulaTrail;
  sourceEntryIds: string[];
  sourceIdsHash: string;
}

export interface ExceptionView {
  id: string;
  key: string;
  code: EngineException['code'];
  severity: 'blocking' | 'warning';
  entryIds: string[];
  rowKeys: string[];
  partnerId: string | null;
  moneyAtRisk: { amount: string; currency: string } | null;
  detail: string;
  status: 'open' | 'resolved' | 'held';
  decision: string | null;
  reason: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface PeriodView {
  id: string;
  projectId: string;
  label: string;
  startAt: Date;
  endAt: Date;
  sourceIds: string[];
  rateSnapshotIds: Record<string, string>;
  status: PeriodStatus;
  revision: number;
  totals: EngineResult['totals'] | null;
  frozenSnapshotHash: string | null;
  frozenAt: Date | null;
  approvedSnapshotId: string | null;
  calculatedAt: Date | null;
  closedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type PeriodRow = typeof schema.periods.$inferSelect;

export function viewPeriod(ctx: UnlockedContext, r: PeriodRow): PeriodView {
  return {
    id: r.id,
    projectId: r.projectId,
    label: ctx.cipher.dec('periods', r.id, 'label', r.labelEnc),
    startAt: r.startAt,
    endAt: r.endAt,
    sourceIds: r.sourceIds,
    rateSnapshotIds: r.rateSnapshotIds,
    status: r.status as PeriodStatus,
    revision: r.revision,
    totals: (r.totalsJson as EngineResult['totals'] | null) ?? null,
    frozenSnapshotHash: r.frozenSnapshotHash,
    frozenAt: r.frozenAt,
    approvedSnapshotId: r.approvedSnapshotId,
    calculatedAt: r.calculatedAt,
    closedAt: r.closedAt,
    version: r.version,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listPeriods(ctx: UnlockedContext, projectId: string): Promise<PeriodView[]> {
  const rows = await getDb().select().from(schema.periods).where(eq(schema.periods.projectId, projectId)).orderBy(desc(schema.periods.startAt), desc(schema.periods.createdAt));
  return rows.map((r) => viewPeriod(ctx, r));
}

export async function getPeriod(ctx: UnlockedContext, projectId: string, periodId: string): Promise<PeriodView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(periodId)) return null;
  const [r] = await getDb().select().from(schema.periods).where(and(eq(schema.periods.id, periodId), eq(schema.periods.projectId, projectId))).limit(1);
  return r ? viewPeriod(ctx, r) : null;
}

export async function requirePeriodApi(ctx: UnlockedContext, projectId: string, periodId: string): Promise<PeriodView> {
  const p = await getPeriod(ctx, projectId, periodId);
  if (!p) throw new ApiError('NOT_FOUND', 'Not found.');
  return p;
}

export async function periodRows(ctx: UnlockedContext, period: Pick<PeriodView, 'id' | 'revision'>): Promise<PeriodRowView[]> {
  const rows = await getDb().select().from(schema.calculationRows).where(and(eq(schema.calculationRows.periodId, period.id), eq(schema.calculationRows.revision, period.revision)));
  return rows.map((r) => ({
    id: r.id,
    key: r.rowKey,
    partnerId: r.partnerId,
    agreementId: r.agreementId,
    agreementVersionId: r.agreementVersionId,
    currency: r.currency,
    owed: r.owedDecimal,
    zat: r.amountZat,
    residualZat: r.residualZat,
    rateSnapshotId: r.rateSnapshotId,
    status: r.status as CalcRow['status'],
    holds: r.holds as { code: HoldCode; detail?: string }[],
    formula: ctx.cipher.decJson<FormulaTrail>('calculation_rows', r.id, 'formula', r.formulaEnc),
    sourceEntryIds: r.sourceEntryIds,
    sourceIdsHash: r.sourceIdsHash,
  }));
}

export async function periodExceptions(ctx: UnlockedContext, period: Pick<PeriodView, 'id' | 'revision'>): Promise<ExceptionView[]> {
  const rows = await getDb().select().from(schema.periodExceptions).where(and(eq(schema.periodExceptions.periodId, period.id), eq(schema.periodExceptions.revision, period.revision))).orderBy(schema.periodExceptions.createdAt);
  return rows
    .map((r) => ({
      id: r.id,
      key: r.key,
      code: r.code as EngineException['code'],
      severity: r.severity as 'blocking' | 'warning',
      entryIds: r.affectedEntryIds,
      rowKeys: r.affectedRowKeys,
      partnerId: r.partnerId,
      moneyAtRisk: r.moneyAtRiskEnc ? ctx.cipher.decJson<{ amount: string; currency: string }>('period_exceptions', r.id, 'money_at_risk', r.moneyAtRiskEnc) : null,
      detail: r.detail,
      status: r.status as ExceptionView['status'],
      decision: r.decision,
      reason: ctx.cipher.decOpt('period_exceptions', r.id, 'reason', r.reasonEnc),
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || (a.severity === 'blocking' ? 0 : 1) - (b.severity === 'blocking' ? 0 : 1));
}

export interface PeriodInput {
  label: string;
  startAt: Date;
  endAt: Date;
  sourceIds: string[];
  rateSnapshotIds: Record<string, string>;
}

/** Entries already claimed by another live period. Consuming them twice is refused unless a correction links them. */
export async function claimedEntryIds(projectId: string, exceptPeriodId?: string): Promise<Set<string>> {
  const conditions = [eq(schema.periods.projectId, projectId)];
  if (exceptPeriodId) conditions.push(ne(schema.periods.id, exceptPeriodId));
  const rows = await getDb().select({ id: schema.periodSources.revenueEntryId }).from(schema.periodSources).innerJoin(schema.periods, eq(schema.periods.id, schema.periodSources.periodId)).where(and(...conditions));
  return new Set(rows.map((r) => r.id));
}

export async function candidateEntries(projectId: string, input: Pick<PeriodInput, 'startAt' | 'endAt' | 'sourceIds'>, exceptPeriodId?: string) {
  if (input.sourceIds.length === 0) return { available: [], claimed: 0 };
  const rows = await getDb()
    .select({ id: schema.revenueEntries.id, sourceId: schema.revenueEntries.sourceId, occurredAt: schema.revenueEntries.occurredAt, classification: schema.revenueEntries.classification, currency: schema.revenueEntries.currency, amount: schema.revenueEntries.amountDecimal, type: schema.revenueEntries.entryType, issues: schema.revenueEntries.issues, rowHash: schema.revenueEntries.rowHash })
    .from(schema.revenueEntries)
    .where(and(eq(schema.revenueEntries.projectId, projectId), inArray(schema.revenueEntries.sourceId, input.sourceIds), isNull(schema.revenueEntries.voidedAt)));
  const inRange = rows.filter((r) => r.occurredAt >= input.startAt && r.occurredAt < input.endAt);
  const claimed = await claimedEntryIds(projectId, exceptPeriodId);
  return { available: inRange.filter((r) => !claimed.has(r.id)), claimed: inRange.filter((r) => claimed.has(r.id)).length };
}

export async function createPeriod(ctx: UnlockedContext, project: ProjectView, input: PeriodInput): Promise<string> {
  if (input.endAt <= input.startAt) throw new ApiError('INVALID_INPUT', 'The end date must be after the start date.', { fieldErrors: { endDate: 'End must be after start' } });
  const id = randomUUID();
  const { available } = await candidateEntries(project.id, input);
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.periods).values({ id, projectId: project.id, labelEnc: ctx.cipher.enc('periods', id, 'label', input.label), startAt: input.startAt, endAt: input.endAt, sourceIds: input.sourceIds, rateSnapshotIds: input.rateSnapshotIds, status: 'draft' });
    if (available.length > 0) await tx.insert(schema.periodSources).values(available.map((e) => ({ periodId: id, revenueEntryId: e.id, inclusion: e.classification })));
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.created', objectType: 'period', objectId: id, diff: { entries: available.length, start: input.startAt, end: input.endAt } }, tx);
  });
  await recalculate(ctx, project, id);
  return id;
}

interface EngineContext {
  period: PeriodView;
  entries: (EngineEntry & { batchId: string | null })[];
  versions: EngineVersion[];
  partners: PartnerView[];
  rates: RateView[];
  heldRows: Map<string, string>;
  confirmedOverlaps: Set<string>;
  sourceCurrencies: Record<string, string>;
}

async function loadEngineContext(ctx: UnlockedContext, project: ProjectView, period: PeriodView, db: Tx | ReturnType<typeof getDb> = getDb()): Promise<EngineContext> {
  const links = await db
    .select({ entry: schema.revenueEntries, inclusion: schema.periodSources.inclusion })
    .from(schema.periodSources)
    .innerJoin(schema.revenueEntries, eq(schema.revenueEntries.id, schema.periodSources.revenueEntryId))
    .where(eq(schema.periodSources.periodId, period.id));
  const entries = links.map(({ entry, inclusion }) => ({
    id: entry.id,
    batchId: entry.batchId,
    sourceId: entry.sourceId,
    occurredAt: entry.occurredAt,
    amount: parseDec(entry.amountDecimal),
    currency: entry.currency,
    type: entry.entryType as EntryType,
    inclusion: inclusion as Classification,
    issues: entry.issues as IssueCode[],
    fingerprint: entry.rowHash,
  }));
  const agreements = await listAgreements(ctx, project.id);
  const versions: EngineVersion[] = agreements
    .filter((a) => a.sourceIds.some((s) => period.sourceIds.includes(s)))
    .flatMap((a) =>
      a.versions
        .filter((v) => v.status === 'active' || (v.status === 'superseded' && v.effectiveTo !== null))
        .map((v) => ({ id: v.id, agreementId: a.id, partnerId: a.partnerId, version: v.version, sourceIds: a.sourceIds.filter((s) => period.sourceIds.includes(s)), effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, terms: v.terms })),
    );
  const partners = await listPartners(ctx, project.id);
  const rates = await ratesByIds(ctx, project.id, Object.values(period.rateSnapshotIds));
  const decisions = await db.select().from(schema.periodDecisions).where(and(eq(schema.periodDecisions.periodId, period.id), eq(schema.periodDecisions.revision, period.revision)));
  const heldRows = new Map(decisions.filter((d) => d.kind === 'row_hold').map((d) => [d.targetKey, ctx.cipher.dec('period_decisions', d.id, 'reason', d.reasonEnc)]));
  const confirmedOverlaps = new Set(decisions.filter((d) => d.kind === 'overlap_confirm').map((d) => d.targetKey));
  const sources = await db.select({ id: schema.sources.id, currency: schema.sources.defaultCurrency }).from(schema.sources).where(eq(schema.sources.projectId, project.id));
  return { period, entries, versions, partners, rates, heldRows, confirmedOverlaps, sourceCurrencies: Object.fromEntries(sources.map((s) => [s.id, s.currency])) };
}

function runEngine(project: ProjectView, e: EngineContext, overrides?: { inclusion?: Map<string, Classification>; heldRows?: Map<string, string>; confirmedOverlaps?: Set<string> }): EngineResult {
  return calculatePeriod({
    periodStart: e.period.startAt,
    periodEnd: e.period.endAt,
    entries: e.entries.map((x) => ({ ...x, inclusion: overrides?.inclusion?.get(x.id) ?? x.inclusion })),
    versions: e.versions,
    partners: e.partners.map((p) => ({ id: p.id, active: p.active, payability: p.payability })),
    rates: Object.fromEntries(e.rates.map((r) => [r.base, r])),
    now: new Date(),
    minPayoutZat: project.minPayoutZat ?? DEFAULT_MIN_PAYOUT_ZAT,
    heldRows: overrides?.heldRows ?? e.heldRows,
    confirmedOverlaps: overrides?.confirmedOverlaps ?? e.confirmedOverlaps,
    sourceCurrencies: e.sourceCurrencies,
  });
}

/** Recalculation only runs on drafts. Frozen revisions are immutable; changing them means a new revision. */
export async function recalculate(ctx: UnlockedContext, project: ProjectView, periodId: string): Promise<EngineResult> {
  const period = await getPeriod(ctx, project.id, periodId);
  if (!period) throw new ApiError('NOT_FOUND', 'Not found.');
  if (period.status !== 'draft') throw new ApiError('STALE_PERIOD_REVISION', 'This revision is frozen. Create a new revision to change it.');
  const engineCtx = await loadEngineContext(ctx, project, period);
  const result = runEngine(project, engineCtx);
  await getDb().transaction(async (tx) => {
    const [lock] = await tx.select({ status: schema.periods.status, revision: schema.periods.revision }).from(schema.periods).where(eq(schema.periods.id, period.id)).for('update');
    if (lock?.status !== 'draft' || lock.revision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'The period changed while calculating. Reload.');
    await tx.delete(schema.calculationRows).where(and(eq(schema.calculationRows.periodId, period.id), eq(schema.calculationRows.revision, period.revision)));
    for (const row of result.rows) {
      const id = randomUUID();
      await tx.insert(schema.calculationRows).values({
        id,
        periodId: period.id,
        revision: period.revision,
        rowKey: row.key,
        partnerId: row.partnerId,
        agreementId: row.agreementId,
        agreementVersionId: row.agreementVersionId,
        sourceIdsHash: row.sourceIdsHash,
        sourceEntryIds: row.sourceEntryIds,
        formulaEnc: ctx.cipher.encJson('calculation_rows', id, 'formula', row.formula),
        owedDecimal: row.formula.owed,
        currency: row.currency,
        amountZat: row.zat,
        residualZat: row.formula.residualZat,
        rateSnapshotId: row.rateSnapshotId,
        status: row.status,
        holds: row.holds,
      });
    }
    const existing = await tx.select().from(schema.periodExceptions).where(and(eq(schema.periodExceptions.periodId, period.id), eq(schema.periodExceptions.revision, period.revision)));
    const byKey = new Map(existing.map((x) => [x.key, x]));
    const liveKeys = new Set(result.exceptions.map((x) => x.key));
    for (const ex of result.exceptions) {
      const prior = byKey.get(ex.key);
      if (prior) {
        await tx.update(schema.periodExceptions).set({ affectedEntryIds: ex.entryIds, affectedRowKeys: ex.rowKeys, severity: ex.severity, detail: ex.detail, status: prior.status === 'resolved' ? 'open' : prior.status }).where(eq(schema.periodExceptions.id, prior.id));
      } else {
        const id = randomUUID();
        await tx.insert(schema.periodExceptions).values({ id, periodId: period.id, revision: period.revision, key: ex.key, code: ex.code, severity: ex.severity, affectedEntryIds: ex.entryIds, affectedRowKeys: ex.rowKeys, partnerId: ex.partnerId, moneyAtRiskEnc: ex.moneyAtRisk ? ctx.cipher.encJson('period_exceptions', id, 'money_at_risk', ex.moneyAtRisk) : null, detail: ex.detail });
      }
    }
    for (const prior of existing) {
      if (!liveKeys.has(prior.key) && prior.status !== 'resolved') await tx.update(schema.periodExceptions).set({ status: 'resolved', resolvedAt: prior.resolvedAt ?? new Date() }).where(eq(schema.periodExceptions.id, prior.id));
    }
    await tx.update(schema.periods).set({ totalsJson: result.totals, calculatedAt: new Date(), updatedAt: new Date() }).where(eq(schema.periods.id, period.id));
  });
  return result;
}

export type DecisionKind = 'exclude' | 'include' | 'hold' | 'confirm_both' | 'leave';

function decisionOverrides(ex: ExceptionView, decision: DecisionKind, base: EngineContext) {
  const inclusion = new Map<string, Classification>();
  const heldRows = new Map(base.heldRows);
  const confirmedOverlaps = new Set(base.confirmedOverlaps);
  if (decision === 'exclude') ex.entryIds.forEach((id) => inclusion.set(id, 'excluded'));
  if (decision === 'include') ex.entryIds.forEach((id) => inclusion.set(id, 'eligible'));
  if (decision === 'hold') ex.rowKeys.forEach((k) => heldRows.set(k, 'Held by operator decision'));
  if (decision === 'confirm_both') confirmedOverlaps.add(ex.key);
  return { inclusion, heldRows, confirmedOverlaps };
}

export function allowedDecisions(code: ExceptionView['code']): DecisionKind[] {
  switch (code) {
    case 'VOLUME_NOT_FEES':
    case 'DUPLICATE_REFERENCE':
    case 'REFUND_REVIEW':
    case 'UNRESOLVED_SOURCE_ROW':
      return ['exclude', 'include', 'hold', 'leave'];
    case 'AGREEMENT_OVERLAP':
      return ['confirm_both', 'hold', 'leave'];
    default:
      return ['hold', 'leave'];
  }
}

export async function previewDecision(ctx: UnlockedContext, project: ProjectView, period: PeriodView, exceptionId: string, decision: DecisionKind) {
  const ex = (await periodExceptions(ctx, period)).find((x) => x.id === exceptionId);
  if (!ex) throw new ApiError('NOT_FOUND', 'Not found.');
  if (!allowedDecisions(ex.code).includes(decision)) throw new ApiError('INVALID_INPUT', 'That decision does not apply to this exception.');
  const base = await loadEngineContext(ctx, project, period);
  const before = runEngine(project, base);
  const after = runEngine(project, base, decisionOverrides(ex, decision, base));
  const affected = new Set(after.rows.map((r) => r.key));
  const perRow = [...affected].map((key) => {
    const b = before.rows.find((r) => r.key === key);
    const a = after.rows.find((r) => r.key === key)!;
    return { key, partnerId: a.partnerId, currency: a.currency, beforeOwed: b?.formula.owed ?? '0', afterOwed: a.formula.owed, beforeStatus: b?.status ?? 'nothing_owed', afterStatus: a.status, beforeZat: b?.zat?.toString() ?? null, afterZat: a.zat?.toString() ?? null };
  }).filter((r) => r.beforeOwed !== r.afterOwed || r.beforeStatus !== r.afterStatus);
  return { before: before.totals, after: after.totals, rows: perRow };
}

/** Records a decision with a reason and recalculates. Only drafts accept decisions; frozen revisions need a new revision. */
export async function decideException(ctx: UnlockedContext, project: ProjectView, period: PeriodView, exceptionId: string, decision: DecisionKind, reason: string): Promise<void> {
  if (period.status !== 'draft') throw new ApiError('STALE_PERIOD_REVISION', 'Decisions are locked after freezing. Create a new revision to change them.');
  const ex = (await periodExceptions(ctx, period)).find((x) => x.id === exceptionId);
  if (!ex) throw new ApiError('NOT_FOUND', 'Not found.');
  if (!allowedDecisions(ex.code).includes(decision)) throw new ApiError('INVALID_INPUT', 'That decision does not apply to this exception.');
  const preview = await previewDecision(ctx, project, period, exceptionId, decision);
  await getDb().transaction(async (tx) => {
    if (decision === 'exclude' || decision === 'include') {
      for (const entryId of ex.entryIds) {
        await tx.update(schema.periodSources).set({ inclusion: decision === 'exclude' ? 'excluded' : 'eligible', reasonEnc: ctx.cipher.enc('period_sources', `${period.id}:${entryId}`, 'reason', reason), decidedAt: new Date() }).where(and(eq(schema.periodSources.periodId, period.id), eq(schema.periodSources.revenueEntryId, entryId)));
      }
    }
    const recordDecision = async (kind: string, targetKey: string) => {
      const id = randomUUID();
      await tx.insert(schema.periodDecisions).values({ id, periodId: period.id, revision: period.revision, kind, targetKey, reasonEnc: ctx.cipher.enc('period_decisions', id, 'reason', reason), decidedBy: ctx.ownerId }).onConflictDoNothing();
    };
    if (decision === 'hold') for (const key of ex.rowKeys) await recordDecision('row_hold', key);
    if (decision === 'confirm_both') await recordDecision('overlap_confirm', ex.key);
    await tx
      .update(schema.periodExceptions)
      .set({ status: decision === 'leave' ? 'open' : decision === 'hold' ? 'held' : 'resolved', decision, reasonEnc: ctx.cipher.enc('period_exceptions', ex.id, 'reason', reason), beforeAfterEnc: ctx.cipher.encJson('period_exceptions', ex.id, 'before_after', preview), resolvedBy: ctx.ownerId, resolvedAt: new Date() })
      .where(eq(schema.periodExceptions.id, ex.id));
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'exception.decided', objectType: 'period', objectId: period.id, diff: { code: ex.code, decision, before: preview.before.owedByCurrency, after: preview.after.owedByCurrency }, reason }, tx);
  });
  await recalculate(ctx, project, period.id);
}

/** A decided entry exception must not reopen on recalculation just because its key still exists. */
export function openBlocking(exceptions: ExceptionView[]): ExceptionView[] {
  return exceptions.filter((x) => x.status === 'open' && x.severity === 'blocking');
}

export async function buildSnapshot(ctx: UnlockedContext, project: ProjectView, period: PeriodView, network: string, accountId: string): Promise<FrozenSnapshot> {
  const rows = await periodRows(ctx, period);
  const partners = new Map((await listPartners(ctx, project.id)).map((p) => [p.id, p]));
  const payouts: SnapshotPayout[] = [];
  const held: FrozenSnapshot['held'] = [];
  for (const row of rows.sort((a, b) => a.key.localeCompare(b.key))) {
    if (row.status === 'payable' && row.zat !== null) {
      const partner = partners.get(row.partnerId);
      if (!partner?.address || partner.payability !== 'ok') throw new ApiError('ADDRESS_CHANGED', 'A payee address changed or is no longer valid. Recalculate the draft.');
      payouts.push({ payoutKey: row.key, partnerId: row.partnerId, agreementVersionId: row.agreementVersionId, addressVersionId: partner.address.id, addressFingerprint: addressFingerprint(partner.address.address), amountZat: row.zat.toString(), owed: row.owed, currency: row.currency, rateSnapshotId: row.rateSnapshotId, sourceIdsHash: row.sourceIdsHash });
    } else if (row.status === 'held' || row.status === 'credit') {
      held.push({ rowKey: row.key, partnerId: row.partnerId, reasons: row.holds.map((h) => h.detail ? `${HOLD_TEXT[h.code]} (${h.detail})` : HOLD_TEXT[h.code]) });
    }
  }
  return {
    periodId: period.id,
    revision: period.revision,
    periodStart: period.startAt.toISOString(),
    periodEnd: period.endAt.toISOString(),
    formulaVersion: FORMULA_VERSION,
    network,
    accountId,
    privacyPolicy: 'FullPrivacy',
    payouts,
    held,
    totalZat: payouts.reduce((s, p) => s + BigInt(p.amountZat), 0n).toString(),
  };
}

export function snapshotScope(s: FrozenSnapshot) {
  return { periodId: s.periodId, revision: s.revision, snapshotHash: hashCanonical(s), accountId: s.accountId, network: s.network, totalZat: s.totalZat, recipientsDigest: recipientsDigest(s.payouts) };
}

export async function freezePeriod(ctx: UnlockedContext, project: ProjectView, period: PeriodView, network: string, accountId: string): Promise<{ snapshotHash: string }> {
  if (period.status !== 'draft') throw new ApiError('STALE_PERIOD_REVISION', 'Only a draft can be frozen.');
  const result = await recalculate(ctx, project, period.id);
  const exceptions = await periodExceptions(ctx, period);
  const open = openBlocking(exceptions);
  if (open.length > 0) throw new ApiError('INVALID_INPUT', `${open.length} blocking exception(s) still need a decision. Resolve, exclude or hold each one first.`, { recoveryAction: 'exceptions' });
  if (result.totals.payableCount === 0) throw new ApiError('INVALID_INPUT', 'Nothing is payable in this period yet, so there is nothing to approve.');
  const snapshot = await buildSnapshot(ctx, project, period, network, accountId);
  const hash = hashCanonical(snapshot);
  const [updated] = await getDb()
    .update(schema.periods)
    .set({ status: 'review', frozenSnapshotEnc: ctx.cipher.encJson('periods', period.id, 'frozen_snapshot', snapshot), frozenSnapshotHash: hash, frozenAt: new Date(), version: period.version + 1, updatedAt: new Date() })
    .where(and(eq(schema.periods.id, period.id), eq(schema.periods.status, 'draft'), eq(schema.periods.revision, period.revision)))
    .returning({ id: schema.periods.id });
  if (!updated) throw new ApiError('STALE_PERIOD_REVISION', 'The period changed. Reload.');
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.frozen', objectType: 'period', objectId: period.id, diff: { revision: period.revision, snapshotHash: hash, payouts: snapshot.payouts.length, totalZat: snapshot.totalZat } });
  return { snapshotHash: hash };
}

export async function frozenSnapshot(ctx: UnlockedContext, periodId: string): Promise<FrozenSnapshot | null> {
  const [r] = await getDb().select({ enc: schema.periods.frozenSnapshotEnc }).from(schema.periods).where(eq(schema.periods.id, periodId));
  return r?.enc ? ctx.cipher.decJson<FrozenSnapshot>('periods', periodId, 'frozen_snapshot', r.enc) : null;
}

/**
 * Starts revision N+1 from a frozen or approved-but-unsigned revision. Prior decisions carry over so the operator does
 * not redo them; the old approval is invalidated and its snapshot stays in the record.
 */
export async function newRevision(ctx: UnlockedContext, project: ProjectView, period: PeriodView, reason: string): Promise<void> {
  if (period.status !== 'review' && period.status !== 'approved') throw new ApiError('STALE_PERIOD_REVISION', 'Only a frozen or approved, unpaid period can be revised.');
  await getDb().transaction(async (tx) => {
    if (period.status === 'approved') {
      const [approval] = await tx.select().from(schema.approvals).where(and(eq(schema.approvals.periodId, period.id), eq(schema.approvals.revision, period.revision)));
      if (approval) {
        const txs = await tx.select({ state: schema.chainTransactions.state }).from(schema.chainTransactions).innerJoin(schema.paymentBatches, eq(schema.paymentBatches.id, schema.chainTransactions.batchId)).where(and(eq(schema.paymentBatches.approvalId, approval.id), notInArray(schema.chainTransactions.state, ['CANCELLED_BEFORE_SIGN', 'FAILED_PRE_BROADCAST'])));
        if (txs.some((t) => !['PREPARING', 'PREPARED_INSPECTED'].includes(t.state))) throw new ApiError('FORBIDDEN', 'A transaction for this approval is already signed or broadcast. Record corrections in a later period.');
        await tx.update(schema.approvals).set({ invalidatedAt: new Date(), invalidationReason: reason }).where(eq(schema.approvals.id, approval.id));
        await tx.update(schema.payoutIntents).set({ state: 'superseded', updatedAt: new Date() }).where(eq(schema.payoutIntents.approvalId, approval.id));
        await tx.update(schema.chainTransactions).set({ state: 'CANCELLED_BEFORE_SIGN', diagnosis: 'Superseded by a new revision', updatedAt: new Date() }).where(inArray(schema.chainTransactions.batchId, tx.select({ id: schema.paymentBatches.id }).from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approval.id))));
      }
    }
    const next = period.revision + 1;
    const decisions = await tx.select().from(schema.periodDecisions).where(and(eq(schema.periodDecisions.periodId, period.id), eq(schema.periodDecisions.revision, period.revision)));
    for (const d of decisions) {
      const id = randomUUID();
      await tx.insert(schema.periodDecisions).values({ id, periodId: period.id, revision: next, kind: d.kind, targetKey: d.targetKey, reasonEnc: ctx.cipher.enc('period_decisions', id, 'reason', ctx.cipher.dec('period_decisions', d.id, 'reason', d.reasonEnc)), decidedBy: d.decidedBy });
    }
    await tx.update(schema.periods).set({ status: 'draft', revision: next, frozenSnapshotEnc: null, frozenSnapshotHash: null, frozenAt: null, approvedSnapshotId: null, version: period.version + 1, updatedAt: new Date() }).where(eq(schema.periods.id, period.id));
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.revised', objectType: 'period', objectId: period.id, diff: { from: period.revision, to: next }, reason }, tx);
  });
  await recalculate(ctx, project, period.id);
}

export async function periodEntries(ctx: UnlockedContext, periodId: string) {
  const rows = await getDb().select({ inclusion: schema.periodSources.inclusion, reasonEnc: schema.periodSources.reasonEnc, entryId: schema.periodSources.revenueEntryId }).from(schema.periodSources).where(eq(schema.periodSources.periodId, periodId));
  return new Map(rows.map((r) => [r.entryId, { inclusion: r.inclusion as Classification, reason: r.reasonEnc ? ctx.cipher.dec('period_sources', `${periodId}:${r.entryId}`, 'reason', r.reasonEnc) : null }]));
}
