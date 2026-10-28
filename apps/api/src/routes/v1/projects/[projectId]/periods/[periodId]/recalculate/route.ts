import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { recalculate, requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const { expectedRevision } = await body(req, z.object({ expectedRevision: z.number().int() }));
  if (expectedRevision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'This period was revised elsewhere. Reload.');
  const result = await recalculate(ctx, project, period.id);
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.calculated', objectType: 'period', objectId: period.id, diff: { revision: period.revision, payable: result.totals.payableCount, held: result.totals.heldCount } });
  return result.totals;
});
