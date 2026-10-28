import { getDb, schema, eq, and, desc, gte, inArray, isNull, sql } from '@setrya/db';
import { decToString, parseDec, startOfDayInZone, sum } from '@setrya/domain';

import { listPeriods, type PeriodView } from './periods';
import type { ProjectView } from './projects';
import type { UnlockedContext } from './session';

function monthStart(zone: string, now = new Date()): Date {
  return startOfDayInZone(`${new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' }).format(now)}-01`, zone);
}

function grouped(rows: { currency: string; amount: string }[]): Record<string, string> {
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.currency, [...(by.get(r.currency) ?? []), r.amount]);
  return Object.fromEntries([...by].sort().map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))]));
}

export async function overview(ctx: UnlockedContext, project: ProjectView) {
  const db = getDb();
  const since = monthStart(project.timezone);
  const eligible = await db.select({ currency: schema.revenueEntries.currency, amount: schema.revenueEntries.amountDecimal }).from(schema.revenueEntries).where(and(eq(schema.revenueEntries.projectId, project.id), eq(schema.revenueEntries.classification, 'eligible'), gte(schema.revenueEntries.occurredAt, since), isNull(schema.revenueEntries.voidedAt)));
  const heldEntries = await db.select({ n: sql<number>`count(*)::int` }).from(schema.revenueEntries).where(and(eq(schema.revenueEntries.projectId, project.id), eq(schema.revenueEntries.classification, 'held'), isNull(schema.revenueEntries.voidedAt)));

  const intents = await db
    .select({ amountZat: schema.payoutIntents.amountZat, state: schema.payoutIntents.state, owed: schema.calculationRows.owedDecimal, currency: schema.calculationRows.currency, minedAt: schema.chainTransactions.minedAt, txState: schema.chainTransactions.state })
    .from(schema.payoutIntents)
    .innerJoin(schema.approvals, and(eq(schema.approvals.id, schema.payoutIntents.approvalId), isNull(schema.approvals.invalidatedAt)))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.payoutIntents.periodId))
    .innerJoin(schema.calculationRows, eq(schema.calculationRows.id, schema.payoutIntents.calculationRowId))
    .leftJoin(schema.chainTransactions, eq(schema.chainTransactions.id, schema.payoutIntents.chainTransactionId))
    .where(eq(schema.periods.projectId, project.id));
  const unpaid = intents.filter((i) => i.txState !== 'CONFIRMED' && !['failed', 'cancelled', 'superseded'].includes(i.state));
  const settled = intents.filter((i) => i.txState === 'CONFIRMED' && i.minedAt && i.minedAt >= since);

  const [exceptions] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.periodExceptions)
    .innerJoin(schema.periods, and(eq(schema.periods.id, schema.periodExceptions.periodId), eq(schema.periods.revision, schema.periodExceptions.revision)))
    .where(and(eq(schema.periods.projectId, project.id), eq(schema.periodExceptions.status, 'open'), eq(schema.periods.status, 'draft')));

  const periods = await listPeriods(ctx, project.id);
  const [imports] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.importBatches).where(and(eq(schema.importBatches.projectId, project.id), isNull(schema.importBatches.voidedAt)));
  const openByPeriod = new Map<string, number>();
  if (periods.length) {
    const rows = await db.select({ periodId: schema.periodExceptions.periodId, revision: schema.periodExceptions.revision, n: sql<number>`count(*)::int` }).from(schema.periodExceptions).where(and(inArray(schema.periodExceptions.periodId, periods.map((p) => p.id)), eq(schema.periodExceptions.status, 'open'), eq(schema.periodExceptions.severity, 'blocking'))).groupBy(schema.periodExceptions.periodId, schema.periodExceptions.revision);
    for (const r of rows) if (periods.find((p) => p.id === r.periodId)?.revision === r.revision) openByPeriod.set(r.periodId, r.n);
  }
  const pipeline = {
    imported: imports?.n ?? 0,
    calculated: periods.filter((p) => p.status === 'draft' && !openByPeriod.get(p.id)).length,
    needsReview: periods.filter((p) => p.status === 'draft' && (openByPeriod.get(p.id) ?? 0) > 0).length,
    ready: periods.filter((p) => p.status === 'review' || p.status === 'approved').length,
    sent: periods.filter((p) => p.status === 'in_payment' || p.status === 'settled').length,
    closed: periods.filter((p) => p.status === 'closed').length,
  };

  const trendRows = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${schema.revenueEntries.occurredAt} at time zone ${project.timezone}), 'YYYY-MM-DD')`, currency: schema.revenueEntries.currency, amounts: sql<string[]>`array_agg(${schema.revenueEntries.amountDecimal})` })
    .from(schema.revenueEntries)
    .where(and(eq(schema.revenueEntries.projectId, project.id), eq(schema.revenueEntries.classification, 'eligible'), isNull(schema.revenueEntries.voidedAt), gte(schema.revenueEntries.occurredAt, new Date(Date.now() - 120 * 86_400_000))))
    .groupBy(sql`1`, schema.revenueEntries.currency)
    .orderBy(sql`1`);
  const trend = trendRows.map((r) => ({ day: r.day, currency: r.currency, total: decToString(sum(r.amounts.map((a) => parseDec(a)))) }));

  const activity = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.projectId, project.id)).orderBy(desc(schema.auditEvents.createdAt)).limit(5);

  return {
    since,
    eligibleThisMonth: grouped(eligible),
    approvedUnpaid: { zat: unpaid.reduce((s, i) => s + i.amountZat, 0n), owed: grouped(unpaid.map((i) => ({ currency: i.currency, amount: i.owed }))), count: unpaid.length },
    settledThisMonth: { zat: settled.reduce((s, i) => s + i.amountZat, 0n), count: settled.length },
    needsReview: (exceptions?.n ?? 0) + (heldEntries[0]?.n ?? 0),
    openExceptions: exceptions?.n ?? 0,
    heldEntries: heldEntries[0]?.n ?? 0,
    pipeline,
    periods: periods.slice(0, 6),
    openByPeriod,
    trend,
    activity,
  };
}

export async function partnersDue(ctx: UnlockedContext, project: ProjectView, periods: PeriodView[]) {
  const live = periods.filter((p) => ['draft', 'review', 'approved', 'in_payment'].includes(p.status)).map((p) => ({ id: p.id, revision: p.revision }));
  if (live.length === 0) return [];
  const rows = await getDb().select({ partnerId: schema.calculationRows.partnerId, periodId: schema.calculationRows.periodId, revision: schema.calculationRows.revision, owed: schema.calculationRows.owedDecimal, currency: schema.calculationRows.currency, zat: schema.calculationRows.amountZat, status: schema.calculationRows.status }).from(schema.calculationRows).where(inArray(schema.calculationRows.periodId, live.map((p) => p.id)));
  const current = rows.filter((r) => live.some((p) => p.id === r.periodId && p.revision === r.revision) && (r.status === 'payable' || r.status === 'held'));
  const by = new Map<string, { owed: { currency: string; amount: string }[]; zat: bigint; held: number }>();
  for (const r of current) {
    const e = by.get(r.partnerId) ?? { owed: [], zat: 0n, held: 0 };
    e.owed.push({ currency: r.currency, amount: r.owed });
    if (r.status === 'payable' && r.zat) e.zat += r.zat;
    if (r.status === 'held') e.held += 1;
    by.set(r.partnerId, e);
  }
  return [...by].map(([partnerId, v]) => ({ partnerId, owed: grouped(v.owed), zat: v.zat, held: v.held })).sort((a, b) => (b.zat > a.zat ? 1 : -1)).slice(0, 3);
}
