import { redirect } from 'next/navigation';

import { StepFrame } from '@/components/onboarding/step-frame';
import { Callout } from '@/components/ui/card';
import { loadView } from '@/lib/api/views';

import { PartnerStep } from '../client-steps';

export default async function PartnerPage() {
  const { project, partners, network } = await loadView('onboarding.partner', {}, '/onboarding/partner');
  if (!project) redirect('/onboarding/workspace');
  return (
    <StepFrame step="partner" title="First partner" description="Someone you share revenue with. Their payout address can wait, but nothing is paid to them until it passes the shielded address check.">
      {partners.length > 0 && <Callout tone="success" className="mb-6" title={`${partners.length} partner${partners.length === 1 ? '' : 's'} saved`}>{partners.map((p) => p.displayName).join(', ')}</Callout>}
      <PartnerStep projectId={project.id} network={network} />
    </StepFrame>
  );
}
