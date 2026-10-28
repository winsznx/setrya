import { startOfDayInZone, agreementTermsSchema } from '@setrya/domain';
import { z } from 'zod';

import { body, route } from '../../../../../../http/route';
import { activationCheck } from '../../../../../../services/agreements';
import { requireProjectApi } from '../../../../../../services/projects';

/** Live overlap and pool-commitment check for the agreement builder's side panel. */
export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const input = await body(req, z.object({ agreementId: z.string().uuid().nullable(), partnerId: z.string().uuid(), sourceIds: z.array(z.string().uuid()), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), effectiveTo: z.string().nullable(), terms: agreementTermsSchema }));
  return activationCheck(ctx, project.id, {
    agreementId: input.agreementId ?? '00000000-0000-0000-0000-000000000000',
    partnerId: input.partnerId,
    sourceIds: input.sourceIds,
    effectiveFrom: startOfDayInZone(input.effectiveFrom, project.timezone),
    effectiveTo: input.effectiveTo ? startOfDayInZone(input.effectiveTo, project.timezone) : null,
    terms: input.terms,
  });
});
