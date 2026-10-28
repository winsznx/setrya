import { ApiError, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { commitmentBundle } from '../../../../../../../services/commitments';
import { requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';

/** Owner-only auditor bundle: every leaf of the approved payout tree, salts included. Never shared with recipients. */
export const GET = route('unlocked', async (_req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const bundle = await commitmentBundle(ctx, period);
  if (!bundle) throw new ApiError('NOT_FOUND', 'This period has no payout commitment yet. It is created when the period is approved.');
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.commitment_bundle', objectType: 'period', objectId: period.id });
  return new Response(JSON.stringify(bundle, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="setrya-commitment-${period.id.slice(0, 8)}.json"`, 'cache-control': 'no-store' } });
});
