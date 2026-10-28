import { ENTRY_TYPES, parseImportedDate } from '@setrya/domain';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../http/route';
import { requireProjectApi } from '../../../../../../services/projects';
import { addManualEntry } from '../../../../../../services/revenue';
import { currencyCode } from '../../../../../../services/schemas';
import { getSource } from '../../../../../../services/sources';

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(req, z.object({ sourceId: z.string().uuid(), occurredAt: z.string().max(40), amount: z.string().regex(/^-?\d+(\.\d{1,8})?$/, 'Use a plain number with at most 8 decimals'), currency: currencyCode, type: z.enum(ENTRY_TYPES), description: z.string().trim().max(300), externalId: z.string().trim().max(120).nullable(), note: z.string().trim().min(3, 'Explain where this figure comes from').max(500) }));
  const source = await getSource(ctx, project.id, input.sourceId);
  if (!source) throw new ApiError('INVALID_INPUT', 'Choose a source.', { fieldErrors: { sourceId: 'Required' } });
  const at = parseImportedDate(input.occurredAt, source.timezone, 'iso');
  if (!at) throw new ApiError('INVALID_INPUT', 'Enter the date and time the fee was earned.', { fieldErrors: { occurredAt: 'Invalid date' } });
  return { id: await addManualEntry(ctx, project.id, { ...input, externalId: input.externalId || null, occurredAt: at }) };
});
