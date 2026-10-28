import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { approvePeriod } from '../../../../../../../services/approvals';
import { requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const input = await body(req, z.object({ stepUpToken: z.string().min(10), expectedRevision: z.number().int(), confirmTotalZat: z.string() }));
  if (input.expectedRevision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'This period was revised elsewhere. Reload.');
  return approvePeriod(ctx, project, period, input.stepUpToken, input.confirmTotalZat);
});
