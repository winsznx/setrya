import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { getImport, voidImport } from '../../../../../../../services/imports';
import { requireProjectApi } from '../../../../../../../services/projects';
import { reason } from '../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, importId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  if (!(await getImport(ctx, project.id, importId!))) throw new ApiError('NOT_FOUND', 'Not found.');
  const input = await body(req, z.object({ reason }));
  await voidImport(ctx, project.id, importId!, input.reason);
  return { ok: true };
});
