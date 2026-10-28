import { Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { ActivityList } from './activity-list';

const TYPES = ['import', 'revenue', 'agreement', 'partner', 'period', 'exception', 'payment', 'statement', 'export', 'settings', 'rate', 'source'];

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ type?: string; days?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, rows: events } = await loadView('shell.activity', { projectId, type: sp.type && TYPES.includes(sp.type) ? sp.type : undefined, days: sp.days }, `/app/p/${projectId}/activity`);
  const rows = events.map(({ createdAt, ...e }) => ({ ...e, at: formatDateTime(createdAt, project.timezone) }));
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Activity' }]} title="Activity" description="Application accountability records for this project. They are stored encrypted on your host; they are not an immutable public blockchain audit." />
      <Panel title={`${rows.length} event${rows.length === 1 ? '' : 's'}`} action={<form className="flex flex-wrap gap-2" method="get"><select name="type" defaultValue={sp.type ?? ''} aria-label="Event type" className="min-h-control-sm rounded-control border border-border-control bg-surface px-2 text-body-s"><option value="">All events</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><select name="days" defaultValue={sp.days ?? ''} aria-label="Date range" className="min-h-control-sm rounded-control border border-border-control bg-surface px-2 text-body-s"><option value="">Any time</option><option value="1">24 hours</option><option value="7">7 days</option><option value="30">30 days</option></select><button className="rounded-pill border border-border-strong px-3 text-body-s">Filter</button></form>}>
        <ActivityList rows={rows} projectId={project.id} />
      </Panel>
    </>
  );
}
