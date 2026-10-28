import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ImportClient } from './import-client';

export default async function ImportPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ source?: string }> }) {
  const { projectId } = await params;
  const { project, sources } = await loadView('revenue.import', { projectId }, `/app/p/${projectId}/revenue/import`);
  const { source } = await searchParams;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Revenue', href: projectPath(project.id, '/revenue') }, { label: 'Import' }]} title="Import revenue" description="Upload, map, classify, commit. Nothing is saved until the last step." />
      {sources.length === 0 ? (
        <EmptyState title="Add a revenue source first" action={<ButtonLink href={projectPath(project.id, '/revenue/sources')}>Add source</ButtonLink>}>Every import belongs to an enabled source.</EmptyState>
      ) : (
        <ImportClient projectId={project.id} sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency, timezone: s.timezone }))} defaultSourceId={source} />
      )}
    </>
  );
}
