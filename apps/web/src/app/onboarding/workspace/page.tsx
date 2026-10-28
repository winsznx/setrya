import { StepFrame } from '@/components/onboarding/step-frame';
import { Callout, DefinitionList } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { loadView } from '@/lib/api/views';

import { WorkspaceStep } from '../client-steps';

export default async function WorkspacePage() {
  const { project, ownerTimezone } = await loadView('onboarding.workspace', {}, '/onboarding/workspace');
  return (
    <StepFrame step="workspace" title="Organisation and project" description="A project groups fee sources, partner agreements, settlement periods and payer wallet settings. You can add more projects later in Settings." canContinue={project !== null} hideContinue={project === null}>
      {project ? (
        <div className="space-y-4">
          <Callout tone="success" title="Workspace created">Edit these details any time from Settings → Project.</Callout>
          <DefinitionList items={[{ term: 'Organisation', detail: project.orgName }, { term: 'Project', detail: project.name }, { term: 'Statement issuer', detail: project.issuerLabel }, { term: 'Accounting currency', detail: project.currency }, { term: 'Time zone', detail: project.timezone }]} />
          <ButtonLink href={`/app/p/${project.id}/settings/project`} variant="secondary">Edit project settings</ButtonLink>
        </div>
      ) : (
        <WorkspaceStep initial={{ orgName: '', name: '', issuerLabel: '', currency: 'USD', timezone: ownerTimezone, description: '', contact: '', logo: null }} />
      )}
    </StepFrame>
  );
}
