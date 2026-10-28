import { agreementTermsSchema, startOfDayInZone } from '@setrya/domain';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { saveRevision } from '../../../../../../../services/agreements';
import { requireProjectApi } from '../../../../../../../services/projects';
import { isoDate, reason } from '../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, agreementId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, z.object({ effectiveFrom: isoDate, effectiveTo: isoDate.nullable().or(z.literal('')).transform((v) => v || null), terms: agreementTermsSchema, reason, activate: z.boolean(), expectedVersion: z.number().int() }));
  const effectiveFrom = startOfDayInZone(input.effectiveFrom, project.timezone);
  const effectiveTo = input.effectiveTo ? startOfDayInZone(input.effectiveTo, project.timezone) : null;
  if (effectiveTo && effectiveTo <= effectiveFrom) throw new ApiError('INVALID_INPUT', 'The end date must be after the start date.', { fieldErrors: { effectiveTo: 'Must be after the start' } });
  return saveRevision(ctx, project.id, agreementId!, { ...input, effectiveFrom, effectiveTo });
});
