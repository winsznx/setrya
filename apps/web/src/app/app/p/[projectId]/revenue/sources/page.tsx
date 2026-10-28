import { ENTRY_TYPE_LABEL } from '@setrya/domain';

import { Badge } from '@/components/ui/badge';
import { Card, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { SourceEditor } from './source-editor';

export default async function SourcesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, sources, stats } = await loadView('revenue.sources', { projectId }, `/app/p/${projectId}/revenue/sources`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Revenue', href: p('/revenue') }, { label: 'Sources' }]} title="Revenue sources" description="Where fees come from, and what each source's amount column means." actions={<SourceEditor projectId={project.id} mode="create" initial={{ name: '', platform: '', note: '', referenceUrl: '', defaultCurrency: project.currency, feeType: 'realised_fee', timezone: project.timezone, kind: 'csv' }} />} />
      {sources.length === 0 ? (
        <EmptyState title="No sources yet">Add the platform or statement your fees come from.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((s) => {
            const st = stats.get(s.id);
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-h3">{s.name}</h2>
                    <p className="text-body-s text-ink-secondary">{s.platform ?? 'No platform label'}</p>
                  </div>
                  {s.enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="neutral" icon="pause">Disabled</Badge>}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-body-s">
                  <div><dt className="text-ink-muted">Amount means</dt><dd>{ENTRY_TYPE_LABEL[s.feeType]}</dd></div>
                  <div><dt className="text-ink-muted">Currency</dt><dd>{s.defaultCurrency}</dd></div>
                  <div><dt className="text-ink-muted">Time zone</dt><dd>{s.timezone}</dd></div>
                  <div><dt className="text-ink-muted">Last import</dt><dd>{st?.lastImport ? formatDateTime(st.lastImport, project.timezone) : 'Never'}</dd></div>
                  <div><dt className="text-ink-muted">Held rows</dt><dd>{st?.held ?? 0}</dd></div>
                  <div><dt className="text-ink-muted">Arrives by</dt><dd>{s.kind === 'manual' ? 'Manual entry' : 'CSV import'}</dd></div>
                </dl>
                <div className="mt-4 border-t border-border pt-3">
                  <SourceEditor projectId={project.id} mode="edit" sourceId={s.id} expectedVersion={s.version} initial={{ name: s.name, platform: s.platform ?? '', note: s.note ?? '', referenceUrl: s.referenceUrl ?? '', defaultCurrency: s.defaultCurrency, feeType: s.feeType as 'realised_fee', timezone: s.timezone, kind: s.kind as 'csv', enabled: s.enabled }} />
                </div>
              </Card>
            );
          })}
          <Card muted>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-h3">API connectors</h2>
              <Badge tone="neutral" icon={null}>Not connected</Badge>
            </div>
            <p className="mt-2 text-body-s text-ink-secondary">No provider integration is built. Sources arrive by CSV or manual entry until a real authenticated connector exists.</p>
          </Card>
        </div>
      )}
    </>
  );
}
