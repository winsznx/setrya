import { PayabilityBadge } from '@/components/app/status';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, MetricCard, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { PartnerFilters } from './partner-filters';

export default async function PartnersPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ status?: string; wallet?: string; q?: string; sort?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, partners, agreements, history } = await loadView('partners.list', { projectId }, `/app/p/${projectId}/partners`);
  const q = sp.q?.toLowerCase();
  let rows = partners.filter((p) => (!sp.status || (sp.status === 'active' ? p.active : !p.active)) && (!sp.wallet || (sp.wallet === 'ready' ? p.payability === 'ok' : p.payability !== 'ok')) && (!q || p.displayName.toLowerCase().includes(q) || p.shortRef?.toLowerCase().includes(q)));
  if (sp.sort === 'agreements') rows = [...rows].sort((a, b) => agreements.filter((x) => x.partnerId === b.id).length - agreements.filter((x) => x.partnerId === a.id).length);
  const p = (rest: string) => projectPath(project.id, rest);
  const due = partners.filter((x) => (history.get(x.id) ?? []).some((l) => l.status === 'payable' && l.payoutState !== 'confirmed' && l.periodStatus !== 'closed')).length;
  const held = partners.filter((x) => (history.get(x.id) ?? []).some((l) => l.status === 'held' && l.periodStatus !== 'closed')).length;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Partners' }]} title="Partners" description="People and businesses with settlement agreements." actions={<ButtonLink href={p('/partners/new')} icon="plus">Add partner</ButtonLink>} />
      {partners.length === 0 ? (
        <EmptyState icon="partners" title="No partners yet" action={<ButtonLink href={p('/partners/new')} icon="plus">Add partner</ButtonLink>}>A partner can be added without a payout address. Their payouts stay held until the address passes the shielded check.</EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Active partners" value={partners.filter((x) => x.active).length} />
            <MetricCard label="Missing payout address" value={partners.filter((x) => x.payability === 'ADDRESS_MISSING').length} tone={partners.some((x) => x.payability === 'ADDRESS_MISSING') ? 'warning' : 'default'} href={p('/partners?wallet=missing')} />
            <MetricCard label="Due for settlement" value={due} />
            <MetricCard label="Currently held" value={held} tone={held ? 'warning' : 'default'} />
          </div>
          <Panel title={`${rows.length} partner${rows.length === 1 ? '' : 's'}`} action={<PartnerFilters />}>
            <DataTable
              caption="Partners"
              rows={rows}
              rowKey={(r) => r.id}
              rowHref={(r) => p(`/partners/${r.id}`)}
              empty={<p className="px-5 py-10 text-center text-body-s text-ink-muted">No partners match these filters.</p>}
              cardTitle={(r) => r.displayName}
              columns={[
                { key: 'name', header: 'Partner', cell: (r) => (<span className="inline-flex items-center gap-2.5"><span aria-hidden className="grid size-8 place-items-center rounded-pill bg-surface-strong text-label font-semibold">{r.displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>{r.displayName}</span>) },
                { key: 'category', header: 'Category', cell: (r) => r.category.charAt(0).toUpperCase() + r.category.slice(1) },
                { key: 'agreements', header: 'Agreements', align: 'right', cell: (r) => agreements.filter((a) => a.partnerId === r.id && a.status === 'active').length },
                { key: 'wallet', header: 'Wallet readiness', cell: (r) => <PayabilityBadge payability={r.payability} /> },
                { key: 'last', header: 'Last confirmed payment', cell: (r) => { const c = (history.get(r.id) ?? []).find((l) => l.confirmedAt); return c?.confirmedAt ? formatDate(c.confirmedAt, project.timezone) : <span className="text-ink-muted">None</span>; } },
                { key: 'status', header: 'Status', cell: (r) => (r.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral" icon="pause">Inactive</Badge>) },
              ]}
            />
          </Panel>
          <p className="mt-3 text-body-s text-ink-muted">Full payout addresses are hidden in lists. Open a partner and reveal it deliberately.</p>
        </>
      )}
    </>
  );
}
