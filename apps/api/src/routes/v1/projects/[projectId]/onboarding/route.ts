import { getDb, schema, eq } from '@setrya/db';
import { z } from 'zod';

import { body, route } from '../../../../../http/route';
import { requireProjectApi } from '../../../../../services/projects';

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const { step } = await body(req, z.object({ step: z.enum(['source', 'partner', 'agreement', 'wallet', 'import', 'ready', 'done']) }));
  await getDb().update(schema.projects).set({ onboardingStep: step }).where(eq(schema.projects.id, project.id));
  return { step };
});
