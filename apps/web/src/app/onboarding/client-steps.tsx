'use client';

import { useRouter } from 'next/navigation';

import { AgreementForm, type AgreementDraft } from '@/components/forms/agreement-form';
import { ImportWizard } from '@/components/forms/import-wizard';
import { PartnerCreateForm } from '@/components/forms/partner-form';
import { ProjectForm, type ProjectFormValues } from '@/components/forms/project-form';
import { SourceForm, type SourceValues } from '@/components/forms/source-form';
import type { NetworkLabel } from '@/components/shell/status-pills';
import { api } from '@/lib/client/api';

async function advance(projectId: string, step: string) {
  await api(`/api/v1/projects/${projectId}/onboarding`, { method: 'POST', body: { step } });
}

export function WorkspaceStep({ initial }: { initial: ProjectFormValues }) {
  const router = useRouter();
  return <ProjectForm initial={initial} endpoint="/api/v1/projects" method="POST" submitLabel="Create workspace" onSaved={() => router.push('/onboarding/source')} />;
}

export function SourceStep({ projectId, initial }: { projectId: string; initial: SourceValues }) {
  const router = useRouter();
  return <SourceForm initial={initial} endpoint={`/api/v1/projects/${projectId}/sources`} method="POST" submitLabel="Save source" onSaved={async () => { await advance(projectId, 'partner'); router.push('/onboarding/partner'); }} />;
}

export function PartnerStep({ projectId, network }: { projectId: string; network: NetworkLabel }) {
  const router = useRouter();
  return <PartnerCreateForm projectId={projectId} network={network} onSaved={async () => { await advance(projectId, 'agreement'); router.push('/onboarding/agreement'); }} />;
}

export function AgreementStep(props: { projectId: string; projectCurrency: string; partners: { id: string; name: string; active: boolean }[]; sources: { id: string; name: string; currency: string }[]; initial: AgreementDraft }) {
  const router = useRouter();
  return <AgreementForm {...props} mode="create" onDone={async () => { await advance(props.projectId, 'wallet'); router.push('/onboarding/wallet'); }} />;
}

export function ImportStep({ projectId, sources }: { projectId: string; sources: { id: string; name: string; currency: string; timezone: string }[] }) {
  const router = useRouter();
  return (
    <ImportWizard
      projectId={projectId}
      sources={sources}
      onCommitted={async (importId) => { await advance(projectId, 'ready'); router.push(`/app/p/${projectId}/revenue/import/${importId}?from=onboarding`); }}
      onSkip={async () => { await advance(projectId, 'ready'); router.push('/onboarding/ready?skippedImport=1'); }}
    />
  );
}
