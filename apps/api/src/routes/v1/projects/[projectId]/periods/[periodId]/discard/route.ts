import { getDb, schema, eq, and } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';
import { reason } from '../../../../../../../services/schemas';

/** Deletes a draft that was never frozen or approved. Anything that reached review stays in the record. */
export const POST = route('unlocked', async (req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const input = await body(req, z.object({ reason }));
  const [approval] = await getDb().select({ id: schema.approvals.id }).from(schema.approvals).where(eq(schema.approvals.periodId, period.id)).limit(1);
  if (period.status !== 'draft' || approval || period.revision > 1) throw new ApiError('FORBIDDEN', 'Only a first-revision draft that was never frozen or approved can be discarded.');
  await getDb().transaction(async (tx) => {
    await tx.delete(schema.periodExceptions).where(eq(schema.periodExceptions.periodId, period.id));
    await tx.delete(schema.periodDecisions).where(eq(schema.periodDecisions.periodId, period.id));
    await tx.delete(schema.calculationRows).where(eq(schema.calculationRows.periodId, period.id));
    await tx.delete(schema.periodSources).where(eq(schema.periodSources.periodId, period.id));
    await tx.delete(schema.periods).where(and(eq(schema.periods.id, period.id), eq(schema.periods.status, 'draft')));
    await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'period.draft_discarded', objectType: 'period', objectId: period.id, reason: input.reason }, tx);
  });
  return { ok: true };
});
