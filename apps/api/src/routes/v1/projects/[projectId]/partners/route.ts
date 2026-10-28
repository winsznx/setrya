import { z } from 'zod';

import { ApiError, body, route } from '../../../../../http/route';
import { assessForInstall, createPartner, listPartners } from '../../../../../services/partners';
import { requireProjectApi } from '../../../../../services/projects';
import { partnerSchema } from '../../../../../services/schemas';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => {
  const partners = await listPartners(ctx, (await requireProjectApi(ctx, projectId!)).id);
  return partners.map((p) => ({ id: p.id, displayName: p.displayName, category: p.category, active: p.active, payability: p.payability, hasAddress: p.address !== null }));
});

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, partnerSchema.extend({ address: z.string().trim().max(2048).optional().nullable(), addressConfirmed: z.boolean().default(false) }));
  if (input.address) {
    const a = assessForInstall(input.address);
    if (!a.ok) throw new ApiError('ADDRESS_UNSUPPORTED', a.message, { fieldErrors: { address: a.message } });
  }
  const id = await createPartner(ctx, project.id, input, input.address ? { value: input.address, confirmed: input.addressConfirmed } : null);
  return { id };
});
