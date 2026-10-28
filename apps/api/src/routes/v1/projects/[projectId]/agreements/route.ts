import { ApiError, body, route } from '../../../../../http/route';
import { createAgreement, listAgreements } from '../../../../../services/agreements';
import { getPartner } from '../../../../../services/partners';
import { requireProjectApi } from '../../../../../services/projects';
import { agreementSchema } from '../../../../../services/schemas';
import { listSources } from '../../../../../services/sources';
import { startOfDayInZone } from '@setrya/domain';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => listAgreements(ctx, (await requireProjectApi(ctx, projectId!)).id));

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, agreementSchema);
  if (!input.acknowledgeSnapshot) throw new ApiError('INVALID_INPUT', 'Acknowledge that terms are snapshotted when a period is frozen.', { fieldErrors: { acknowledgeSnapshot: 'Required' } });
  const partner = await getPartner(ctx, project.id, input.partnerId);
  if (!partner) throw new ApiError('INVALID_INPUT', 'Choose a partner from this project.', { fieldErrors: { partnerId: 'Unknown partner' } });
  if (input.activate && !partner.active) throw new ApiError('INVALID_INPUT', 'This partner is inactive, so new entitlements cannot start.', { fieldErrors: { partnerId: 'Partner inactive' } });
  const sources = new Set((await listSources(ctx, project.id)).map((s) => s.id));
  if (input.sourceIds.some((s) => !sources.has(s))) throw new ApiError('INVALID_INPUT', 'Choose sources from this project.', { fieldErrors: { sourceIds: 'Unknown source' } });
  const effectiveFrom = startOfDayInZone(input.effectiveFrom, project.timezone);
  const effectiveTo = input.effectiveTo ? startOfDayInZone(input.effectiveTo, project.timezone) : null;
  if (effectiveTo && effectiveTo <= effectiveFrom) throw new ApiError('INVALID_INPUT', 'The end date must be after the start date.', { fieldErrors: { effectiveTo: 'Must be after the start' } });
  const id = await createAgreement(ctx, project.id, { ...input, effectiveFrom, effectiveTo });
  return { id };
});
