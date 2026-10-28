import Link from 'next/link';

import { PeriodStatusBadge } from '@/components/app/status';
import { TrendChart } from '@/components/app/trend-chart';
import { MoneyGroups, Zec } from '@/components/ui/amount';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Card, EmptyState, MetricCard, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { age, formatDate, formatRange } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

const EVENT_TEXT: Record<string, string> = {
  'import.committed': 'Revenue imported',
  'period.created': 'Period created',
  'period.frozen': 'Period frozen for review',
  'period.approved': 'Period approved',
  'period.closed': 'Period closed',
  'exception.decided': 'Exception decided',
  'agreement.activated': 'Agreement activated',
  'partner.created': 'Partner added',
  'partner.address_changed': 'Payout address changed',
  'payment.prepared': 'Payment prepared',
  'payment.authorised': 'Payment authorised',
  'revenue.reclassified': 'Revenue rows reclassified',
};

export default async function OverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, data, health, sources, partners, status, due, wallet } = await loadView('shell.overview', { projectId }, `/app/p/${projectId}`);
  const names = new Map(partners.map((p) => [p.id, p.displayName]));
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const p = (rest: string) => projectPath(project.id, rest);
  const monthLabel = new Intl.DateTimeFormat('en-GB', { timeZone: project.timezone, month: 'long', year: 'numeric' }).format(new Date());
  const hasData = data.pipeline.imported > 0 || data.periods.length > 0;
  const primaryCurrency = Object.keys(data.eligibleThisMonth)[0] ?? sources[0]?.defaultCurrency ?? project.currency;

  const nextAction = !status.source
    ? { title: 'Add a revenue source', body: 'Every fee row belongs to a source.', href: '/onboarding/source', cta: 'Add source' }
    : data.heldEntries > 0
      ? { title: `${data.heldEntries} fee row${data.heldEntries === 1 ? '' : 's'} need a decision`, body: 'Held rows stay out of every fee base until you classify them.', href: p('/revenue?classification=held'), cta: 'Review rows' }
      : data.openExceptions > 0
        ? { title: `${data.openExceptions} exception${data.openExceptions === 1 ? '' : 's'} block payouts`, body: 'Resolve, exclude or hold each one before freezing.', href: p('/periods'), cta: 'Open periods' }
        : data.pipeline.ready > 0
          ? { title: 'A period is ready to approve or pay', body: 'Review the frozen snapshot, then prepare the shielded payment.', href: p('/periods'), cta: 'Open periods' }
          : data.pipeline.imported > 0
            ? { title: 'Create a settlement period', body: 'Choose dates and sources to calculate what each partner is owed.', href: p('/periods/new'), cta: 'New period' }
            : { title: 'Import your first fee statement', body: 'Settlements are calculated only from fees you actually received.', href: p('/revenue/import'), cta: 'Import revenue' };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Workspace' }, { label: project.name }]}
        title="Overview"
        description={`Current accounting month: ${monthLabel}`}
        actions={
          <>
            <ButtonLink href={p('/revenue/import')} variant="secondary" icon="upload">Import revenue</ButtonLink>
            <ButtonLink href={p('/periods/new')} icon="plus">New settlement period</ButtonLink>
          </>
        }
      />
      {!health.canPay && hasData && (
        <Callout tone={health.configured ? 'warning' : 'info'} className="mb-5" title={wallet.label} action={<Link prefetch={false} href={p('/wallet')} className="text-body-s font-medium text-accent-text hover:underline">Open wallet status</Link>}>
          {health.configured ? health.blockers.slice(0, 2).join('. ') : 'Accounting mode. Revenue, calculations and reviews work; sending stays locked until a wallet connection passes its checks.'}
        </Callout>
      )}
      {!Object.values(status).every(Boolean) && (
        <Callout tone="info" className="mb-5" title="Setup is not complete" action={<Link prefetch={false} href="/onboarding" className="text-body-s font-medium text-accent-text hover:underline">Continue setup</Link>}>
          {Object.entries(status).filter(([, v]) => !v).map(([k]) => k).join(', ')} still to do.
        </Callout>
      )}

      {!hasData ? (
        <EmptyState icon="revenue" title="Start with an actual fee record" action={<><ButtonLink href={p('/revenue/import')} icon="upload">Import revenue</ButtonLink><ButtonLink href={p('/partners/new')} variant="secondary" icon="plus">Add partner</ButtonLink></>}>
          Setrya calculates what each partner is owed from fees you actually received. Nothing here is estimated.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Eligible revenue this month" value={<MoneyGroups groups={data.eligibleThisMonth} empty="None yet" />} explain="Rows classified eligible with a date in the current month, in their source currency. Different currencies are listed, never added." href={p('/revenue?classification=eligible')} />
            <MetricCard label="Approved but unpaid" value={data.approvedUnpaid.count ? <Zec zat={data.approvedUnpaid.zat} /> : <span className="text-ink-muted">Nothing</span>} footnote={data.approvedUnpaid.count ? <MoneyGroups groups={data.approvedUnpaid.owed} /> : undefined} explain="Approved payouts whose transaction is not confirmed on chain." href={p('/payments')} />
            <MetricCard label="Settled this month" value={data.settledThisMonth.count ? <Zec zat={data.settledThisMonth.zat} /> : <span className="text-ink-muted">Nothing</span>} footnote={`${data.settledThisMonth.count} confirmed payout${data.settledThisMonth.count === 1 ? '' : 's'}`} explain="Only payouts whose transaction reached the confirmation threshold. Pending ones are excluded." tone={data.settledThisMonth.count ? 'success' : 'default'} href={p('/payments')} />
            <MetricCard label="Needs review" value={<span className="tnum">{data.needsReview}</span>} footnote={`${data.openExceptions} exception${data.openExceptions === 1 ? '' : 's'}, ${data.heldEntries} held row${data.heldEntries === 1 ? '' : 's'}`} tone={data.needsReview ? 'warning' : 'default'} href={data.heldEntries ? p('/revenue?classification=held') : p('/periods')} explain="Open blocking exceptions in draft periods plus revenue rows held for a decision." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <Panel title="Settlement pipeline">
                <ol className="flex snap-x gap-px overflow-x-auto bg-border scrollbar-none md:grid md:grid-cols-6">
                  {([
                    ['Imported', data.pipeline.imported, p('/revenue'), 'imports'],
                    ['Calculated', data.pipeline.calculated, p('/periods?status=draft'), 'periods'],
                    ['Needs review', data.pipeline.needsReview, p('/periods?status=draft'), 'periods'],
                    ['Ready', data.pipeline.ready, p('/periods?status=review'), 'periods'],
                    ['Sent', data.pipeline.sent, p('/periods?status=in_payment'), 'periods'],
                    ['Closed', data.pipeline.closed, p('/periods?status=closed'), 'periods'],
                  ] as const).map(([label, n, href, unit]) => (
                    <li key={label} className="min-w-[8rem] snap-start bg-surface">
                      <Link prefetch={false} href={href} className="block px-4 py-4 hover:bg-surface-muted">
                        <div className="text-body-s text-ink-secondary">{label}</div>
                        <div className="mt-1 text-figure tnum">{n}</div>
                        <div className="text-label text-ink-muted">{unit}</div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel title="Recent settlement periods" action={<Link prefetch={false} href={p('/periods')} className="text-body-s text-accent-text hover:underline">All periods</Link>}>
                <DataTable
                  caption="Recent settlement periods"
                  rows={data.periods}
                  rowKey={(r) => r.id}
                  rowHref={(r) => p(`/periods/${r.id}`)}
                  empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No periods yet. <Link prefetch={false} href={p('/periods/new')} className="text-accent-text hover:underline">Create one from imported fees</Link>.</p>}
                  columns={[
                    { key: 'label', header: 'Period', cell: (r) => r.label },
                    { key: 'range', header: 'Dates', cell: (r) => formatRange(r.startAt, r.endAt, project.timezone) },
                    { key: 'source', header: 'Source', cell: (r) => r.sourceIds.map((s) => sourceNames.get(s)).join(', '), hideOnCard: true },
                    { key: 'owed', header: 'Amount owed', align: 'right', cell: (r) => <MoneyGroups groups={r.totals?.owedByCurrency} /> },
                    { key: 'payable', header: 'Payable', align: 'right', cell: (r) => (r.totals?.payableCount ? <Zec zat={r.totals.payableZat} /> : '—') },
                    { key: 'status', header: 'Status', cell: (r) => <PeriodStatusBadge status={r.status} /> },
                    { key: 'updated', header: 'Updated', cell: (r) => age(r.updatedAt), hideOnCard: true },
                  ]}
                />
              </Panel>

              <Panel title="Revenue trend" description={`Eligible realised fees per day, ${primaryCurrency}, last 120 days`}>
                <div className="p-4 md:p-5">
                  <TrendChart points={data.trend.filter((t) => t.currency === primaryCurrency)} currency={primaryCurrency} />
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-6">
              <Card className="border-accent-border bg-accent-soft">
                <div className="text-body-s font-medium text-accent-text">Next action</div>
                <h2 className="mt-1 text-h2">{nextAction.title}</h2>
                <p className="mt-1 text-body-s text-ink-secondary">{nextAction.body}</p>
                <ButtonLink href={nextAction.href} className="mt-4">{nextAction.cta}</ButtonLink>
              </Card>
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-h3">Wallet</h2>
                  <Link prefetch={false} href={p('/wallet')} className="text-body-s text-accent-text hover:underline">Details</Link>
                </div>
                <dl className="mt-3 space-y-2 text-body-s">
                  <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Status</dt><dd className="font-medium">{wallet.label}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Chain</dt><dd>{health.network.configured ?? '—'}{health.zebra.blocks ? ` · block ${health.zebra.blocks}` : ''}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Spendable shielded</dt><dd>{health.balance ? <Zec zat={health.balance.spendableZat} /> : '—'}</dd></div>
                </dl>
              </Card>
              <Panel title="Partners due next">
                {due.length === 0 ? (
                  <p className="px-5 py-6 text-body-s text-ink-muted">Nobody is owed anything in open periods.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {due.map((d) => (
                      <li key={d.partnerId}>
                        <Link prefetch={false} href={p(`/partners/${d.partnerId}`)} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                          <span className="min-w-0 truncate text-body-s font-medium">{names.get(d.partnerId)}</span>
                          <span className="text-right text-body-s">{d.zat > 0n ? <Zec zat={d.zat} /> : <MoneyGroups groups={d.owed} />}{d.held ? <span className="block text-label text-warning-text">{d.held} held</span> : null}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Recent activity" action={<Link prefetch={false} href={p('/activity')} className="text-body-s text-accent-text hover:underline">All</Link>}>
                <ul className="divide-y divide-border">
                  {data.activity.length === 0 && <li className="px-5 py-6 text-body-s text-ink-muted">No activity yet.</li>}
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <Icon name="activity" size={16} className="mt-0.5 text-ink-muted" />
                      <span className="min-w-0 flex-1 text-body-s">{EVENT_TEXT[a.eventType] ?? a.eventType.replace(/[._]/g, ' ')}</span>
                      <time className="text-label text-ink-muted" dateTime={a.createdAt.toISOString()}>{formatDate(a.createdAt, project.timezone)}</time>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

