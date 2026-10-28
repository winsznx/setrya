import { body, route } from '../../../../../../http/route';
import { requireProjectApi } from '../../../../../../services/projects';
import { classifyEntries } from '../../../../../../services/revenue';
import { classificationSchema } from '../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, classificationSchema);
  return classifyEntries(ctx, project.id, input.entryIds, input.classification, input.type, input.reason);
});
