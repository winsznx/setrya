import { getDb, schema, eq } from '@setrya/db';

import { ApiError } from '../http/route';
import { buildSnapshot, getPeriod, snapshotScope } from './periods';
import { configuredNetwork } from './network';
import { findProject } from './projects';
import type { StepUpAction } from './owner';
import type { UnlockedContext } from './session';
import { transactionScope } from './payments/scope';

/** Builds the exact scope a step-up token is bound to, from server state only. */
export async function stepUpScope(ctx: UnlockedContext, action: StepUpAction, targetId: string): Promise<{ scope: Record<string, unknown>; windowSeconds: number }> {
  if (action === 'approve_period') {
    const [row] = await getDb().select({ projectId: schema.periods.projectId }).from(schema.periods).where(eq(schema.periods.id, targetId));
    const project = row ? await findProject(ctx, row.projectId) : null;
    const period = project ? await getPeriod(ctx, project.id, targetId) : null;
    if (!project || !period) throw new ApiError('NOT_FOUND', 'Not found.');
    if (period.status !== 'review') throw new ApiError('STALE_PERIOD_REVISION', 'Freeze the period before approving it.');
    const { network, accountId } = approvalTarget();
    return { scope: { action, ...snapshotScope(await buildSnapshot(ctx, project, period, network, accountId)) }, windowSeconds: project.stepUpWindowSeconds };
  }
  if (action === 'sign_transaction') {
    const scoped = await transactionScope(ctx, targetId);
    return { scope: { action, ...scoped.scope }, windowSeconds: scoped.windowSeconds };
  }
  return { scope: { action, targetId }, windowSeconds: 120 };
}

export function approvalTarget(): { network: string; accountId: string } {
  return { network: configuredNetwork(), accountId: (process.env.SETRYA_PAYER_ACCOUNT_UUID ?? 'unconfigured').toLowerCase() };
}
