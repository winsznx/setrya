import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { changeAddress, getPartner } from '../../../../../../../services/partners';
import { requireProjectApi } from '../../../../../../../services/projects';
import { reason } from '../../../../../../../services/schemas';

export const POST = route('unlocked', async (req, ctx, { projectId, partnerId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const partner = await getPartner(ctx, project.id, partnerId!);
  if (!partner) throw new ApiError('NOT_FOUND', 'Not found.');
  const input = await body(req, z.object({ address: z.string().trim().min(1).max(2048), confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm the address with the recipient first' }) }), reason }));
  if (partner.address?.address === input.address) throw new ApiError('INVALID_INPUT', 'That is already the current address.', { fieldErrors: { address: 'Unchanged' } });
  return changeAddress(ctx, project.id, partner.id, input.address, input.confirmed, input.reason);
});
