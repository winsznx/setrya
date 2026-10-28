import { z } from 'zod';

import { body, route } from '../../../../../../../http/route';
import { newRevision, requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';
import { reason } from '../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const input = await body(req, z.object({ reason }));
  await newRevision(ctx, project, period, input.reason);
  return { ok: true };
});
