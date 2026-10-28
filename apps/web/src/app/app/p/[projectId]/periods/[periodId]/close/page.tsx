import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TxStateBadge } from '@/components/app/status';
import { Money, MoneyGroups, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Callout, MetricCard, Panel } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';
import { decToString, parseDec, sum } from '@setrya/domain';

import { CloseForm } from './close-form';

export default async function ClosePage({ params }: { params: Promise<{ projectId: string; periodId: string }> }) {
  const { projectId, periodId } = await params;
  const { project, d, recon } = await loadView('periods.close', { projectId, periodId }, `/app/p/${projectId}/periods/${periodId}/close`);
  const p = (rest: string) => projectPath(project.id, rest);
  if (!recon) redirect(p(`/periods/${periodId}`));
  const closed = d.period.status === 'closed';
  const group = (lines: typeof recon.lines) => {
    const by = new Map<string, string[]>();
    for (const l of lines) by.set(l.row.currency, [...(by.get(l.row.currency) ?? []), l.row.owed]);
    return Object.fromEntries([...by].map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))]));
  };
  const paid = recon.lines.filter((l) => l.paid);
  const unpaid = recon.lines.filter((l) => !l.paid);
  const paidZat = paid.reduce((s, l) => s + (l.row.zat ?? 0n), 0n);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Periods', href: p('/periods') }, { label: d.period.label, href: p(`/periods/${periodId}`) }, { label: 'Close' }]} title="Close settlement period" meta={closed ? <Badge tone="neutral" icon="lock">Closed {d.period.closedAt ? formatDateTime(d.period.closedAt, project.timezone) : ''}</Badge> : undefined} />
      {recon.inFlight > 0 && !closed && <Callout tone="warning" className="mb-5" title={`${recon.inFlight} transaction(s) still in flight`} action={<Link prefetch={false} className="text-body-s font-medium text-accent-text hover:underline" href={p(`/periods/${periodId}/send`)}>Open payments</Link>}>Closing waits until every transaction is confirmed or definitively failed.</Callout>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total owed" value={<MoneyGroups groups={group(recon.lines)} />} />
        <MetricCard label="Approved ZEC" value={recon.approval ? <Zec zat={recon.approval.totalZat} /> : '—'} />
        <MetricCard label="Confirmed paid" value={<Zec zat={paidZat} />} tone="success" footnote={`${paid.length} payout${paid.length === 1 ? '' : 's'}`} />
        <MetricCard label="Held or unpaid" value={<MoneyGroups groups={group(unpaid)} empty="None" />} tone={unpaid.length ? 'warning' : 'default'} footnote={`${unpaid.length} row${unpaid.length === 1 ? '' : 's'}`} />
        <MetricCard label="Network fees (operator)" value={<Zec zat={recon.feesZat} />} />
      </div>
      <Panel title="Reconciliation">
        <ul className="divide-y divide-border">
          {recon.lines.map((l) => (
            <li key={l.row.key} className="grid gap-2 px-4 py-3 text-body-s md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:px-5">
              <span className="font-medium">{d.partners.get(l.row.partnerId)?.displayName}</span>
              <Money value={l.row.owed} currency={l.row.currency} />
              <span>{l.row.zat ? <Zec zat={l.row.zat} /> : '—'}</span>
              <span>{l.paid ? <Badge tone="success">Confirmed on chain</Badge> : l.txState ? <TxStateBadge state={l.txState} /> : <Badge tone="warning">{l.reason}</Badge>}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Statements and evidence">
          <div className="space-y-2 p-4 text-body-s md:p-5">
            <p>{d.intents.length} partner statement{d.intents.length === 1 ? '' : 's'} issued at approval. Each shows only that partner&apos;s own figures.</p>
            <p className="text-ink-secondary">Confirmations observed for {paid.length} of {recon.lines.filter((l) => l.intentId).length} approved payouts.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link prefetch={false} href={p(`/statements?period=${periodId}`)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Statements</Link>
              <a href={`/api/v1/projects/${project.id}/periods/${periodId}/report`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}><Icon name="download" size={15} /> Period report (owner only)</a>
              <a href={`/api/v1/projects/${project.id}/periods/${periodId}/commitments`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}><Icon name="download" size={15} /> Download commitment bundle</a>
            </div>
          </div>
        </Panel>
        {!closed && recon.inFlight === 0 ? (
          <CloseForm projectId={project.id} periodId={periodId} unpaid={unpaid.map((l) => ({ key: l.row.key, partner: d.partners.get(l.row.partnerId)?.displayName ?? '', owed: l.row.owed, currency: l.row.currency, reason: l.reason, credit: l.row.status === 'credit' }))} />
        ) : closed ? (
          <Callout tone="info" title="This period is closed">Corrections go into a later period as linked adjustments. Reopening is not supported.</Callout>
        ) : null}
      </div>
    </>
  );
}
