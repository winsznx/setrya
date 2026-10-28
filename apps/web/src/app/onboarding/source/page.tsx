import { redirect } from 'next/navigation';

import { StepFrame } from '@/components/onboarding/step-frame';
import { Callout } from '@/components/ui/card';
import { loadView } from '@/lib/api/views';

import { SourceStep } from '../client-steps';

export default async function SourcePage() {
  const { project, sources } = await loadView('onboarding.source', {}, '/onboarding/source');
  if (!project) redirect('/onboarding/workspace');
  return (
    <StepFrame step="source" title="Revenue source" description="Where your fees come from. Each import and agreement is tied to a source, so the fee base of every payout is traceable.">
      {sources.length > 0 && <Callout tone="success" className="mb-6" title={`${sources.length} source${sources.length === 1 ? '' : 's'} saved`}>{sources.map((s) => s.name).join(', ')}. Add another below or continue.</Callout>}
      <SourceStep projectId={project.id} initial={{ name: '', platform: '', note: '', referenceUrl: '', defaultCurrency: project.currency, feeType: 'realised_fee', timezone: project.timezone, kind: 'csv' }} />
    </StepFrame>
  );
}
