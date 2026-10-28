import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { freezePeriod, requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';
import { approvalTarget } from '../../../../../../../services/step-up-scopes';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const { expectedRevision } = await body(req, z.object({ expectedRevision: z.number().int() }));
  if (expectedRevision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'This period was revised elsewhere. Reload.');
  const { network, accountId } = approvalTarget();
  return freezePeriod(ctx, project, period, network, accountId);
});
