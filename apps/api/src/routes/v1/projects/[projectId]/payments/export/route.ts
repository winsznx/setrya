import { toCsv, zatToZecString } from '@setrya/domain';

import { route } from '../../../../../../http/route';
import { audit } from '../../../../../../services/audit';
import { listPartners } from '../../../../../../services/partners';
import { listPayouts } from '../../../../../../services/payments-view';
import { requireProjectApi } from '../../../../../../services/projects';

export const GET = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const query = new URL(req.url).searchParams;
  const withAddresses = query.get('addresses') === '1';
  const withTxids = query.get('txids') !== '0';
  const names = new Map((await listPartners(ctx, project.id)).map((p) => [p.id, p]));
  const rows = await listPayouts(ctx, project.id);
  const csv = toCsv(
    ['reference', 'partner', 'period', 'amount_zec', 'amount_zat', 'stage', 'txid', 'payout_address', 'network', 'created_utc'],
    rows.map((r) => [r.memoRef, names.get(r.partnerId)?.displayName ?? '', r.periodLabel, zatToZecString(r.amountZat), r.amountZat.toString(), r.state, withTxids ? r.txid : null, withAddresses ? r.addressFull : r.addressMasked, r.network, r.createdAt.toISOString()]),
    new Set([3, 4]),
  );
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.payments_csv', diff: { rows: rows.length, withAddresses, withTxids } });
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="setrya-payouts.csv"', 'cache-control': 'no-store' } });
});
