import { describeTerms } from '@setrya/domain';
import Link from 'next/link';

import { PeriodStatusBadge } from '@/components/app/status';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Card, DefinitionList, Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { EndAgreement } from './end-agreement';

export default async function AgreementPage({ params }: { params: Promise<{ projectId: string; agreementId: string }> }) {
  const { projectId, agreementId } = await params;
  const { project, agreement, partner, sources, usage, periods, events } = await loadView('agreements.detail', { projectId, agreementId }, `/app/p/${projectId}/agreements/${agreementId}`);
  const periodById = new Map(periods.map((x) => [x.id, x]));
  const pending = usage.filter((u) => u.status === 'draft').length;
  const t = agreement.current.terms;
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Agreements', href: p('/agreements') }, { label: agreement.title }]}
        title={agreement.title}
        meta={<><Badge tone={agreement.status === 'active' ? 'success' : 'neutral'} icon={agreement.status === 'active' ? 'check' : null}>{agreement.status}</Badge><Badge tone="neutral" icon={null}>v{agreement.current.version}</Badge></>}
        description={<>For <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/partners/${agreement.partnerId}`)}>{partner?.displayName}</Link>, effective {formatDate(agreement.current.effectiveFrom, project.timezone)}{agreement.current.effectiveTo ? ` until ${formatDate(agreement.current.effectiveTo, project.timezone)}` : ' onward'}</>}
        actions={agreement.status !== 'ended' ? <><EndAgreement projectId={project.id} agreementId={agreement.id} /><ButtonLink href={p(`/agreements/${agreement.id}/edit`)} icon="plus">Create revision</ButtonLink></> : undefined}
      />
      {agreement.versions.some((v) => v.status === 'draft') && agreement.status === 'active' && <Callout tone="info" className="mb-5" title="A draft revision is waiting">It has no effect until you activate it. <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/agreements/${agreement.id}/edit`)}>Continue the revision</Link>.</Callout>}
      {pending > 0 && <Callout tone="warning" className="mb-5">{pending} draft period{pending === 1 ? '' : 's'} use this agreement and will pick up an activated revision when recalculated. Frozen, paid and closed periods keep their version.</Callout>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="text-h3">Current rule</h2>
          <p className="mt-2 font-serif text-[1.375rem] leading-snug">{describeTerms(t)}</p>
          <DefinitionList className="mt-4" items={[
            { term: 'Fee base', detail: t.kind === 'percentage' ? `Eligible realised fees${t.refundTreatment === 'net_adjustment' ? ', net of refunds and chargebacks' : ', refunds ignored'}` : 'Not based on fees' },
            { term: 'Sources', detail: agreement.sourceIds.map((s) => sources.find((x) => x.id === s)?.name).join(', ') },
            { term: 'Cap', detail: t.kind === 'percentage' && t.cap ? `${t.cap.amount} ${t.cap.currency} per period` : 'None' },
            { term: 'Pool', detail: t.poolSemantics === 'exclusive' ? 'Share of one exclusive pool' : `Independent obligation${t.overcommitAcknowledged ? ' (overcommitment acknowledged)' : ''}` },
            { term: 'Conversion', detail: t.conversionBasis === 'zec_denominated' ? 'Already in ZEC' : 'Operator-approved rate snapshot per period' },
            { term: 'Basis definition', detail: t.basisDefinition || '—' },
            { term: 'Exclusions', detail: t.exclusions || '—' },
            { term: 'External reference', detail: agreement.externalRef ?? '—' },
          ]} />
          {t.kind === 'percentage' && <p className="mt-4 rounded-row bg-surface-muted p-3 text-body-s">Worked example: an eligible fee base of 1,000.00 gives 1,000.00 × {t.ratePct}% = owed for the period{t.cap ? `, capped at ${t.cap.amount}` : ''}. Illustrative only.</p>}
        </Card>
        <div className="space-y-6">
          <Panel title="Versions">
            <ol className="divide-y divide-border">
              {[...agreement.versions].reverse().map((v) => (
                <li key={v.id} className="px-5 py-3 text-body-s">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">Version {v.version}</span><Badge tone={v.status === 'active' ? 'success' : 'neutral'} icon={null}>{v.status}</Badge></div>
                  <div>{describeTerms(v.terms)}</div>
                  <div className="text-ink-secondary">{formatDate(v.effectiveFrom, project.timezone)}{v.effectiveTo ? ` – ${formatDate(v.effectiveTo, project.timezone)}` : ' onward'}</div>
                  {v.reason && <div className="mt-1 text-ink-muted">Reason: {v.reason}</div>}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Periods using this agreement">
            {usage.length === 0 ? <p className="px-5 py-5 text-body-s text-ink-muted">Not used in a period yet.</p> : (
              <ul className="divide-y divide-border">
                {usage.map((u) => (
                  <li key={`${u.periodId}${u.versionId}`}><Link prefetch={false} href={p(`/periods/${u.periodId}`)} className="flex items-center justify-between gap-2 px-5 py-3 text-body-s hover:bg-surface-muted"><span>{periodById.get(u.periodId)?.label} · v{agreement.versions.find((v) => v.id === u.versionId)?.version}</span><PeriodStatusBadge status={u.status as 'draft'} /></Link></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Activity">
            <ul className="divide-y divide-border">
              {events.map((e) => <li key={e.id} className="flex justify-between gap-2 px-5 py-2.5 text-body-s"><span>{e.eventType.replace(/^agreement\./, '').replaceAll('_', ' ')}</span><span className="text-ink-muted">{formatDateTime(e.createdAt, project.timezone)}</span></li>)}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
