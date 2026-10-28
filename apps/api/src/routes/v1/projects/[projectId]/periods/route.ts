import { ApiError, body, route } from '../../../../../http/route';
import { createPeriod, listPeriods } from '../../../../../services/periods';
import { requireProjectApi } from '../../../../../services/projects';
import { ratesByIds } from '../../../../../services/rates';
import { periodInputSchema, periodRange } from '../../../../../services/schemas';
import { listSources } from '../../../../../services/sources';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => listPeriods(ctx, (await requireProjectApi(ctx, projectId!)).id));

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, periodInputSchema);
  const sources = new Set((await listSources(ctx, project.id)).map((s) => s.id));
  if (input.sourceIds.some((s) => !sources.has(s))) throw new ApiError('INVALID_INPUT', 'Unknown source.', { fieldErrors: { sourceIds: 'Unknown source' } });
  const rates = await ratesByIds(ctx, project.id, Object.values(input.rateSnapshotIds));
  for (const [currency, id] of Object.entries(input.rateSnapshotIds)) if (!rates.some((r) => r.id === id && r.base === currency)) throw new ApiError('INVALID_INPUT', `The ${currency} rate does not belong to this project.`);
  const { startAt, endAt } = periodRange(input.startDate, input.endDate, project.timezone);
  if (endAt <= startAt) throw new ApiError('INVALID_INPUT', 'The end date must be on or after the start date.', { fieldErrors: { endDate: 'Before the start' } });
  return { id: await createPeriod(ctx, project, { label: input.label, startAt, endAt, sourceIds: input.sourceIds, rateSnapshotIds: input.rateSnapshotIds }) };
});
