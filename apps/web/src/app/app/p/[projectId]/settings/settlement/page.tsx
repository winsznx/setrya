import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { SettlementForm } from './settlement-form';

export default async function SettlementSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, network } = await loadView('settings.settlement', { projectId }, `/app/p/${projectId}/settings/settlement`);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Settings', href: projectPath(project.id, '/settings') }, { label: 'Settlement' }]} title="Settlement defaults" description="These apply to future calculations and payments. Frozen snapshots and approvals never change." />
      <SettlementForm projectId={project.id} version={project.version} network={network} initial={{ cadence: project.cadence, defaultClassification: project.defaultClassification, minConfirmations: project.minConfirmations, targetConfirmations: project.targetConfirmations, rateExpiryHours: project.rateExpiryHours, stepUpWindowSeconds: project.stepUpWindowSeconds, maxRecipientsPerBatch: project.maxRecipientsPerBatch, minPayoutZat: project.minPayoutZat.toString() }} />
    </>
  );
}
