import { route } from '../../../../../../http/route';
import { periodExceptions, periodRows, requirePeriodApi } from '../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../services/projects';

export const GET = route('unlocked', async (_req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  return { period, rows: await periodRows(ctx, period), exceptions: await periodExceptions(ctx, period) };
});
