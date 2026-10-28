import { getDb, schema, eq } from '@setrya/db';

import { body, route } from '../../../http/route';
import { audit } from '../../../services/audit';
import { createProject, listProjects } from '../../../services/projects';
import { projectSchema } from '../../../services/schemas';

export const GET = route('unlocked', async (_req, ctx) => (await listProjects(ctx)).map((p) => ({ id: p.id, name: p.name, archived: p.archived })));

export const POST = route('unlocked', async (req, ctx) => {
  const input = await body(req, projectSchema);
  const id = await createProject(ctx, input);
  await audit(ctx.cipher, 'owner', { projectId: id, eventType: 'project.created', objectType: 'project', objectId: id, diff: { currency: input.currency, timezone: input.timezone } });
  await getDb().update(schema.owners).set({ timezone: input.timezone }).where(eq(schema.owners.id, ctx.ownerId));
  return { id };
});
