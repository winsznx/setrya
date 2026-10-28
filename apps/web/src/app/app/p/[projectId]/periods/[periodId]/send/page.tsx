import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NetworkBadge } from '@/components/shell/status-pills';
import { Callout } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { BatchPanel, type BatchView } from './batch-panel';

export default async function SendPage({ params }: { params: Promise<{ projectId: string; periodId: string }> }) {
  const { projectId, periodId } = await params;
  const view = await loadView('periods.send', { projectId, periodId }, `/app/p/${projectId}/periods/${periodId}/send`);
  const { project, d, network } = view;
  const p = (rest: string) => projectPath(project.id, rest);
  if (!view.health) redirect(p(`/periods/${periodId}`));
  const { health, walletLabel } = view;
  const batches: BatchView[] = view.batches;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Periods', href: p('/periods') }, { label: d.period.label, href: p(`/periods/${periodId}`) }, { label: 'Settle' }]} title="Settle approved payments" meta={<NetworkBadge network={network} />} description="Every stage below reflects real wallet and node state. Nothing advances on a timer." />
      <Callout tone="warning" className="mb-5" title="Signed transactions are generally irreversible">Check recipients and amounts against the wallet&apos;s inspection before you authorise. Setrya cannot recall a shielded payment.</Callout>
      {!health.canPay && <Callout tone="danger" className="mb-5" title={walletLabel ?? ''} action={<Link prefetch={false} className="text-body-s font-medium text-accent-text hover:underline" href={p('/wallet')}>Wallet status</Link>}>Preparing and signing are blocked: {health.blockers.join('; ')}. Transactions already broadcast are still reconciled when the node is reachable.</Callout>}
      {batches.length > 1 && <p className="mb-4 text-body-s text-ink-secondary">This approval is split into {batches.length} transactions. Each is prepared, authorised and confirmed on its own; a failed later batch never changes an earlier confirmed one.</p>}
      <div className="space-y-6">
        {batches.map((b) => <BatchPanel key={b.id} batch={b} projectId={project.id} periodId={periodId} canPay={health.canPay} payBlockers={health.blockers} targetConfirmations={project.targetConfirmations} timezone={project.timezone} network={network} />)}
      </div>
    </>
  );
}
