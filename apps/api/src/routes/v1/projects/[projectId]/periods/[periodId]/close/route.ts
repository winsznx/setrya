import { z } from 'zod';

import { body, route } from '../../../../../../../http/route';
import { closePeriod } from '../../../../../../../services/close';
import { requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';

export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const input = await body(req, z.object({ dispositions: z.record(z.string(), z.object({ disposition: z.enum(['carry_forward', 'waived', 'remain_open']), reason: z.string().max(500) })), note: z.string().trim().max(1000), confirm: z.literal(true) }));
  await closePeriod(ctx, project, period, input.dispositions, input.note);
  return { ok: true };
});
