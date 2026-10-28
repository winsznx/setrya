import { redirect } from 'next/navigation';

import { StepFrame } from '@/components/onboarding/step-frame';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { loadView } from '@/lib/api/views';

import { ImportStep } from '../client-steps';

export default async function ImportPage() {
  const { project, sources } = await loadView('onboarding.import', {}, '/onboarding/import');
  if (!project) redirect('/onboarding/workspace');
  return (
    <StepFrame step="import" title="First revenue import" description="Upload the fee statement you actually received. You will map its columns, review how each row is classified, and only then commit it." hideContinue>
      {sources.length === 0 ? (
        <EmptyState title="Add a revenue source first" action={<ButtonLink href="/onboarding/source">Add source</ButtonLink>}>Every import belongs to a source.</EmptyState>
      ) : (
        <ImportStep projectId={project.id} sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency, timezone: s.timezone }))} />
      )}
    </StepFrame>
  );
}
