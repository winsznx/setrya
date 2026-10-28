import { basisLabel, describeTerms } from '@setrya/domain';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, MetricCard, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

export default async function AgreementsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ status?: string; partner?: string; source?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, agreements, partners, sources } = await loadView('agreements.list', { projectId }, `/app/p/${projectId}/agreements`);
  const names = new Map(partners.map((p) => [p.id, p.displayName]));
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const soon = Date.now() + 30 * 86_400_000;
  const expiring = agreements.filter((a) => a.status === 'active' && a.current.effectiveTo && a.current.effectiveTo.getTime() < soon);
  const rows = agreements.filter((a) => (!sp.status || a.status === sp.status) && (!sp.partner || a.partnerId === sp.partner) && (!sp.source || a.sourceIds.includes(sp.source)));
  const p = (rest: string) => projectPath(project.id, rest);
  const filterLink = (label: string, query: string, active: boolean) => <a href={p(`/agreements${query}`)} aria-current={active ? 'true' : undefined} className={`rounded-pill px-3 py-1 text-body-s ${active ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink-secondary hover:text-ink'}`}>{label}</a>;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Agreements' }]} title="Agreements" description="Versioned terms that turn eligible fees into amounts owed." actions={<ButtonLink href={p('/agreements/new')} icon="plus">New agreement</ButtonLink>} />
      {agreements.length === 0 ? (
        <EmptyState icon="agreements" title="No agreements yet" action={<ButtonLink href={p('/agreements/new')} icon="plus">New agreement</ButtonLink>}>
          For example, <span className="font-medium text-ink">10% of eligible realised fees</span> from your creator-fee source, paid each settlement period. That figure is illustrative; you set the real terms.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Active" value={agreements.filter((a) => a.status === 'active').length} />
            <MetricCard label="Expiring in 30 days" value={expiring.length} tone={expiring.length ? 'warning' : 'default'} />
            <MetricCard label="Draft" value={agreements.filter((a) => a.status === 'draft').length} />
            <MetricCard label="Superseded versions" value={agreements.reduce((n, a) => n + a.versions.filter((v) => v.status === 'superseded').length, 0)} />
          </div>
          <Panel title={`${rows.length} agreement${rows.length === 1 ? '' : 's'}`} action={<div className="flex flex-wrap gap-1.5">{filterLink('All', '', !sp.status)}{filterLink('Active', '?status=active', sp.status === 'active')}{filterLink('Draft', '?status=draft', sp.status === 'draft')}{filterLink('Ended', '?status=ended', sp.status === 'ended')}</div>}>
            <DataTable caption="Agreements" rows={rows} rowKey={(a) => a.id} rowHref={(a) => p(`/agreements/${a.id}`)} cardTitle={(a) => a.title} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No agreements match.</p>}
              columns={[
                { key: 'title', header: 'Agreement', cell: (a) => a.title },
                { key: 'partner', header: 'Partner', cell: (a) => names.get(a.partnerId) },
                { key: 'sources', header: 'Sources', cell: (a) => a.sourceIds.map((s) => sourceNames.get(s)).join(', '), hideOnCard: true },
                { key: 'basis', header: 'Payout basis', cell: (a) => basisLabel(a.current.terms) },
                { key: 'rate', header: 'Rate or amount', cell: (a) => describeTerms(a.current.terms) },
                { key: 'dates', header: 'Effective', cell: (a) => `${formatDate(a.current.effectiveFrom, project.timezone)}${a.current.effectiveTo ? ` – ${formatDate(a.current.effectiveTo, project.timezone)}` : ' onward'}` },
                { key: 'v', header: 'Revision', align: 'right', cell: (a) => `v${a.current.version}` },
                { key: 'status', header: 'Status', cell: (a) => <Badge tone={a.status === 'active' ? 'success' : a.status === 'draft' ? 'neutral' : 'neutral'} icon={a.status === 'active' ? 'check' : null}>{a.status}</Badge> },
              ]}
            />
          </Panel>
        </>
      )}
    </>
  );
}
