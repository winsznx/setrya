import { Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { RecentWalletTransactions } from '../recent';

export default async function WalletActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project } = await loadView('wallet.activity', { projectId }, `/app/p/${projectId}/wallet/activity`);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Wallet', href: projectPath(project.id, '/wallet') }, { label: 'Activity' }]} title="Wallet activity" description="What the payer wallet itself can see. This is a wallet-scoped view, not a public-chain payment disclosure, and it can include transfers Setrya did not make." />
      <Panel title="Transactions"><RecentWalletTransactions projectId={project.id} limit={100} timezone={project.timezone} /></Panel>
    </>
  );
}
