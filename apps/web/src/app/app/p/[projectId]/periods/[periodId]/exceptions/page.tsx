import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ExceptionInbox, type InboxException } from './inbox';

export default async function ExceptionsPage({ params }: { params: Promise<{ projectId: string; periodId: string }> }) {
  const { projectId, periodId } = await params;
  const { project, d, allowed } = await loadView('periods.exceptions', { projectId, periodId }, `/app/p/${projectId}/periods/${periodId}/exceptions`);
  const entries = new Map(d.entries.map((e) => [e.id, e]));
  const items: InboxException[] = d.exceptions.map((x) => ({
    id: x.id,
    code: x.code,
    severity: x.severity,
    status: x.status,
    decision: x.decision,
    reason: x.reason,
    detail: x.detail,
    moneyAtRisk: x.moneyAtRisk,
    createdAt: x.createdAt.toISOString(),
    partner: x.partnerId ? (d.partners.get(x.partnerId)?.displayName ?? null) : null,
    allowed: allowed.get(x.id) ?? [],
    entries: x.entryIds.map((id) => entries.get(id)).filter((e) => e !== undefined).map((e) => ({ id: e.id, externalId: e.externalId, description: e.description, amount: e.amount, amountRaw: e.amountRaw, currency: e.currency, type: e.type, occurredAt: e.occurredAt.toISOString(), raw: e.raw, issues: e.issues, importClassification: e.classification, periodInclusion: d.inclusion.get(e.id)?.inclusion ?? 'held' })),
    rows: x.rowKeys.map((k) => d.rows.find((r) => r.key === k)).filter((r) => r !== undefined).map((r) => ({ key: r.key, partner: d.partners.get(r.partnerId)?.displayName ?? '', agreement: `${d.agreements.get(r.agreementId)?.title ?? ''} v${d.agreements.get(r.agreementId)?.versions.find((v) => v.id === r.agreementVersionId)?.version ?? ''}`, owed: r.owed, currency: r.currency, zat: r.zat?.toString() ?? null, status: r.status })),
  }));
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Periods', href: p('/periods') }, { label: d.period.label, href: p(`/periods/${d.period.id}`) }, { label: 'Exceptions' }]} title="Exception inbox" description="An unresolved exception holds only the payouts it affects. If a row underlies every partner's fee base, all of them wait." />
      {d.period.status !== 'draft' && <Callout tone="info" className="mb-5" title="Read only">Revision {d.period.revision} is frozen. Decisions here are the record; to change one, start a new revision from the period page.</Callout>}
      {items.length === 0 ? (
        <Callout tone="success" title="No exceptions">Every row and payout in this revision passed its checks. <Link prefetch={false} className="font-medium text-accent-text hover:underline" href={p(`/periods/${d.period.id}`)}>Back to period</Link></Callout>
      ) : (
        <ExceptionInbox projectId={project.id} periodId={d.period.id} revision={d.period.revision} readOnly={d.period.status !== 'draft'} items={items} timezone={project.timezone} />
      )}
      <div className="mt-6"><Link prefetch={false} href={p(`/periods/${d.period.id}`)} className={buttonClasses({ variant: 'ghost' })}>Back to period</Link></div>
    </>
  );
}
