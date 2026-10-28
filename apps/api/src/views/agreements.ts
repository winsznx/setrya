import { getDb, schema, eq, desc } from '@setrya/db';

import { ApiError } from '../http/route';
import { getAgreement, listAgreements, periodsUsingVersions } from '../services/agreements';
import { getPartner, listPartners } from '../services/partners';
import { listPeriods } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { listSources } from '../services/sources';

import { defineView } from './define';

export const agreementsViews = {
  'agreements.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [agreements, partners, sources] = await Promise.all([listAgreements(ctx, project.id), listPartners(ctx, project.id), listSources(ctx, project.id)]);
    return { project, agreements, partners, sources };
  }),
  'agreements.new': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [partners, sources] = await Promise.all([listPartners(ctx, project.id), listSources(ctx, project.id)]);
    return { project, partners, sources };
  }),
  'agreements.detail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const agreement = await getAgreement(ctx, project.id, q.get('agreementId'));
    if (!agreement) throw new ApiError('NOT_FOUND', 'This agreement does not exist.');
    const [partner, sources, usage, periods, events] = await Promise.all([
      getPartner(ctx, project.id, agreement.partnerId),
      listSources(ctx, project.id),
      periodsUsingVersions(agreement.versions.map((v) => v.id)),
      listPeriods(ctx, project.id),
      getDb().select().from(schema.auditEvents).where(eq(schema.auditEvents.objectId, agreement.id)).orderBy(desc(schema.auditEvents.createdAt)).limit(20),
    ]);
    return { project, agreement, partner, sources, usage, periods, events };
  }),
  'agreements.edit': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const agreement = await getAgreement(ctx, project.id, q.get('agreementId'));
    if (!agreement) throw new ApiError('NOT_FOUND', 'This agreement does not exist.');
    const [partners, sources] = await Promise.all([listPartners(ctx, project.id), listSources(ctx, project.id)]);
    return { project, agreement, partners, sources };
  }),
};
