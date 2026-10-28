import { z } from 'zod';

import { body, route } from '../../../../../../../../../http/route';
import { previewDecision, requirePeriodApi } from '../../../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../../../services/projects';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId, exceptionId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const { decision } = await body(req, z.object({ decision: z.enum(['exclude', 'include', 'hold', 'confirm_both', 'leave']) }));
  return previewDecision(ctx, project, period, exceptionId!, decision);
});
