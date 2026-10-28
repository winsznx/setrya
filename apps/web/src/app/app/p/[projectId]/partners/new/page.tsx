import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { NewPartnerClient } from './new-partner-client';

export default async function NewPartnerPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, network } = await loadView('partners.new', { projectId }, `/app/p/${projectId}/partners/new`);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Partners', href: projectPath(project.id, '/partners') }, { label: 'New partner' }]} title="Add partner" description="Notes and contact details are private and never appear on a statement." />
      <NewPartnerClient projectId={project.id} network={network} />
    </>
  );
}
