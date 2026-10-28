import { body, route } from '../../../../../http/route';
import { audit } from '../../../../../services/audit';
import { requireProjectApi } from '../../../../../services/projects';
import { sourceSchema } from '../../../../../services/schemas';
import { createSource, listSources } from '../../../../../services/sources';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => listSources(ctx, (await requireProjectApi(ctx, projectId!)).id));

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, sourceSchema);
  const id = await createSource(ctx, project.id, input);
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'source.created', objectType: 'source', objectId: id, diff: { feeType: input.feeType, currency: input.defaultCurrency } });
  return { id };
});
