import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../../../http/route';
import { decideException, requirePeriodApi } from '../../../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../../../services/projects';
import { reason } from '../../../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId, exceptionId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const input = await body(req, z.object({ decision: z.enum(['exclude', 'include', 'hold', 'confirm_both', 'leave']), reason, expectedRevision: z.number().int() }));
  if (input.expectedRevision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'This period was revised elsewhere. Reload.');
  await decideException(ctx, project, period, exceptionId!, input.decision, input.reason);
  return { ok: true };
});
