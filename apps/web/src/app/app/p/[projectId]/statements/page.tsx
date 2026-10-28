import { WATERMARK } from '@setrya/domain';

import { Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Panel } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ExportSelected } from './export-selected';

export default async function StatementsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ period?: string; partner?: string; share?: string; payment?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, list, partners, periods, docs } = await loadView('statements.list', { projectId, period: sp.period, partner: sp.partner }, `/app/p/${projectId}/statements`);
  const names = new Map(partners.map((p) => [p.id, p.displayName]));
  const periodNames = new Map(periods.map((p) => [p.id, p.label]));
  const rows = list.filter((s) => (!sp.payment || docs.get(s.id)?.payment.status === sp.payment) && (!sp.share || (sp.share === 'active' ? s.shares.active > 0 : sp.share === 'none' ? s.shares.active + s.shares.expired + s.shares.revoked === 0 : true)));
  const p = (rest: string) => projectPath(project.id, rest);
  const shareState = (s: (typeof list)[number]) => (s.shares.active ? <Badge tone="accent" icon="share">Link active</Badge> : s.shares.revoked ? <Badge tone="neutral" icon="x">Revoked</Badge> : s.shares.expired ? <Badge tone="neutral" icon="clock">Expired</Badge> : s.downloadedAt ? <Badge tone="neutral" icon="download">Downloaded</Badge> : <Badge tone="neutral" icon={null}>Not shared</Badge>);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Statements' }]} title="Statements" description="Individual payout documents. Each one shows a single partner's figures." actions={<ExportSelected projectId={project.id} statements={rows.map((s) => ({ id: s.id, reference: s.reference }))} />} />
      {list.length === 0 ? (
        <EmptyState icon="statements" title="No statements yet">Statements are created from approved settlement rows. Confirmed payment data is attached when observed.</EmptyState>
      ) : (
        <Panel title={`${rows.length} statement${rows.length === 1 ? '' : 's'}`} description="Not every statement means a payment succeeded. The payment column says exactly what was observed.">
          <DataTable caption="Statements" rows={rows} rowKey={(s) => s.id} rowHref={(s) => p(`/statements/${s.id}`)} cardTitle={(s) => `${s.reference} · ${names.get(s.partnerId)}`} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No statements match.</p>}
            columns={[
              { key: 'ref', header: 'Reference', cell: (s) => s.reference },
              { key: 'partner', header: 'Partner', cell: (s) => names.get(s.partnerId) },
              { key: 'period', header: 'Period', cell: (s) => periodNames.get(s.periodId) },
              { key: 'owed', header: 'Approved ZEC', align: 'right', cell: (s) => { const z = docs.get(s.id)?.totals.zat; return z ? <Zec zat={z} /> : '—'; } },
              { key: 'pay', header: 'Payment', cell: (s) => { const st = docs.get(s.id)?.payment.status; return st ? <Badge tone={st === 'confirmed' ? 'success' : st === 'failed' ? 'danger' : st === 'pending' ? 'warning' : 'accent'} icon={st === 'confirmed' ? 'check' : undefined}>{WATERMARK[st].toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Badge> : '—'; } },
              { key: 'ack', header: 'Receipt', cell: (s) => (s.acknowledged ? <Badge tone="neutral" icon="check">Self-attested</Badge> : <span className="text-ink-muted">—</span>), hideOnCard: true },
              { key: 'v', header: 'Version', align: 'right', cell: (s) => s.documentVersion, hideOnCard: true },
              { key: 'share', header: 'Sharing', cell: shareState },
              { key: 'at', header: 'Generated', cell: (s) => formatDateTime(s.generatedAt, project.timezone), hideOnCard: true },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
