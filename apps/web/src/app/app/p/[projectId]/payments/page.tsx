import Link from 'next/link';

import { PayoutStateBadge, TxStateBadge } from '@/components/app/status';
import { Zec } from '@/components/ui/amount';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, MetricCard, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { age, shortHash } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { PaymentsExport } from './payments-export';

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ tab?: string; state?: string; q?: string; period?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, payouts, txs, partners } = await loadView('payments.list', { projectId }, `/app/p/${projectId}/payments`);
  const names = new Map(partners.map((p) => [p.id, p.displayName]));
  const q = sp.q?.toLowerCase();
  const rows = payouts.filter((x) => (!sp.state || x.state === sp.state) && (!sp.period || x.periodId === sp.period) && (!q || x.memoRef.toLowerCase().includes(q) || x.txid?.includes(q) || names.get(x.partnerId)?.toLowerCase().includes(q)));
  const live = payouts.filter((x) => !x.invalidated);
  const p = (rest: string) => projectPath(project.id, rest);
  const tab = sp.tab === 'transactions' ? 'transactions' : 'payouts';
  const sumZat = (list: typeof live) => list.reduce((s, x) => s + x.amountZat, 0n);
  const confirmedTx = txs.filter((t) => t.tx.state === 'CONFIRMED');
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Payments' }]} title="Payments" description="What was attempted, broadcast and confirmed." actions={<><PaymentsExport projectId={project.id} /><ButtonLink href={p('/periods')} variant="secondary">View periods</ButtonLink></>} />
      {payouts.length === 0 ? (
        <EmptyState icon="payments" title="No payments yet">Approve a settlement period to create payments. There is no freeform send: every payment comes from an approved calculation.</EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Confirmed" value={<Zec zat={sumZat(live.filter((x) => x.state === 'confirmed'))} />} tone="success" footnote={`${live.filter((x) => x.state === 'confirmed').length} payout(s)`} href={p('/payments?state=confirmed')} />
            <MetricCard label="Broadcast, awaiting confirmations" value={<Zec zat={sumZat(live.filter((x) => ['broadcast', 'mempool', 'confirming'].includes(x.state)))} />} footnote={`${live.filter((x) => ['broadcast', 'mempool', 'confirming'].includes(x.state)).length} payout(s)`} />
            <MetricCard label="Failed or needs investigation" value={live.filter((x) => x.state === 'failed' || x.state === 'unknown').length} tone={live.some((x) => x.state === 'unknown') ? 'warning' : 'default'} href={p('/payments?state=unknown')} />
            <MetricCard label="Network fees paid" value={<Zec zat={confirmedTx.reduce((s, t) => s + (t.tx.feeZat ?? 0n), 0n)} />} footnote="By you, never deducted from partners" />
          </div>
          <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Payment views">
            {[['payouts', 'Payouts'], ['transactions', 'Transactions']].map(([k, l]) => <Link prefetch={false} key={k} href={p(`/payments?tab=${k}`)} aria-current={tab === k ? 'page' : undefined} className={`-mb-px border-b-2 px-3 py-2 text-body-s font-medium ${tab === k ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}>{l}</Link>)}
          </nav>
          {tab === 'payouts' ? (
            <Panel title={`${rows.length} payout${rows.length === 1 ? '' : 's'}`} description="One row per partner entitlement. Several payouts can share one transaction.">
              <DataTable caption="Payouts" rows={rows} rowKey={(r) => r.id} rowHref={(r) => p(`/payments/${r.id}`)} cardTitle={(r) => `${r.memoRef} · ${names.get(r.partnerId)}`} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No payouts match.</p>}
                columns={[
                  { key: 'ref', header: 'Reference', cell: (r) => r.memoRef },
                  { key: 'partner', header: 'Partner', cell: (r) => names.get(r.partnerId) },
                  { key: 'period', header: 'Period', cell: (r) => r.periodLabel },
                  { key: 'zec', header: 'Amount', align: 'right', cell: (r) => <Zec zat={r.amountZat} /> },
                  { key: 'addr', header: 'Payout address', cell: (r) => <code className="font-mono text-[0.75rem]">{r.addressMasked}</code>, hideOnCard: true },
                  { key: 'txid', header: 'txid', cell: (r) => <code className="font-mono text-[0.75rem]">{shortHash(r.txid, 8)}</code>, hideOnCard: true },
                  { key: 'state', header: 'Stage', cell: (r) => <PayoutStateBadge state={r.state} /> },
                  { key: 'age', header: 'Age', cell: (r) => age(r.createdAt), hideOnCard: true },
                  { key: 'checked', header: 'Last checked', cell: (r) => (r.lastCheckedAt ? age(r.lastCheckedAt) : '—'), hideOnCard: true },
                ]}
              />
            </Panel>
          ) : (
            <Panel title={`${txs.length} transaction${txs.length === 1 ? '' : 's'}`} description="Actual chain transactions. A txid does not reveal which recipient got which amount.">
              <DataTable caption="Transactions" rows={txs} rowKey={(t) => t.tx.id} rowHref={(t) => p(`/periods/${t.periodId}/send`)} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No transactions yet.</p>}
                columns={[
                  { key: 'txid', header: 'txid', cell: (t) => <code className="font-mono text-[0.75rem]">{t.tx.txid ? shortHash(t.tx.txid, 10) : 'not extracted'}</code> },
                  { key: 'batch', header: 'Batch', cell: (t) => `${t.batch.sequence} of ${t.batch.of} · attempt ${t.tx.lineage}` },
                  { key: 'total', header: 'Recipients total', align: 'right', cell: (t) => <Zec zat={t.batch.totalZat} /> },
                  { key: 'fee', header: 'Fee', align: 'right', cell: (t) => (t.tx.feeZat ? <Zec zat={t.tx.feeZat} /> : '—') },
                  { key: 'conf', header: 'Confirmations', align: 'right', cell: (t) => t.tx.confirmations },
                  { key: 'state', header: 'State', cell: (t) => <TxStateBadge state={t.tx.state as 'CONFIRMED'} /> },
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
