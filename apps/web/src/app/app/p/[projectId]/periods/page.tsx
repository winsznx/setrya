import Link from 'next/link';

import { PeriodStatusBadge } from '@/components/app/status';
import { MoneyGroups, Zec } from '@/components/ui/amount';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { age, formatRange } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

const STAGES = [
  ['draft', 'Draft'],
  ['needs_review', 'Needs review'],
  ['approved', 'Approved'],
  ['in_payment', 'In payment'],
  ['closed', 'Closed'],
] as const;

export default async function PeriodsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ status?: string; filter?: string; source?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, periods, sources, open, uncertain } = await loadView('periods.list', { projectId }, `/app/p/${projectId}/periods`);
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const openCount = (id: string, rev: number) => open.filter((o) => o.periodId === id && o.revision === rev).length;
  const stageOf = (p: (typeof periods)[number]) => (p.status === 'draft' ? (openCount(p.id, p.revision) ? 'needs_review' : 'draft') : p.status === 'review' || p.status === 'approved' ? 'approved' : p.status === 'in_payment' || p.status === 'settled' ? 'in_payment' : 'closed');
  const wanted = sp.filter === 'exceptions' ? 'needs_review' : sp.status === 'review' ? 'approved' : sp.status;
  const rows = periods.filter((p) => (!wanted || stageOf(p) === wanted || p.status === wanted) && (!sp.source || p.sourceIds.includes(sp.source)));
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Settlement periods' }]} title="Settlement periods" description="Each period turns imported fees and agreements into reviewed, frozen payouts." actions={<ButtonLink href={p('/periods/new')} icon="plus">New period</ButtonLink>} />
      {uncertain.length > 0 && (
        <Callout tone="danger" className="mb-5" title="A prior period contains an unresolved transaction state" action={<Link prefetch={false} className="text-body-s font-medium text-accent-text hover:underline" href={p(`/periods/${uncertain[0]!.periodId}/send`)}>Open recovery</Link>}>
          A broadcast outcome is unknown or a confirmation was reorged. Setrya reconciles it with the node before anything new is sent from the same account.
        </Callout>
      )}
      {periods.length === 0 ? (
        <EmptyState icon="periods" title="Create a settlement period from imported fees" action={<ButtonLink href={p('/periods/new')} icon="plus">New period</ButtonLink>}>Choose dates and sources. Setrya matches imported rows, applies each agreement and shows exactly what is owed before anything is approved.</EmptyState>
      ) : (
        <>
          <nav className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Filter by stage">
            {STAGES.map(([key, label]) => {
              const n = periods.filter((x) => stageOf(x) === key).length;
              const active = wanted === key;
              return (
                <Link prefetch={false} key={key} href={active ? p('/periods') : p(`/periods?status=${key}`)} aria-current={active ? 'true' : undefined} className={`rounded-panel border p-4 transition-colors ${active ? 'border-ink bg-surface' : 'border-border bg-surface-muted hover:border-border-strong'}`}>
                  <div className="text-body-s text-ink-secondary">{label}</div>
                  <div className="mt-1 text-figure tnum">{n}</div>
                </Link>
              );
            })}
          </nav>
          <Panel title={`${rows.length} period${rows.length === 1 ? '' : 's'}`}>
            <DataTable caption="Settlement periods" rows={rows} rowKey={(r) => r.id} rowHref={(r) => p(`/periods/${r.id}`)} cardTitle={(r) => r.label} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No periods at this stage.</p>}
              columns={[
                { key: 'label', header: 'Period', cell: (r) => r.label },
                { key: 'range', header: 'Dates', cell: (r) => formatRange(r.startAt, r.endAt, project.timezone) },
                { key: 'source', header: 'Source', cell: (r) => r.sourceIds.map((s) => sourceNames.get(s)).join(', '), hideOnCard: true },
                { key: 'base', header: 'Eligible fee base', align: 'right', cell: (r) => <MoneyGroups groups={r.totals?.eligibleByCurrency} /> },
                { key: 'owed', header: 'Owed', align: 'right', cell: (r) => <MoneyGroups groups={r.totals?.owedByCurrency} /> },
                { key: 'zec', header: 'Payable ZEC', align: 'right', cell: (r) => (r.totals?.payableCount ? <Zec zat={r.totals.payableZat} /> : '—') },
                { key: 'exceptions', header: 'Exceptions', align: 'right', cell: (r) => openCount(r.id, r.revision) || '—' },
                { key: 'status', header: 'Status', cell: (r) => <PeriodStatusBadge status={r.status} /> },
                { key: 'updated', header: 'Updated', cell: (r) => age(r.updatedAt), hideOnCard: true },
              ]}
            />
          </Panel>
          <p className="mt-3 text-body-s text-ink-muted">A closed period can contain paid rows and rows carried forward or waived. Closing never marks an unpaid row as paid.</p>
        </>
      )}
    </>
  );
}
