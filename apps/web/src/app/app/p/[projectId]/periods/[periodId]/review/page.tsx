import { describeTerms, shortFingerprint } from '@setrya/domain';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FormulaBreakdown } from '@/components/period/formula';
import { ReviseButton } from '@/components/period/period-actions';
import { NetworkBadge } from '@/components/shell/status-pills';
import { Money, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Callout, Card, Panel } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ApproveForm } from './approve-form';

export default async function ReviewPage({ params }: { params: Promise<{ projectId: string; periodId: string }> }) {
  const { projectId, periodId } = await params;
  const { project, d, approval, network } = await loadView('periods.review', { projectId, periodId }, `/app/p/${projectId}/periods/${periodId}/review`);
  const p = (rest: string) => projectPath(project.id, rest);
  if (!approval) redirect(p(`/periods/${periodId}`));
  const { checks, frozen, health } = approval;
  const rowsByKey = new Map(d.rows.map((r) => [r.key, r]));
  const allPass = checks.every((c) => c.pass);
  const approved = d.period.status !== 'review';
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Periods', href: p('/periods') }, { label: d.period.label, href: p(`/periods/${periodId}`) }, { label: 'Review' }]} title="Review settlement" meta={<Badge tone="neutral" icon={null}>Revision {d.period.revision}</Badge>} description="Stage one of payment. Nothing will be sent at this step." actions={!approved ? <ReviseButton projectId={project.id} periodId={periodId} label="Change something" /> : undefined} />
      {approved && <Callout tone="success" className="mb-5" title="Already approved" action={<Link prefetch={false} className="text-body-s font-medium text-accent-text hover:underline" href={p(`/periods/${periodId}/send`)}>Go to payment</Link>}>Approved {d.approval ? formatDateTime(d.approval.approvedAt, project.timezone) : ''}. Approval is not payment.</Callout>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Eligible to pay (${frozen?.payouts.length ?? 0})`}>
            <ul className="divide-y divide-border">
              {frozen?.payouts.map((po) => {
                const row = rowsByKey.get(po.payoutKey);
                const partner = d.partners.get(po.partnerId);
                const agreement = row ? d.agreements.get(row.agreementId) : undefined;
                const version = agreement?.versions.find((v) => v.id === po.agreementVersionId);
                return (
                  <li key={po.payoutKey}>
                    <details>
                      <summary className="grid cursor-pointer list-none gap-2 px-4 py-3.5 hover:bg-surface-muted md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center md:px-5">
                        <div className="min-w-0"><div className="font-medium">{partner?.displayName}</div><div className="truncate text-label text-ink-secondary">{agreement?.title} v{version?.version} · {version ? describeTerms(version.terms) : ''}</div></div>
                        <div className="text-body-s"><Money value={po.owed} currency={po.currency} /><div className="font-mono text-label text-ink-muted" title="Address fingerprint">{shortFingerprint(po.addressFingerprint)}</div></div>
                        <div className="text-right text-body font-semibold"><Zec zat={po.amountZat} trim={false} /></div>
                      </summary>
                      {row && <div className="border-t border-border bg-surface-muted px-4 py-4 md:px-5"><FormulaBreakdown formula={row.formula} currency={row.currency} /></div>}
                    </details>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {frozen && frozen.held.length > 0 && (
            <Panel title={`Held or excluded (${frozen.held.length})`} description="Not part of this transaction. They stay visible as unpaid and can carry forward when the period closes.">
              <ul className="divide-y divide-border">
                {frozen.held.map((h) => {
                  const row = rowsByKey.get(h.rowKey);
                  return (
                    <li key={h.rowKey} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-body-s md:px-5">
                      <span><span className="font-medium">{d.partners.get(h.partnerId)?.displayName}</span><span className="block text-ink-secondary">{h.reasons.join('; ')}</span></span>
                      {row && <Money value={row.owed} currency={row.currency} />}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          <Panel title="Checks before approval">
            <ul className="divide-y divide-border">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                  <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill', c.pass ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text')}><Icon name={c.pass ? 'check' : 'x'} size={12} strokeWidth={2.4} /></span>
                  <span className="text-body-s"><span className="block font-medium">{c.label}<span className="sr-only">: {c.pass ? 'pass' : 'fail'}</span></span><span className="text-ink-secondary">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-h3">Summary</h2><NetworkBadge network={network} /></div>
            <dl className="space-y-2 text-body-s">
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Payees</dt><dd className="tnum">{frozen?.payouts.length ?? 0}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Total to send</dt><dd className="font-semibold"><Zec zat={frozen?.totalZat ?? '0'} trim={false} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Network fee</dt><dd className="text-right">Provisional. Calculated by the wallet (ZIP 317) and shown before signing.</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Shielded available</dt><dd>{health.balance ? <Zec zat={health.balance.spendableZat} /> : 'Unknown'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Funding account</dt><dd className="font-mono text-label">{frozen?.accountId.slice(0, 8)}…</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Policy</dt><dd>FullPrivacy, one shielded pool, no transparent outputs</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Snapshot</dt><dd className="font-mono text-label">{d.period.frozenSnapshotHash?.slice(0, 16)}…</dd></div>
            </dl>
            {!approved && frozen && (
              allPass ? (
                <ApproveForm projectId={project.id} periodId={periodId} revision={d.period.revision} totalZat={frozen.totalZat} count={frozen.payouts.length} fingerprints={frozen.payouts.map((x) => ({ name: d.partners.get(x.partnerId)?.displayName ?? '', fp: shortFingerprint(x.addressFingerprint), zat: x.amountZat }))} />
              ) : (
                <Callout tone="warning" title="Approval blocked">{checks.filter((c) => !c.pass).map((c) => c.label).join('; ')}. Review and calculations stay available; approval needs every check to pass.</Callout>
              )
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
