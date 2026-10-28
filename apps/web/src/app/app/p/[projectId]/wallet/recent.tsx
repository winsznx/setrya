import { Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { shortHash } from '@/lib/format';
import { loadView } from '@/lib/api/views';

export async function RecentWalletTransactions({ projectId, limit, timezone }: { projectId: string; limit: number; timezone: string }) {
  const { rows, error } = await loadView('wallet.transactions', { limit: String(limit) }, `/app/p/${projectId}/wallet`);
  if (error) return <p className="px-5 py-6 text-body-s text-ink-secondary">Wallet history unavailable: {error}</p>;
  return (
    <DataTable caption="Wallet transactions" rows={rows} rowKey={(r) => r.txid} empty={<p className="px-5 py-6 text-body-s text-ink-muted">This wallet has no transactions yet.</p>}
      columns={[
        { key: 'txid', header: 'txid', cell: (r) => <code className="font-mono text-[0.75rem]">{shortHash(r.txid, 10)}</code> },
        { key: 'dir', header: 'Direction', cell: (r) => (r.netZat === null ? 'Unknown' : r.netZat.startsWith('-') ? 'Outgoing' : 'Incoming') },
        { key: 'amt', header: 'Visible to this wallet', align: 'right', cell: (r) => (r.netZat ? <Zec zat={r.netZat.replace('-', '')} /> : '—') },
        { key: 'when', header: 'Date', cell: (r) => (r.blocktime ? new Date(r.blocktime * 1000).toLocaleString('en-GB', { timeZone: timezone }) : r.status ?? '—') },
        { key: 'conf', header: 'Confirmations', align: 'right', cell: (r) => r.confirmations ?? '—' },
        { key: 'fee', header: 'Fee', align: 'right', cell: (r) => (r.feeZat ? <Zec zat={r.feeZat} /> : '—') },
        { key: 'match', header: 'Setrya payout', cell: (r) => (r.matchedPayout ? <Badge tone="accent" icon="check">Matched</Badge> : <Badge tone="neutral" icon={null}>Unmatched wallet activity</Badge>) },
      ]}
    />
  );
}
