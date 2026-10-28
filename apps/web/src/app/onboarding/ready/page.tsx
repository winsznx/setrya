import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout, DefinitionList } from '@/components/ui/card';
import { loadView } from '@/lib/api/views';

export default async function ReadyPage({ searchParams }: { searchParams: Promise<{ skippedImport?: string }> }) {
  const { project, status, sources, partners, agreements } = await loadView('onboarding.ready', {}, '/onboarding/ready');
  if (!project || !status) redirect('/onboarding/workspace');
  const { skippedImport } = await searchParams;
  const mark = (ok: boolean, okText: string, noText: string) => (ok ? <Badge tone="success">{okText}</Badge> : <Badge tone="warning">{noText}</Badge>);
  return (
    <div className="animate-rise">
      <h1 className="text-h1">Setup summary</h1>
      <p className="mt-2 text-ink-secondary">A green check only appears for something Setrya verified.</p>
      <DefinitionList
        className="mt-6"
        items={[
          { term: 'Organisation', detail: <>{project.orgName} {mark(true, 'Created', '')}</> },
          { term: 'Project', detail: project.name },
          { term: 'First source', detail: <>{sources[0]?.name ?? 'None'} {mark(status.source, 'Saved', 'Missing')}</> },
          { term: 'First partner', detail: <>{partners[0]?.displayName ?? 'None'} {mark(status.partner, 'Saved', 'Missing')}</> },
          { term: 'Agreement', detail: <>{agreements[0]?.title ?? 'None'} {mark(status.agreement, 'Active', 'None active')}</> },
          { term: 'Wallet', detail: mark(status.wallet, 'Ready to pay', 'Not ready to pay') },
          { term: 'Revenue', detail: mark(status.import, 'Imported', 'No revenue imported yet') },
        ]}
      />
      {skippedImport && <Callout tone="warning" className="mt-5" title="No revenue imported yet">A settlement period cannot owe anything until fee rows exist.</Callout>}
      {!status.wallet && <Callout tone="info" className="mt-5">Setrya stays useful for local accounting and payout review. No send control is enabled until the wallet checks pass.</Callout>}
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href={`/app/p/${project.id}`} size="lg">Go to overview</ButtonLink>
        <ButtonLink href={`/app/p/${project.id}/revenue/import`} variant="secondary" size="lg">Import more fees</ButtonLink>
      </div>
    </div>
  );
}
