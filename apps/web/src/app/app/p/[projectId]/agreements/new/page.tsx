import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { isoDay } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { AgreementClient } from '../agreement-client';

export default async function NewAgreementPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ partner?: string }> }) {
  const { projectId } = await params;
  const { partner } = await searchParams;
  const { project, partners, sources } = await loadView('agreements.new', { projectId }, `/app/p/${projectId}/agreements/new`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Agreements', href: p('/agreements') }, { label: 'New' }]} title="New agreement" description="Terms are snapshotted into every period that uses them, so later edits never rewrite history." />
      {partners.length === 0 || sources.length === 0 ? (
        <EmptyState title="Add a partner and a source first" action={<><ButtonLink href={p('/partners/new')} variant="secondary">Add partner</ButtonLink><ButtonLink href={p('/revenue/sources')} variant="secondary">Add source</ButtonLink></>}>An agreement connects one partner to one or more revenue sources.</EmptyState>
      ) : (
        <AgreementClient
          mode="create"
          projectId={project.id}
          projectCurrency={project.currency}
          partners={partners.map((x) => ({ id: x.id, name: x.displayName, active: x.active }))}
          sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency }))}
          initial={{ partnerId: partners.find((x) => x.id === partner)?.id ?? '', sourceIds: sources.length === 1 ? [sources[0]!.id] : [], title: '', externalRef: '', effectiveFrom: isoDay(new Date(), project.timezone), effectiveTo: '', kind: 'percentage', ratePct: '', refundTreatment: 'net_adjustment', capAmount: '', poolSemantics: 'exclusive', overcommitAcknowledged: false, fixedAmount: '', fixedCurrency: 'ZEC', conversionBasis: 'rate_snapshot', cadence: 'per_period', basisDefinition: '', exclusions: '', notes: '' }}
        />
      )}
    </>
  );
}
