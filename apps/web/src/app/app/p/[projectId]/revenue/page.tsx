import Link from 'next/link';

import { EntriesTable } from '@/components/revenue/entries-table';
import { ManualEntryButton } from '@/components/revenue/manual-entry';
import { MoneyGroups } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';
import { toEntryRows } from '@/lib/revenue-view';

import { RevenueFilters } from './filters';

type Search = { tab?: string; classification?: string; source?: string; currency?: string; q?: string; batch?: string };

export default async function RevenuePage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Search> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, sources, entries, imports, periods, summary } = await loadView('revenue.list', { projectId }, `/app/p/${projectId}/revenue`);
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const q = sp.q?.toLowerCase().trim();
  const filtered = entries.filter((e) =>
    (!sp.classification || e.classification === sp.classification) &&
    (!sp.source || e.sourceId === sp.source) &&
    (!sp.currency || e.currency === sp.currency) &&
    (!sp.batch || e.batchId === sp.batch) &&
    (!q || [e.externalId, e.description, e.reference].some((v) => v?.toLowerCase().includes(q))),
  );
  const tab = sp.tab === 'imports' ? 'imports' : 'entries';
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Revenue' }]}
        title="Revenue"
        description="The fee records settlements are calculated from."
        actions={<><ManualEntryButton projectId={project.id} sources={sources.filter((s) => s.enabled).map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency }))} /><ButtonLink href={p('/revenue/import')} icon="upload">Import revenue</ButtonLink></>}
      />
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border lg:grid-cols-5">
        {([
          ['Source records', <span key="n" className="tnum">{summary.count}</span>],
          ['Total imported', <MoneyGroups key="t" groups={summary.total} />],
          ['Eligible', <MoneyGroups key="e" groups={summary.eligible} />],
          ['Excluded', <MoneyGroups key="x" groups={summary.excluded} />],
          ['Unresolved', <MoneyGroups key="h" groups={summary.held} />],
        ] as const).map(([label, value]) => (
          <div key={label} className="bg-surface p-4">
            <dt className="text-body-s text-ink-secondary">{label}</dt>
            <dd className="mt-1 text-body font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Revenue views">
        {[
          ['entries', 'All entries', p('/revenue')],
          ['imports', 'Imports', p('/revenue?tab=imports')],
          ['sources', 'Sources', p('/revenue/sources')],
        ].map(([key, label, href]) => (
          <Link prefetch={false} key={key} href={href!} aria-current={tab === key ? 'page' : undefined} className={`-mb-px border-b-2 px-3 py-2 text-body-s font-medium ${tab === key ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>

      {tab === 'entries' ? (
        entries.length === 0 ? (
          <EmptyState icon="upload" title="Import first fee statement" action={<ButtonLink href={p('/revenue/import')} icon="upload">Import revenue</ButtonLink>}>Upload the CSV your platform gives you. Nothing is committed until you review each row.</EmptyState>
        ) : (
          <Panel title={`${filtered.length} of ${entries.length} entries`} action={<RevenueFilters sources={sources.map((s) => ({ id: s.id, name: s.name }))} currencies={Object.keys(summary.total)} />}>
            {filtered.length === 0 ? <p className="px-5 py-10 text-center text-body-s text-ink-muted">No entries match these filters.</p> : <EntriesTable projectId={project.id} rows={toEntryRows(filtered, sourceNames, periods, project.timezone)} />}
          </Panel>
        )
      ) : (
        <Panel title="Import history">
          <DataTable
            caption="Import history"
            rows={imports}
            rowKey={(r) => r.id}
            rowHref={(r) => p(`/revenue/import/${r.id}`)}
            empty={<p className="px-5 py-10 text-center text-body-s text-ink-muted">No imports yet.</p>}
            columns={[
              { key: 'file', header: 'File', cell: (r) => r.filename },
              { key: 'source', header: 'Source', cell: (r) => sourceNames.get(r.sourceId) },
              { key: 'rows', header: 'Rows', align: 'right', cell: (r) => r.rowCount },
              { key: 'eligible', header: 'Eligible', align: 'right', cell: (r) => r.eligibleCount },
              { key: 'held', header: 'Held', align: 'right', cell: (r) => r.heldCount },
              { key: 'status', header: 'Status', cell: (r) => (r.voidedAt ? <Badge tone="neutral" icon="x">Voided</Badge> : r.heldCount > 0 ? <Badge tone="warning">Needs review</Badge> : <Badge tone="success">Committed</Badge>) },
              { key: 'at', header: 'Imported', cell: (r) => formatDateTime(r.createdAt, project.timezone) },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
