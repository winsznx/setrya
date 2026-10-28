import { getDb, schema, eq, asc, desc, inArray } from '@setrya/db';
import { type TxState } from '@setrya/domain';

import { ApiError } from '../http/route';

import { listAgreements } from './agreements';
import { activeApproval } from './approvals';
import { listPartners } from './partners';
import { getPeriod, periodEntries, periodExceptions, periodRows } from './periods';
import type { ProjectView } from './projects';
import { ratesByIds } from './rates';
import { listEntries } from './revenue';
import type { UnlockedContext } from './session';
import { listSources } from './sources';

export async function loadPeriodPage(ctx: UnlockedContext, project: ProjectView, periodId: string) {
  const period = await getPeriod(ctx, project.id, periodId);
  if (!period) throw new ApiError('NOT_FOUND', 'This period does not exist.');
  const [rows, exceptions, partners, agreements, sources, rates, inclusion, approval] = await Promise.all([
    periodRows(ctx, period),
    periodExceptions(ctx, period),
    listPartners(ctx, project.id),
    listAgreements(ctx, project.id),
    listSources(ctx, project.id),
    ratesByIds(ctx, project.id, Object.values(period.rateSnapshotIds)),
    periodEntries(ctx, period.id),
    activeApproval(period.id, period.revision),
  ]);
  const entries = await listEntries(ctx, project.id, { ids: [...inclusion.keys()], includeVoided: true });
  const batches = approval ? await getDb().select().from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approval.id)).orderBy(asc(schema.paymentBatches.sequence)) : [];
  const txs = batches.length ? await getDb().select().from(schema.chainTransactions).where(inArray(schema.chainTransactions.batchId, batches.map((b) => b.id))).orderBy(desc(schema.chainTransactions.lineage)) : [];
  const intents = approval ? await getDb().select().from(schema.payoutIntents).where(eq(schema.payoutIntents.approvalId, approval.id)) : [];
  const decisions = await getDb().select().from(schema.auditEvents).where(eq(schema.auditEvents.objectId, period.id)).orderBy(desc(schema.auditEvents.createdAt));
  const latestTx = (batchId: string) => txs.find((t) => t.batchId === batchId) ?? null;
  return {
    period,
    rows,
    exceptions,
    partners: new Map(partners.map((p) => [p.id, p])),
    agreements: new Map(agreements.map((a) => [a.id, a])),
    sources,
    rates,
    inclusion,
    entries,
    approval,
    batches: batches.map((b) => ({ ...b, tx: latestTx(b.id), txState: (latestTx(b.id)?.state as TxState | undefined) ?? null })),
    intents,
    events: decisions.map((d) => ({ id: d.id, eventType: d.eventType, createdAt: d.createdAt, reason: d.reasonEnc ? ctx.cipher.dec('audit_events', d.id, 'reason', d.reasonEnc) : null })),
  };
}

export type PeriodPage = Awaited<ReturnType<typeof loadPeriodPage>>;
