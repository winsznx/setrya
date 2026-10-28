import { z } from 'zod';

import { ApiError, body, route } from '../../../../../http/route';
import { requireProjectApi } from '../../../../../services/projects';
import { createRate, listRates } from '../../../../../services/rates';
import { currencyCode } from '../../../../../services/schemas';

export const GET = route('unlocked', async (_req, ctx, { projectId }) => (await listRates(ctx, (await requireProjectApi(ctx, projectId!)).id)).map((r) => ({ ...r, numerator: r.numerator.toString(), denominator: r.denominator.toString() })));

export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const input = await body(
    req,
    z.object({
      currency: currencyCode.refine((c) => c !== 'ZEC', 'ZEC needs no conversion'),
      orientation: z.enum(['zec_per_unit', 'unit_per_zec']),
      value: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Use a plain positive number'),
      source: z.string().trim().min(3, 'Name where the quote came from').max(200),
      quotedAt: z.string().datetime({ offset: true }),
      expiresAt: z.string().datetime({ offset: true }),
      intendedConversionAt: z.string().datetime({ offset: true }).nullable(),
      approve: z.literal(true, { errorMap: () => ({ message: 'Approve the rate to use it' }) }),
    }),
  );
  const quotedAt = new Date(input.quotedAt);
  const expiresAt = new Date(input.expiresAt);
  if (expiresAt <= quotedAt) throw new ApiError('INVALID_INPUT', 'Expiry must be after the quote time.', { fieldErrors: { expiresAt: 'Must be after the quote time' } });
  if (quotedAt.getTime() > Date.now() + 5 * 60_000) throw new ApiError('INVALID_INPUT', 'The quote time is in the future.', { fieldErrors: { quotedAt: 'In the future' } });
  if (/^0+(\.0+)?$/.test(input.value)) throw new ApiError('INVALID_INPUT', 'A rate must be above zero.', { fieldErrors: { value: 'Must be above zero' } });
  return { id: await createRate(ctx, project.id, { ...input, quotedAt, expiresAt, intendedConversionAt: input.intendedConversionAt ? new Date(input.intendedConversionAt) : null }) };
});
