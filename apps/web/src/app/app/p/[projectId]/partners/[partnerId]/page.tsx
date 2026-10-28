import { decToString, describeTerms, parseDec, sum } from '@setrya/domain';
import Link from 'next/link';

import { PayabilityBadge, PayoutStateBadge, PeriodStatusBadge, RowStatusBadge } from '@/components/app/status';
import { MoneyGroups, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Card, DefinitionList, MetricCard, Panel } from '@/components/ui/card';
import { RevealValue } from '@/components/ui/copy-button';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { DeactivateButton } from './deactivate-button';

const TABS = ['overview', 'agreements', 'settlements', 'statements', 'details'] as const;

function grouped(lines: { currency: string; owed: string }[]) {
  const by = new Map<string, string[]>();
  for (const l of lines) by.set(l.currency, [...(by.get(l.currency) ?? []), l.owed]);
  return Object.fromEntries([...by].map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))]));
}

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ projectId: string; partnerId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { projectId, partnerId } = await params;
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? '') ? ((await searchParams).tab as (typeof TABS)[number]) : 'overview';
  const { project, partner, agreements, lines, periods, history, statements, lastIntent } = await loadView('partners.detail', { projectId, partnerId }, `/app/p/${projectId}/partners/${partnerId}`);
  const periodById = new Map(periods.map((x) => [x.id, x]));
  const p = (rest: string) => projectPath(project.id, rest);
  const open = lines.filter((l) => l.periodStatus !== 'closed' && l.status !== 'nothing_owed');
  const unpaid = lines.filter((l) => l.intentId && l.payoutState !== 'confirmed' && l.payoutState !== 'cancelled' && l.payoutState !== 'failed');
  const paid = lines.filter((l) => l.payoutState === 'confirmed');
  const addressChangedSinceApproval = lastIntent && partner.address && partner.address.version > 1 && partner.address.effectiveAt > lastIntent.approvedAt;

  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Partners', href: p('/partners') }, { label: partner.displayName }]}
        title={partner.displayName}
        meta={<>{partner.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral" icon="pause">Inactive</Badge>}<Badge tone="neutral" icon={null}>{partner.category}</Badge></>}
        actions={<><ButtonLink href={p(`/partners/${partner.id}/edit`)} variant="secondary">Edit</ButtonLink>{partner.active && <DeactivateButton projectId={project.id} partnerId={partner.id} version={partner.version} values={{ displayName: partner.displayName, shortRef: partner.shortRef, contact: partner.contact, notes: partner.notes, category: partner.category }} />}<ButtonLink href={p(`/agreements/new?partner=${partner.id}`)} icon="plus">New agreement</ButtonLink></>}
      />
      {addressChangedSinceApproval && <Callout tone="danger" className="mb-5" title="Payout address changed since the last approval">Any unsigned payment to the old address was invalidated and must be approved again. Payments already signed or broadcast keep the old address in their record.</Callout>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Owed in open periods" value={<MoneyGroups groups={grouped(open)} empty="Nothing" />} />
        <MetricCard label="Approved, not confirmed" value={unpaid.length ? <Zec zat={unpaid.reduce((s, l) => s + (l.zat ?? 0n), 0n)} /> : <span className="text-ink-muted">Nothing</span>} />
        <MetricCard label="Confirmed paid" value={paid.length ? <Zec zat={paid.reduce((s, l) => s + (l.zat ?? 0n), 0n)} /> : <span className="text-ink-muted">Nothing yet</span>} tone={paid.length ? 'success' : 'default'} />
        <MetricCard label="Latest statement" value={statements[0] ? <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/statements/${statements[0].id}`)}>{statements[0].reference}</Link> : <span className="text-ink-muted">None</span>} />
      </div>
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-none" aria-label="Partner views">
        {TABS.map((t) => (
          <Link prefetch={false} key={t} href={p(`/partners/${partner.id}?tab=${t}`)} aria-current={tab === t ? 'page' : undefined} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body-s font-medium capitalize ${tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}>{t}</Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Agreements">
            {agreements.length === 0 ? <p className="px-5 py-6 text-body-s text-ink-muted">No agreements. <Link prefetch={false} href={p(`/agreements/new?partner=${partner.id}`)} className="text-accent-text hover:underline">Create one</Link>.</p> : (
              <ul className="divide-y divide-border">
                {agreements.map((a) => (
                  <li key={a.id}><Link prefetch={false} href={p(`/agreements/${a.id}`)} className="block px-5 py-3 hover:bg-surface-muted"><div className="flex justify-between gap-2"><span className="font-medium">{a.title}</span><Badge tone={a.status === 'active' ? 'success' : 'neutral'} icon={null}>{a.status} · v{a.current.version}</Badge></div><div className="text-body-s text-ink-secondary">{describeTerms(a.current.terms)}</div></Link></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Upcoming payout">
            {open.length === 0 ? <p className="px-5 py-6 text-body-s text-ink-muted">Nothing owed in open periods.</p> : (
              <ul className="divide-y divide-border">
                {open.slice(0, 5).map((l) => (
                  <li key={`${l.periodId}${l.rowKey}`} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link prefetch={false} href={p(`/periods/${l.periodId}`)} className="min-w-0 truncate text-body-s font-medium hover:underline">{periodById.get(l.periodId)?.label}</Link>
                    <span className="text-right">{l.zat ? <Zec zat={l.zat} /> : <MoneyGroups groups={{ [l.currency]: l.owed }} />}<span className="ml-2">{l.payoutState ? <PayoutStateBadge state={l.payoutState} /> : <RowStatusBadge status={l.status as 'payable'} />}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === 'agreements' && (
        <div className="space-y-4">
          {agreements.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><Link prefetch={false} href={p(`/agreements/${a.id}`)} className="text-h3 hover:underline">{a.title}</Link><Badge tone={a.status === 'active' ? 'success' : 'neutral'} icon={null}>{a.status}</Badge></div>
              <ol className="mt-3 space-y-1.5 text-body-s">
                {a.versions.map((v) => (
                  <li key={v.id} className="flex flex-wrap gap-x-3"><span className="tnum text-ink-muted">v{v.version}</span><span>{describeTerms(v.terms)}</span><span className="text-ink-secondary">from {formatDate(v.effectiveFrom, project.timezone)}{v.effectiveTo ? ` until ${formatDate(v.effectiveTo, project.timezone)}` : ''}</span><Badge tone={v.status === 'active' ? 'success' : 'neutral'} icon={null}>{v.status}</Badge></li>
                ))}
              </ol>
            </Card>
          ))}
          {agreements.length === 0 && <p className="text-body-s text-ink-muted">No agreements yet.</p>}
        </div>
      )}

      {tab === 'settlements' && (
        <Panel title="Settlement history">
          <DataTable caption="Settlements" rows={lines} rowKey={(l) => `${l.periodId}${l.rowKey}`} rowHref={(l) => (l.intentId ? p(`/payments/${l.intentId}`) : p(`/periods/${l.periodId}`))} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">No settlements yet.</p>}
            columns={[
              { key: 'period', header: 'Period', cell: (l) => periodById.get(l.periodId)?.label ?? '—' },
              { key: 'stage', header: 'Period stage', cell: (l) => <PeriodStatusBadge status={l.periodStatus as 'draft'} /> },
              { key: 'owed', header: 'Owed', align: 'right', cell: (l) => <MoneyGroups groups={{ [l.currency]: l.owed }} /> },
              { key: 'zec', header: 'ZEC', align: 'right', cell: (l) => (l.zat ? <Zec zat={l.zat} /> : '—') },
              { key: 'state', header: 'Payment', cell: (l) => (l.payoutState ? <PayoutStateBadge state={l.payoutState} /> : <RowStatusBadge status={l.status as 'payable'} />) },
            ]}
          />
        </Panel>
      )}

      {tab === 'statements' && (
        <Panel title="Statements for this partner only">
          <DataTable caption="Statements" rows={statements} rowKey={(s) => s.id} rowHref={(s) => p(`/statements/${s.id}`)} empty={<p className="px-5 py-8 text-center text-body-s text-ink-muted">Statements appear when a period with this partner is approved.</p>}
            columns={[
              { key: 'ref', header: 'Reference', cell: (s) => s.reference },
              { key: 'period', header: 'Period', cell: (s) => periodById.get(s.periodId)?.label ?? '—' },
              { key: 'v', header: 'Version', align: 'right', cell: (s) => s.documentVersion },
              { key: 'at', header: 'Generated', cell: (s) => formatDateTime(s.generatedAt, project.timezone) },
            ]}
          />
        </Panel>
      )}

      {tab === 'details' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-h3">Details</h2>
            <DefinitionList items={[
              { term: 'Short reference', detail: partner.shortRef ?? '—' },
              { term: 'Contact', detail: partner.contact ?? '—' },
              { term: 'Internal notes', detail: partner.notes ?? '—' },
              { term: 'Added', detail: formatDateTime(partner.createdAt, project.timezone) },
            ]} />
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-h3">Payout address</h2><PayabilityBadge payability={partner.payability} /></div>
            {partner.address ? (
              <DefinitionList items={[
                { term: 'Address', detail: <RevealValue masked={partner.address.masked} value={partner.address.address} timeoutSeconds={project.revealTimeoutSeconds} /> },
                { term: 'Fingerprint', detail: <code className="font-mono text-[0.75rem]">{partner.address.fingerprint.slice(0, 16)}…</code> },
                { term: 'Receivers', detail: partner.address.assessment.receivers.map((r) => r.kind).join(', ') },
                { term: 'Confirmed with recipient', detail: partner.address.ownerConfirmedAt ? formatDateTime(partner.address.ownerConfirmedAt, project.timezone) : 'Not confirmed' },
              ]} />
            ) : <p className="text-body-s text-ink-secondary">No address yet. <Link prefetch={false} href={p(`/partners/${partner.id}/edit`)} className="text-accent-text hover:underline">Add one</Link>.</p>}
          </Card>
          <Panel title="Address history" className="lg:col-span-2">
            <DataTable caption="Address versions" rows={history} rowKey={(h) => h.id} empty={<p className="px-5 py-6 text-body-s text-ink-muted">No address versions.</p>}
              columns={[
                { key: 'v', header: 'Version', cell: (h) => `v${h.version}` },
                { key: 'addr', header: 'Address', cell: (h) => <code className="font-mono text-[0.75rem]">{h.masked}</code> },
                { key: 'from', header: 'Effective', cell: (h) => formatDateTime(h.effectiveAt, project.timezone) },
                { key: 'to', header: 'Retired', cell: (h) => (h.retiredAt ? formatDateTime(h.retiredAt, project.timezone) : <Badge tone="success">Current</Badge>) },
                { key: 'reason', header: 'Reason', cell: (h) => h.changeReason ?? '—' },
              ]}
            />
          </Panel>
        </div>
      )}
    </>
  );
}
