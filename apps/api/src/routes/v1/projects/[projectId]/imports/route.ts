import { CLASSIFICATIONS, ENTRY_TYPES } from '@setrya/domain';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../http/route';
import { commitImport, listImports } from '../../../../../services/imports';
import { requireProjectApi } from '../../../../../services/projects';
import { getSource } from '../../../../../services/sources';

import { normalizeSchema } from '../../../../../services/schemas';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => listImports(ctx, (await requireProjectApi(ctx, projectId!)).id));

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(
    req,
    normalizeSchema.extend({
      duplicatePolicy: z.enum(['skip_duplicates', 'import_as_held']),
      decisions: z.array(z.object({ rowIndex: z.number().int().min(0), classification: z.enum(CLASSIFICATIONS), type: z.enum(ENTRY_TYPES), note: z.string().max(500) })).max(20_000),
      acknowledgeUnverified: z.literal(true, { errorMap: () => ({ message: 'Acknowledge that imported values are not independently verified' }) }),
    }),
  );
  const source = await getSource(ctx, project.id, input.sourceId);
  if (!source) throw new ApiError('NOT_FOUND', 'Not found.');
  return commitImport(ctx, project.id, source, input);
});
