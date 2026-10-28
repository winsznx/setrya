import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../http/route';
import { getPartner, updatePartner } from '../../../../../../services/partners';
import { requireProjectApi } from '../../../../../../services/projects';
import { partnerSchema } from '../../../../../../services/schemas';

export const PATCH = route('unlocked', async (req, ctx, { projectId, partnerId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  if (!(await getPartner(ctx, project.id, partnerId!))) throw new ApiError('NOT_FOUND', 'Not found.');
  const input = await body(req, partnerSchema.extend({ expectedVersion: z.number().int() }));
  await updatePartner(ctx, project.id, partnerId!, input.expectedVersion, input);
  return { ok: true };
});
