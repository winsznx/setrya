import { getDb, schema, eq, and, asc, inArray } from '@setrya/db';
import type { InspectionReview } from '@setrya/wallet-adapter';

import { approvalChecks } from '../services/approvals';
import { reconciliation } from '../services/close';
import { loadPeriodPage } from '../services/period-view';
import { allowedDecisions, listPeriods, openBlocking } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { listRates } from '../services/rates';
import { networkLabel, walletSummary } from '../services/shell';
import { listSources } from '../services/sources';
import { walletHealth } from '../services/wallet';

import { defineView } from './define';

const CLOSABLE = ['approved', 'in_payment', 'settled', 'closed'];

export const periodsViews = {
  'periods.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [periods, sources] = await Promise.all([listPeriods(ctx, project.id), listSources(ctx, project.id)]);
    const ids = periods.map((p) => p.id);
    const open = ids.length ? await getDb().select({ periodId: schema.periodExceptions.periodId, revision: schema.periodExceptions.revision }).from(schema.periodExceptions).where(and(inArray(schema.periodExceptions.periodId, ids), eq(schema.periodExceptions.status, 'open'), eq(schema.periodExceptions.severity, 'blocking'))) : [];
    const uncertain = ids.length ? await getDb().select({ periodId: schema.approvals.periodId }).from(schema.chainTransactions).innerJoin(schema.paymentBatches, eq(schema.paymentBatches.id, schema.chainTransactions.batchId)).innerJoin(schema.approvals, eq(schema.approvals.id, schema.paymentBatches.approvalId)).where(and(inArray(schema.approvals.periodId, ids), inArray(schema.chainTransactions.state, ['BROADCAST_OUTCOME_UNKNOWN', 'INVESTIGATION_REQUIRED', 'STALE_OR_REORGED']))) : [];
    return { project, periods, sources, open, uncertain };
  }),

  'periods.new': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [sources, rates, health] = await Promise.all([listSources(ctx, project.id), listRates(ctx, project.id), walletHealth({ minConf: project.minConfirmations })]);
    return { project, sources, rates, health };
  }),

  'periods.detail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await loadPeriodPage(ctx, project, q.get('periodId'));
    const liveRates = (await listRates(ctx, project.id)).filter((r) => r.expiresAt > new Date() || Object.values(d.period.rateSnapshotIds).includes(r.id));
    return { project, d, liveRates, blocking: openBlocking(d.exceptions) };
  }),

  'periods.exceptions': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await loadPeriodPage(ctx, project, q.get('periodId'));
    const allowed = new Map(d.exceptions.map((x) => [x.id, allowedDecisions(x.code)]));
    return { project, d, allowed };
  }),

  'periods.close': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await loadPeriodPage(ctx, project, q.get('periodId'));
    const recon = CLOSABLE.includes(d.period.status) ? await reconciliation(ctx, d.period) : null;
    return { project, d, recon };
  }),

  'periods.review': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await loadPeriodPage(ctx, project, q.get('periodId'));
    const approval = d.period.status === 'draft' ? null : await approvalChecks(ctx, project, d.period);
    return { project, d, approval, network: networkLabel() };
  }),

  'periods.send': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await loadPeriodPage(ctx, project, q.get('periodId'));
    const network = networkLabel();
    if (!d.approval) return { project, d, health: null, walletLabel: null, network, batches: [] };
    const health = await walletHealth({ minConf: project.minConfirmations });
    const batches = await Promise.all(
      d.batches.map(async (b) => {
        const attempts = await getDb().select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.batchId, b.id)).orderBy(asc(schema.paymentAttempts.createdAt));
        const review = b.tx?.inspectionEnc ? ctx.cipher.decJson<InspectionReview>('chain_transactions', b.tx.id, 'inspection', b.tx.inspectionEnc) : null;
        return {
          id: b.id,
          sequence: b.sequence,
          of: b.of,
          totalZat: b.totalZat.toString(),
          recipients: d.intents.filter((i) => i.batchId === b.id).map((i) => ({ id: i.id, name: d.partners.get(i.partnerId)?.displayName ?? '', zat: i.amountZat.toString(), fingerprint: i.addressFingerprint, memo: i.memoRef })),
          tx: b.tx ? { id: b.tx.id, state: b.txState!, txid: b.tx.txid, feeZat: b.tx.feeZat?.toString() ?? null, confirmations: b.tx.confirmations, height: b.tx.height, diagnosis: b.tx.diagnosis, lastError: b.tx.lastError, lastCheckedAt: b.tx.lastCheckedAt?.toISOString() ?? null, broadcastAt: b.tx.broadcastAt?.toISOString() ?? null, lineage: b.tx.lineage, walletObserved: b.tx.walletObservedAt !== null, pcztHash: b.tx.pcztHash } : null,
          review: review ? { ok: review.ok, feeZat: review.feeZat?.toString() ?? null, pool: review.pool, expiryHeight: review.expiryHeight, checks: review.checks, matched: review.matched.length } : null,
          attempts: attempts.map((a) => ({ id: a.id, stage: a.stage, outcome: a.outcome, at: a.createdAt.toISOString(), detail: a.detail, errorCode: a.errorCode, requestId: a.requestId })),
        };
      }),
    );
    return { project, d, health, walletLabel: walletSummary(health).label, network, batches };
  }),
};
