import { getDb, schema, eq, and } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { recalculate, requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';
import { ratesByIds } from '../../../../../../../services/rates';
import { currencyCode } from '../../../../../../../services/schemas';

/** Attaches or clears an approved rate on a draft period, then recalculates. Frozen revisions keep their rate. */
export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  if (period.status !== 'draft') throw new ApiError('STALE_PERIOD_REVISION', 'Rates are locked once a period is frozen. Start a new revision to change them.');
  const input = await body(req, z.object({ currency: currencyCode, rateSnapshotId: z.string().uuid().nullable(), expectedRevision: z.number().int() }));
  if (input.expectedRevision !== period.revision) throw new ApiError('STALE_PERIOD_REVISION', 'This period was revised elsewhere. Reload.');
  if (input.rateSnapshotId) {
    const [rate] = await ratesByIds(ctx, project.id, [input.rateSnapshotId]);
    if (!rate || rate.base !== input.currency) throw new ApiError('INVALID_INPUT', 'That rate does not convert this currency.');
  }
  const next = { ...period.rateSnapshotIds };
  if (input.rateSnapshotId) next[input.currency] = input.rateSnapshotId;
  else delete next[input.currency];
  await getDb().update(schema.periods).set({ rateSnapshotIds: next, updatedAt: new Date() }).where(and(eq(schema.periods.id, period.id), eq(schema.periods.status, 'draft')));
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.rate_set', objectType: 'period', objectId: period.id, diff: { currency: input.currency, rateSnapshotId: input.rateSnapshotId } });
  return (await recalculate(ctx, project, period.id)).totals;
});
