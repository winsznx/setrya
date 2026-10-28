import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { isoDay } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { PeriodWizard } from './period-wizard';

export default async function NewPeriodPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ source?: string; start?: string; end?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { project, sources, rates, health } = await loadView('periods.new', { projectId }, `/app/p/${projectId}/periods/new`);
  const now = new Date();
  const firstOfMonth = `${isoDay(now, project.timezone).slice(0, 7)}-01`;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Periods', href: projectPath(project.id, '/periods') }, { label: 'New period' }]} title="New settlement period" description="Five steps. Creating the draft calculates amounts owed; it never moves funds." />
      {sources.length === 0 ? (
        <EmptyState title="Add a revenue source first" action={<ButtonLink href={projectPath(project.id, '/revenue/sources')}>Add source</ButtonLink>}>A period draws on imported fees from one or more sources.</EmptyState>
      ) : (
        <PeriodWizard
          projectId={project.id}
          timezone={project.timezone}
          sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency }))}
          rates={rates.map((r) => ({ id: r.id, base: r.base, description: r.description, source: r.sourceText, quotedAt: r.quotedAt.toISOString(), expiresAt: r.expiresAt.toISOString(), enteredAs: r.enteredAs }))}
          rateExpiryHours={project.rateExpiryHours}
          spendableZat={health.balance?.spendableZat ?? null}
          initial={{ label: '', startDate: sp.start ?? firstOfMonth, endDate: sp.end ?? isoDay(now, project.timezone), sourceIds: sp.source ? [sp.source] : sources.length === 1 ? [sources[0]!.id] : [] }}
        />
      )}
    </>
  );
}
