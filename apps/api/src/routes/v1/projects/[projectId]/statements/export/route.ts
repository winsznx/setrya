import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../http/route';
import { audit } from '../../../../../../services/audit';
import { requireProjectApi } from '../../../../../../services/projects';
import { buildStatement } from '../../../../../../services/statements';

/** Returns documents to the owner's browser, which encrypts them with a password before anything is saved. */
export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const input = await body(req, z.object({ ids: z.array(z.string().uuid()).min(1).max(500), acknowledgePrivate: z.literal(true) }));
  const docs = [];
  for (const id of input.ids) {
    const doc = await buildStatement(ctx, project, id);
    if (!doc) throw new ApiError('NOT_FOUND', 'Not found.');
    docs.push(doc);
  }
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.statements_archive', diff: { count: docs.length } });
  return { docs };
});
