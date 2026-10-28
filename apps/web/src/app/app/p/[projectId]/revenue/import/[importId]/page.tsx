import Link from 'next/link';

import { EntriesTable } from '@/components/revenue/entries-table';
import { MoneyGroups } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { Callout, Card, DefinitionList, MetricCard, Panel } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime, isoDay } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';
import { toEntryRows } from '@/lib/revenue-view';

import { VoidImport } from './void-import';

export default async function ImportDetailPage({ params, searchParams }: { params: Promise<{ projectId: string; importId: string }>; searchParams: Promise<{ tab?: string; from?: string }> }) {
  const { projectId, importId } = await params;
  const { tab = 'entries', from } = await searchParams;
  const { project, batch, source, entries, periods, lockedBy, summary } = await loadView('revenue.importDetail', { projectId, importId }, `/app/p/${projectId}/revenue/import/${importId}`);
  const issueRows = entries.filter((e) => e.classification === 'held' || e.issues.some((i) => i !== 'MISSING_EXTERNAL_ID'));
  const rows = toEntryRows(tab === 'issues' ? issueRows : entries, new Map([[batch.sourceId, source?.name ?? '']]), periods, project.timezone);
  const dates = entries.map((e) => e.occurredAt.getTime()).sort((a, b) => a - b);
  const p = (rest: string) => projectPath(project.id, rest);
  const newPeriodHref = dates.length ? p(`/periods/new?source=${batch.sourceId}&start=${isoDay(new Date(dates[0]!), project.timezone)}&end=${isoDay(new Date(dates[dates.length - 1]!), project.timezone)}`) : p('/periods/new');
  const tabs = [['entries', `Entries (${entries.length})`], ['issues', `Issues (${issueRows.length})`], ['provenance', 'Provenance']] as const;
  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Revenue', href: p('/revenue?tab=imports') }, { label: batch.filename }]}
        title={batch.filename}
        meta={batch.voidedAt ? <Badge tone="neutral" icon="x">Voided</Badge> : batch.heldCount > 0 ? <Badge tone="warning">Needs review</Badge> : <Badge tone="success">Committed</Badge>}
        description={`${source?.name ?? 'Source'} · imported ${formatDateTime(batch.createdAt, project.timezone)}`}
        actions={
          <>
            <a href={`/api/v1/projects/${project.id}/imports/${batch.id}/csv`} className={buttonClasses({ variant: 'secondary' })}><Icon name="download" /> Download normalised CSV</a>
            {!batch.voidedAt && <ButtonLink href={newPeriodHref} icon="periods">Use in new period</ButtonLink>}
          </>
        }
      />
      {from === 'onboarding' && <Callout tone="success" className="mb-5" title="Import committed" action={<Link prefetch={false} href={`/onboarding/ready`} className="text-body-s font-medium text-accent-text hover:underline">Finish setup</Link>}>Review any held rows below, then create your first settlement period.</Callout>}
      {batch.heldCount > 0 && !batch.voidedAt && <Callout tone="warning" className="mb-5" title={`${batch.heldCount} row${batch.heldCount === 1 ? '' : 's'} held for a decision`}>Held rows stay out of every fee base. Any agreement that draws on these fees is held too until you decide.</Callout>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Rows accepted" value={`${entries.length} of ${batch.rowCount}`} />
        <MetricCard label="Eligible" value={batch.eligibleCount} footnote={<MoneyGroups groups={summary.eligible} />} />
        <MetricCard label="Held" value={batch.heldCount} tone={batch.heldCount ? 'warning' : 'default'} footnote={<MoneyGroups groups={summary.held} />} />
        <MetricCard label="Excluded" value={batch.excludedCount} footnote={<MoneyGroups groups={summary.excluded} />} />
        <MetricCard label="Duplicates" value={batch.duplicateCount} footnote={batch.duplicatePolicy === 'skip_duplicates' ? 'Already-imported IDs skipped' : 'Imported as held revisions'} />
      </div>
      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Import views">
        {tabs.map(([key, label]) => (
          <Link prefetch={false} key={key} href={p(`/revenue/import/${batch.id}?tab=${key}`)} aria-current={tab === key ? 'page' : undefined} className={`-mb-px border-b-2 px-3 py-2 text-body-s font-medium ${tab === key ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {tab === 'provenance' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-h3">Source file</h2>
            <DefinitionList items={[
              { term: 'File name', detail: batch.filename },
              { term: 'SHA-256 fingerprint', detail: <code className="break-all font-mono text-[0.75rem]">{batch.fileHash}</code> },
              { term: 'Rows in file', detail: batch.rowCount },
              { term: 'Delimiter', detail: batch.mapping.delimiter === '\t' ? 'tab' : batch.mapping.delimiter },
              { term: 'Date format', detail: batch.mapping.dateFormat },
              { term: 'Decimal separator', detail: batch.mapping.decimalSeparator },
              { term: 'Time zone for bare dates', detail: batch.mapping.timeZone },
              { term: 'Duplicate policy', detail: batch.duplicatePolicy === 'skip_duplicates' ? 'Skip already-imported IDs' : 'Import as held revisions' },
            ]} />
          </Card>
          <Card>
            <h2 className="mb-2 text-h3">Column mapping</h2>
            <DefinitionList items={Object.entries(batch.mapping.mapping).filter(([, v]) => v !== undefined).map(([field, index]) => ({ term: field, detail: `${batch.mapping.header[index as number] || `Column ${(index as number) + 1}`} (column ${(index as number) + 1})` }))} />
            <p className="mt-3 text-body-s text-ink-secondary">Raw rows are stored encrypted and unchanged. Corrections create audit events or later adjustments; the original import is never rewritten.</p>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-h3">Void this import</h2>
            {lockedBy > 0 ? (
              <p className="mt-1 text-body-s text-ink-secondary">Rows from this import are part of {lockedBy} frozen or closed period{lockedBy === 1 ? '' : 's'}, so it can no longer be voided. Record corrections in a new period.</p>
            ) : batch.voidedAt ? (
              <p className="mt-1 text-body-s text-ink-secondary">Voided {formatDateTime(batch.voidedAt, project.timezone)}: {batch.voidReason}</p>
            ) : (
              <VoidImport projectId={project.id} importId={batch.id} />
            )}
          </Card>
        </div>
      ) : (
        <Panel title={tab === 'issues' ? 'Rows needing attention' : 'Imported rows'} description={tab === 'issues' ? 'Select rows to resolve as eligible, exclude with a reason, or leave held.' : undefined}>
          {rows.length === 0 ? <p className="px-5 py-10 text-center text-body-s text-ink-muted">{tab === 'issues' ? 'No issues in this import.' : 'No rows.'}</p> : <EntriesTable projectId={project.id} rows={rows} readOnly={batch.voidedAt !== null} />}
        </Panel>
      )}
    </>
  );
}
