import { getDb, schema, eq, desc, inArray } from '@setrya/db';

import { ApiError } from '../http/route';
import { listPartners } from '../services/partners';
import { listPeriods } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { buildStatement, listStatements } from '../services/statements';

import { defineView } from './define';

export const statementsViews = {
  'statements.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [list, partners, periods] = await Promise.all([listStatements(project.id, { periodId: q.optional('period'), partnerId: q.optional('partner') }), listPartners(ctx, project.id), listPeriods(ctx, project.id)]);
    const docs = new Map(await Promise.all(list.map(async (s) => [s.id, await buildStatement(ctx, project, s.id)] as const)));
    return { project, list, partners, periods, docs };
  }),
  'statements.detail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const doc = await buildStatement(ctx, project, q.get('statementId'));
    if (!doc) throw new ApiError('NOT_FOUND', 'This statement does not exist.');
    const shares = await getDb().select().from(schema.statementShares).where(eq(schema.statementShares.statementId, doc.id)).orderBy(desc(schema.statementShares.createdAt));
    const acks = shares.length === 0 ? [] : await getDb().select().from(schema.recipientAcknowledgments).where(inArray(schema.recipientAcknowledgments.statementShareId, shares.map((s) => s.id)));
    return { project, doc, shares, acks };
  }),
};
