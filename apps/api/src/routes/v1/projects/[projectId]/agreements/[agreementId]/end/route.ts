import { startOfDayInZone } from '@setrya/domain';
import { z } from 'zod';

import { body, route } from '../../../../../../../http/route';
import { endAgreement } from '../../../../../../../services/agreements';
import { requireProjectApi } from '../../../../../../../services/projects';
import { isoDate, reason } from '../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, agreementId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, z.object({ endDate: isoDate, reason }));
  await endAgreement(ctx, project.id, agreementId!, startOfDayInZone(input.endDate, project.timezone), input.reason);
  return { ok: true };
});
