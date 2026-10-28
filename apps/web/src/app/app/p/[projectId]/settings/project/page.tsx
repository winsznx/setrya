import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ProjectSettingsClient } from './project-settings-client';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, demoMode } = await loadView('settings.project', { projectId }, `/app/p/${projectId}/settings/project`);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Settings', href: projectPath(project.id, '/settings') }, { label: 'Project' }]} title="Project" />
      <ProjectSettingsClient demoMode={demoMode} project={{ id: project.id, version: project.version, archived: project.archived, timezone: project.timezone }} initial={{ orgName: project.orgName, name: project.name, issuerLabel: project.issuerLabel, currency: project.currency as 'USD', timezone: project.timezone, description: project.description ?? '', contact: project.contact ?? '', logo: project.logo, cadence: project.cadence }} />
    </>
  );
}
