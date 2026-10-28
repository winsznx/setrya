import { getDb, schema, eq, and, desc } from '@setrya/db';

import { ApiError } from '../http/route';
import { listAgreements } from '../services/agreements';
import { partnerSettlements } from '../services/partner-history';
import { addressHistory, getPartner, listPartners } from '../services/partners';
import { listPeriods } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { networkLabel } from '../services/shell';

import { defineView } from './define';

export const partnersViews = {
  'partners.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [partners, agreements] = await Promise.all([listPartners(ctx, project.id), listAgreements(ctx, project.id)]);
    const history = new Map(await Promise.all(partners.map(async (p) => [p.id, await partnerSettlements(project.id, p.id)] as const)));
    return { project, partners, agreements, history };
  }),
  'partners.new': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    return { project, network: networkLabel() };
  }),
  'partners.detail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const partner = await getPartner(ctx, project.id, q.get('partnerId'));
    if (!partner) throw new ApiError('NOT_FOUND', 'This partner does not exist.');
    const [agreements, lines, periods, history, statements] = await Promise.all([
      listAgreements(ctx, project.id, partner.id),
      partnerSettlements(project.id, partner.id),
      listPeriods(ctx, project.id),
      addressHistory(ctx, partner.id),
      getDb().select().from(schema.statements).where(and(eq(schema.statements.projectId, project.id), eq(schema.statements.partnerId, partner.id))).orderBy(desc(schema.statements.generatedAt)),
    ]);
    const [lastIntent] = await getDb().select({ approvedAt: schema.approvals.approvedAt }).from(schema.payoutIntents).innerJoin(schema.approvals, eq(schema.approvals.id, schema.payoutIntents.approvalId)).where(eq(schema.payoutIntents.partnerId, partner.id)).orderBy(desc(schema.approvals.approvedAt)).limit(1);
    return { project, partner, agreements, lines, periods, history, statements, lastIntent: lastIntent ?? null };
  }),
  'partners.edit': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const partner = await getPartner(ctx, project.id, q.get('partnerId'));
    if (!partner) throw new ApiError('NOT_FOUND', 'This partner does not exist.');
    const unsettled = (await listPeriods(ctx, project.id)).filter((p) => ['draft', 'review', 'approved'].includes(p.status)).map((p) => p.label);
    return { project, partner, unsettled, network: networkLabel() };
  }),
};
