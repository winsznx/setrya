import { redirect } from 'next/navigation';

import { StepFrame } from '@/components/onboarding/step-frame';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/card';
import { isoDay } from '@/lib/format';
import { loadView } from '@/lib/api/views';

import { AgreementStep } from '../client-steps';

export default async function AgreementPage() {
  const { project, partners, sources, agreements } = await loadView('onboarding.agreement', {}, '/onboarding/agreement');
  if (!project) redirect('/onboarding/workspace');
  const ready = partners.length > 0 && sources.length > 0;
  return (
    <StepFrame step="agreement" title="First agreement" description="The terms that turn eligible fees into an amount owed. Agreements are versioned: a frozen period always keeps the version it used.">
      {agreements.length > 0 && <Callout tone="success" className="mb-6" title={`${agreements.length} agreement${agreements.length === 1 ? '' : 's'} saved`}>{agreements.map((a) => a.title).join(', ')}</Callout>}
      {ready ? (
        <AgreementStep
          projectId={project.id}
          projectCurrency={project.currency}
          partners={partners.map((p) => ({ id: p.id, name: p.displayName, active: p.active }))}
          sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency }))}
          initial={{ partnerId: partners[0]!.id, sourceIds: [sources[0]!.id], title: '', externalRef: '', effectiveFrom: isoDay(new Date(Date.now() - 30 * 86_400_000), project.timezone), effectiveTo: '', kind: 'percentage', ratePct: '20', refundTreatment: 'net_adjustment', capAmount: '', poolSemantics: 'exclusive', overcommitAcknowledged: false, fixedAmount: '', fixedCurrency: 'ZEC', conversionBasis: 'rate_snapshot', cadence: 'per_period', basisDefinition: '', exclusions: '', notes: '' }}
        />
      ) : (
        <EmptyState title="Add a source and a partner first" action={<><ButtonLink href="/onboarding/source" variant="secondary">Add source</ButtonLink><ButtonLink href="/onboarding/partner" variant="secondary">Add partner</ButtonLink></>}>An agreement connects one partner to one or more revenue sources.</EmptyState>
      )}
    </StepFrame>
  );
}
