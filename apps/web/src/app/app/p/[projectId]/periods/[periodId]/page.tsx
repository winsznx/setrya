import { describeTerms, ENTRY_TYPE_LABEL, HOLD_TEXT, payoutStateFromTx, type TxState } from '@setrya/domain';
import Link from 'next/link';

import { PeriodStatusBadge, PayoutStateBadge, RowStatusBadge, TxStateBadge } from '@/components/app/status';
import { FormulaBreakdown } from '@/components/period/formula';
import { Lifecycle, type Step } from '@/components/period/lifecycle';
import { PeriodRates } from '@/components/period/period-rates';
import { FreezeButton, RecalculateButton, ReviseButton } from '@/components/period/period-actions';
import { Money, MoneyGroups, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Card, EmptyState, Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime, formatRange } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

const TABS = [['payouts', 'Partner payouts'], ['sources', 'Source rows'], ['decisions', 'Decisions'], ['payments', 'Payments'], ['documents', 'Documents']] as const;

export default async function PeriodPage({ params, searchParams }: { params: Promise<{ projectId: string; periodId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { projectId, periodId } = await params;
  const tab = (await searchParams).tab ?? 'payouts';
  const { project, d, liveRates, blocking } = await loadView('periods.detail', { projectId, periodId }, `/app/p/${projectId}/periods/${periodId}`);
  const { period, rows, exceptions } = d;
  const p = (rest: string) => projectPath(project.id, rest);
  const base = `/periods/${period.id}`;
  const t = period.totals;
  const confirmedZat = d.batches.filter((b) => b.txState === 'CONFIRMED').reduce((s, b) => s + b.totalZat, 0n);
  const anyTx = d.batches.some((b) => b.tx);
  const st = period.status;
  const lifecycle: Step[] = [
    { label: 'Created', state: 'done', detail: formatDateTime(period.createdAt, project.timezone) },
    { label: 'Calculated', state: period.calculatedAt ? 'done' : 'current', detail: period.calculatedAt ? `Revision ${period.revision}` : undefined },
    { label: 'Exceptions resolved', state: blocking.length === 0 ? 'done' : 'blocked', detail: blocking.length ? `${blocking.length} open` : `${exceptions.length} total` },
    { label: 'Frozen', state: period.frozenAt ? 'done' : st === 'draft' ? 'todo' : 'current', detail: period.frozenSnapshotHash ? `Snapshot ${period.frozenSnapshotHash.slice(0, 10)}…` : undefined },
    { label: 'Approved', state: d.approval ? 'done' : st === 'review' ? 'current' : 'todo', detail: d.approval ? formatDateTime(d.approval.approvedAt, project.timezone) : undefined },
    { label: 'Prepared', state: anyTx ? 'done' : st === 'approved' ? 'current' : 'todo' },
    { label: 'Broadcast', state: d.batches.some((b) => b.tx?.broadcastAt) ? 'done' : 'todo' },
    { label: 'Confirmed', state: d.batches.length > 0 && d.batches.every((b) => b.txState === 'CONFIRMED') ? 'done' : d.batches.some((b) => b.txState === 'CONFIRMED') ? 'current' : 'todo', detail: d.batches.length ? `${d.batches.filter((b) => b.txState === 'CONFIRMED').length} of ${d.batches.length} transaction(s)` : undefined },
    { label: 'Closed', state: st === 'closed' ? 'done' : 'todo', detail: period.closedAt ? formatDateTime(period.closedAt, project.timezone) : undefined },
  ];
  const freezeBlock = blocking.length ? `${blocking.length} blocking exception(s) need a decision` : !t?.payableCount ? 'Nothing is payable yet' : null;
  const actions =
    st === 'draft' ? (
      <>
        <RecalculateButton projectId={project.id} periodId={period.id} revision={period.revision} />
        {exceptions.length > 0 && <ButtonLink href={p(`${base}/exceptions`)} variant={blocking.length ? 'primary' : 'secondary'} icon="alert">Review exceptions{blocking.length ? ` (${blocking.length})` : ''}</ButtonLink>}
        {!blocking.length && <FreezeButton projectId={project.id} periodId={period.id} revision={period.revision} disabledReason={freezeBlock} />}
      </>
    ) : st === 'review' ? (
      <><ReviseButton projectId={project.id} periodId={period.id} /><ButtonLink href={p(`${base}/review`)} icon="check">Review for approval</ButtonLink></>
    ) : st === 'approved' ? (
      <>{!anyTx && <ReviseButton projectId={project.id} periodId={period.id} />}<ButtonLink href={p(`${base}/send`)} icon="payments">Prepare payment</ButtonLink></>
    ) : st === 'in_payment' ? (
      <ButtonLink href={p(`${base}/send`)} icon="clock">Track payment</ButtonLink>
    ) : st === 'settled' ? (
      <><ButtonLink href={p(`${base}/send`)} variant="secondary">Payments</ButtonLink><ButtonLink href={p(`${base}/close`)} icon="lock">Close period</ButtonLink></>
    ) : (
      <ButtonLink href={p(`${base}/close`)} variant="secondary" icon="download">Final package</ButtonLink>
    );

  const byPartner = new Map<string, typeof rows>();
  for (const r of rows.filter((r) => r.status !== 'nothing_owed' || tab === 'payouts')) byPartner.set(r.partnerId, [...(byPartner.get(r.partnerId) ?? []), r]);
  const intentFor = (rowId: string) => d.intents.find((i) => i.calculationRowId === rowId);
  const txStateFor = (rowId: string) => {
    const i = intentFor(rowId);
    return (i?.batchId ? d.batches.find((b) => b.id === i.batchId)?.txState : null) ?? null;
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Periods', href: p('/periods') }, { label: period.label }]}
        title={period.label}
        meta={<><PeriodStatusBadge status={st} /><Badge tone="neutral" icon={null}>Revision {period.revision}</Badge></>}
        description={`${formatRange(period.startAt, period.endAt, project.timezone)} · ${period.sourceIds.map((s) => d.sources.find((x) => x.id === s)?.name).join(', ')}`}
        actions={actions}
      />
      {st === 'review' && <Callout tone="info" className="mb-5" title="Frozen for review">This revision is locked. Approve it, or start a new revision to change anything.</Callout>}
      {st === 'approved' && !anyTx && <Callout tone="success" className="mb-5" title="Approved, ready to prepare the transaction">Approval is not payment. The next step builds a fully shielded transaction and shows you exactly what will be signed.</Callout>}
      {t && t.payableCount === 0 && st === 'draft' && <Callout tone="warning" className="mb-5" title="Nothing payable yet">Rows below are held or owe nothing. Resolve exceptions or add a rate, then recalculate.</Callout>}

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-4 xl:grid-cols-7">
        {([
          ['Source amount', <MoneyGroups key="s" groups={t?.sourceByCurrency} />, 'Every row in the period, any classification'],
          ['Eligible base', <MoneyGroups key="e" groups={t?.eligibleByCurrency} />, 'Rows classified eligible'],
          ['Excluded', <MoneyGroups key="x" groups={t?.excludedByCurrency} />, 'Volume and other non-fee rows'],
          ['Net owed', <MoneyGroups key="o" groups={t?.owedByCurrency} />, 'Sum of all agreement results, per currency'],
          ['Approved ZEC', d.approval ? <Zec key="a" zat={d.approval.totalZat} /> : '—', 'Total in the approved snapshot'],
          ['Confirmed paid', confirmedZat > 0n ? <Zec key="c" zat={confirmedZat} /> : '—', 'Transactions at the confirmation threshold'],
          ['Held rows', <span key="h" className="tnum">{t?.heldCount ?? 0}</span>, 'Rows that will not be sent'],
        ] as const).map(([label, value, help]) => (
          <div key={label} className="bg-surface p-3.5" title={help}>
            <dt className="text-label text-ink-secondary">{label}</dt>
            <dd className="mt-1 text-body-s font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-none" aria-label="Period views">
            {TABS.map(([key, label]) => (
              <Link prefetch={false} key={key} href={p(`${base}?tab=${key}`)} aria-current={tab === key ? 'page' : undefined} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body-s font-medium ${tab === key ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}>{label}</Link>
            ))}
          </nav>

          {tab === 'payouts' && (rows.length === 0 ? <EmptyState title="Nothing payable yet">No agreement matched this period&apos;s sources and dates.</EmptyState> : (
            <div className="space-y-4">
              {[...byPartner].map(([partnerId, list]) => {
                const partner = d.partners.get(partnerId);
                return (
                  <Panel key={partnerId} title={<Link prefetch={false} href={p(`/partners/${partnerId}`)} className="hover:underline">{partner?.displayName ?? 'Partner'}</Link>} action={partner?.address ? <span className="text-label text-ink-muted">Address v{partner.address.version} · {partner.payability === 'ok' ? 'ready' : 'not ready'}</span> : <Badge tone="warning">No address</Badge>}>
                    <ul className="divide-y divide-border">
                      {list.map((r) => {
                        const agreement = d.agreements.get(r.agreementId);
                        const version = agreement?.versions.find((v) => v.id === r.agreementVersionId);
                        const txState = txStateFor(r.id);
                        const intent = intentFor(r.id);
                        return (
                          <li key={r.id}>
                            <div className="group">
                              <div className="grid cursor-pointer list-none gap-2 px-4 py-3 hover:bg-surface-muted md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] md:items-center md:px-5">
                                <div className="min-w-0">
                                  <div className="truncate text-body-s font-medium">{agreement?.title} · v{version?.version}</div>
                                  <div className="truncate text-label text-ink-secondary">{version ? describeTerms(version.terms) : ''}</div>
                                </div>
                                <div className="text-body-s md:text-right"><span className="text-label text-ink-muted md:hidden">Base </span>{r.formula.base ? <Money value={r.formula.base} currency={r.currency} /> : 'Fixed'}</div>
                                <div className="text-body-s md:text-right"><span className="text-label text-ink-muted md:hidden">Owed </span><Money value={r.owed} currency={r.currency} /></div>
                                <div className="text-body-s md:text-right"><span className="text-label text-ink-muted md:hidden">ZEC </span>{r.zat ? <Zec zat={r.zat} /> : '—'}</div>
                                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">{intent ? <PayoutStateBadge state={payoutStateFromTx(txState as TxState | null)} /> : <RowStatusBadge status={r.status} />}</div>
                              </div>
                              <div className="space-y-3 border-t border-border bg-surface-muted px-4 py-4 md:px-5">
                                {r.holds.length > 0 && <Callout tone="warning" title="Held">{r.holds.map((h) => `${HOLD_TEXT[h.code]}${h.detail ? ` (${h.detail})` : ''}`).join('; ')}</Callout>}
                                <FormulaBreakdown formula={r.formula} currency={r.currency} />
                                {r.sourceEntryIds.length > 0 && (
                                  <div className="text-body-s"><span className="text-ink-secondary">Source rows </span>{r.sourceEntryIds.length} · fingerprint set <code className="font-mono text-[0.75rem]">{r.sourceIdsHash.slice(0, 16)}…</code> · <Link prefetch={false} className="text-accent-text hover:underline" href={p(`${base}?tab=sources`)}>view</Link></div>
                                )}
                                {intent && <Link prefetch={false} className="text-body-s text-accent-text hover:underline" href={p(`/payments/${intent.id}`)}>Payment detail</Link>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Panel>
                );
              })}
            </div>
          ))}

          {tab === 'sources' && (
            <Panel title={`${d.entries.length} source rows`} description="Inclusion shown is this period's decision, which can differ from the import's default.">
              <ul className="divide-y divide-border">
                {d.entries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).map((e) => {
                  const inc = d.inclusion.get(e.id);
                  return (
                    <li key={e.id} className="grid gap-1 px-4 py-3 text-body-s md:grid-cols-[9rem_minmax(0,1fr)_8rem_8rem] md:gap-4 md:px-5">
                      <span className="text-ink-secondary">{formatDateTime(e.occurredAt, project.timezone)}</span>
                      <span className="min-w-0"><span className="block truncate">{e.description ?? '—'}</span><span className="text-label text-ink-muted">{e.externalId ?? 'no id'} · {ENTRY_TYPE_LABEL[e.type]}</span>{inc?.reason && <span className="block text-label text-ink-secondary">Decision: {inc.reason}</span>}</span>
                      <span className="md:text-right"><Money value={e.amount} currency={e.currency} /></span>
                      <span>{inc?.inclusion === 'eligible' ? <Badge tone="success">Eligible</Badge> : inc?.inclusion === 'excluded' ? <Badge tone="neutral" icon="x">Excluded</Badge> : <Badge tone="warning">Unresolved</Badge>}</span>
                    </li>
                  );
                })}
                {d.entries.length === 0 && <li className="px-5 py-8 text-center text-body-s text-ink-muted">No imported rows fall in this period.</li>}
              </ul>
            </Panel>
          )}

          {tab === 'decisions' && (
            <Panel title="Decisions and events">
              <ul className="divide-y divide-border">
                {d.events.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-body-s"><div className="flex justify-between gap-3"><span className="font-medium">{e.eventType.replace('period.', 'Period ').replace('exception.', 'Exception ').replaceAll('_', ' ')}</span><span className="text-ink-muted">{formatDateTime(e.createdAt, project.timezone)}</span></div>{e.reason && <p className="text-ink-secondary">{e.reason}</p>}</li>
                ))}
                {d.events.length === 0 && <li className="px-5 py-6 text-body-s text-ink-muted">No decisions yet.</li>}
              </ul>
            </Panel>
          )}

          {tab === 'payments' && (
            <Panel title="Transactions">
              {d.batches.length === 0 ? <p className="px-5 py-6 text-body-s text-ink-muted">No payment batches. They are created when the period is approved.</p> : (
                <ul className="divide-y divide-border">
                  {d.batches.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-body-s">
                      <span>Batch {b.sequence} of {b.of} · <Zec zat={b.totalZat} /></span>
                      <span className="flex items-center gap-2">{b.txState ? <TxStateBadge state={b.txState} /> : <Badge tone="accent" icon="check">Approved</Badge>}{b.tx?.txid && <code className="font-mono text-[0.75rem]">{b.tx.txid.slice(0, 12)}…</code>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {tab === 'documents' && (
            <Card>
              <h2 className="text-h3">Documents</h2>
              {d.approval ? <p className="mt-1 text-body-s text-ink-secondary">Statements were issued for each partner when this period was approved. <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/statements?period=${period.id}`)}>Open statements</Link>. The period-wide report is available from <Link prefetch={false} className="text-accent-text hover:underline" href={p(`${base}/close`)}>Close</Link>.</p> : <p className="mt-1 text-body-s text-ink-secondary">Statements are created when the period is approved.</p>}
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-3 text-h3">Lifecycle</h2>
            <Lifecycle steps={lifecycle} />
          </Card>
          <PeriodRates
            projectId={project.id}
            periodId={period.id}
            revision={period.revision}
            editable={st === 'draft'}
            rateExpiryHours={project.rateExpiryHours}
            currencies={[...new Set([...rows.map((r) => r.currency), ...Object.keys(period.rateSnapshotIds)])].filter((c) => c !== 'ZEC')}
            attached={period.rateSnapshotIds}
            options={liveRates.map((r) => ({ id: r.id, base: r.base, label: `${r.description} · ${r.sourceText} · ${formatDateTime(r.quotedAt, project.timezone)}${r.expiresAt < new Date() ? ' (expired)' : ''}` }))}
          />
        </aside>
      </div>
    </>
  );
}
