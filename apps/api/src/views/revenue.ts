import { ApiError } from '../http/route';
import { getImport, importLockedByPeriods, listImports } from '../services/imports';
import { listPeriods } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { listEntries, summarize } from '../services/revenue';
import { getSource, listSources, sourceStats } from '../services/sources';

import { defineView } from './define';

export const revenueViews = {
  'revenue.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [sources, entries, imports, periods] = await Promise.all([listSources(ctx, project.id), listEntries(ctx, project.id), listImports(ctx, project.id), listPeriods(ctx, project.id)]);
    return { project, sources, entries, imports, periods, summary: summarize(entries) };
  }),
  'revenue.import': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const sources = (await listSources(ctx, project.id)).filter((s) => s.enabled);
    return { project, sources };
  }),
  'revenue.sources': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [sources, stats] = await Promise.all([listSources(ctx, project.id), sourceStats(project.id)]);
    return { project, sources, stats };
  }),
  'revenue.importDetail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const batch = await getImport(ctx, project.id, q.get('importId'));
    if (!batch) throw new ApiError('NOT_FOUND', 'This import does not exist.');
    const [source, entries, periods, lockedBy] = await Promise.all([getSource(ctx, project.id, batch.sourceId), listEntries(ctx, project.id, { batchId: batch.id, includeVoided: true }), listPeriods(ctx, project.id), importLockedByPeriods(batch.id)]);
    return { project, batch, source, entries, periods, lockedBy, summary: summarize(entries.filter((e) => !e.voided)) };
  }),
};
