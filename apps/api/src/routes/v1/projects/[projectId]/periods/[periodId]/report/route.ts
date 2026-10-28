import { toCsv } from '@setrya/domain';

import { route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { reconciliation } from '../../../../../../../services/close';
import { listPartners } from '../../../../../../../services/partners';
import { requirePeriodApi } from '../../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../../services/projects';

/** Owner-only, period-wide report: every partner, amount, payment state and txid. Never shared with recipients. */
export const GET = route('unlocked', async (_req, ctx, { projectId, periodId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const period = await requirePeriodApi(ctx, project.id, periodId!);
  const recon = await reconciliation(ctx, period);
  const names = new Map((await listPartners(ctx, project.id)).map((p) => [p.id, p.displayName]));
  const csv = toCsv(
    ['period', 'revision', 'partner', 'row', 'currency', 'eligible_base', 'owed', 'zat', 'row_status', 'paid', 'tx_state', 'note'],
    recon.lines.map((l) => [period.label, period.revision, names.get(l.row.partnerId) ?? '', l.row.key, l.row.currency, l.row.formula.base, l.row.owed, l.row.zat?.toString() ?? null, l.row.status, l.paid ? 'yes' : 'no', l.txState, l.reason]),
    new Set([1, 5, 6, 7]),
  );
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.period_report', objectType: 'period', objectId: period.id });
  return new Response(`${csv}network_fees_zat,${recon.feesZat}\r\n`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="setrya-period-${period.id.slice(0, 8)}.csv"`, 'cache-control': 'no-store' } });
});
