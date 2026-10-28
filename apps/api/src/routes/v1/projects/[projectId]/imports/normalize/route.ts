import { ApiError, body, route } from '../../../../../../http/route';
import { normalizeDraft, serializeRow } from '../../../../../../services/imports';
import { requireProjectApi } from '../../../../../../services/projects';
import { normalizeSchema } from '../../../../../../services/schemas';
import { getSource } from '../../../../../../services/sources';

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, normalizeSchema);
  const source = await getSource(ctx, project.id, input.sourceId);
  if (!source) throw new ApiError('NOT_FOUND', 'Not found.');
  const { rows } = await normalizeDraft(ctx, project.id, source, input);
  return { rows: rows.map(serializeRow) };
});
