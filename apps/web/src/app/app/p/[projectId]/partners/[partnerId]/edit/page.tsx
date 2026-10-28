import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { EditPartnerClient } from './edit-partner-client';

export default async function EditPartnerPage({ params }: { params: Promise<{ projectId: string; partnerId: string }> }) {
  const { projectId, partnerId } = await params;
  const { project, partner, unsettled, network } = await loadView('partners.edit', { projectId, partnerId }, `/app/p/${projectId}/partners/${partnerId}/edit`);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Partners', href: projectPath(project.id, '/partners') }, { label: partner.displayName, href: projectPath(project.id, `/partners/${partner.id}`) }, { label: 'Edit' }]} title={`Edit ${partner.displayName}`} />
      <EditPartnerClient
        projectId={project.id}
        partnerId={partner.id}
        version={partner.version}
        network={network}
        unsettledPeriods={unsettled}
        currentAddress={partner.address ? { masked: partner.address.masked, value: partner.address.address } : null}
        initial={{ displayName: partner.displayName, shortRef: partner.shortRef ?? '', contact: partner.contact ?? '', notes: partner.notes ?? '', category: partner.category as 'promoter', active: partner.active }}
      />
    </>
  );
}
