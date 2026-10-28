import { TestConnectionButton } from '@/components/app/test-connection';
import { WalletChecklist } from '@/components/app/wallet-health';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { DiagnosticsButton } from './diagnostics';

export default async function IntegrationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, health, wallet: s } = await loadView('settings.integrations', { projectId }, `/app/p/${projectId}/settings/integrations`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Settings', href: p('/settings') }, { label: 'Integrations' }]} title="Integrations" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:row-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-h3">Wallet service and chain connection</h2><Badge tone={s.state === 'ready' ? 'success' : s.state === 'unconfigured' ? 'neutral' : 'warning'}>{s.state === 'ready' ? 'Connected' : s.state === 'degraded' ? 'Syncing or blocked' : s.state === 'offline' ? 'Failed' : 'Not configured'}</Badge></div>
          <p className="mt-1 text-body-s text-ink-secondary">Connection <span className="font-mono">{health.connectionName ?? 'none'}</span>, configured on the server. RPC stays on loopback or a private network and is never reachable from the browser.</p>
          <div className="mt-3"><WalletChecklist health={health} timeZone={project.timezone} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><TestConnectionButton label="Check health" /><DiagnosticsButton /></div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-2"><h2 className="text-h3">Revenue CSV import</h2><Badge tone="success">Available</Badge></div>
          <p className="mt-1 text-body-s text-ink-secondary">UTF-8 CSV up to 5 MB, parsed on this host.</p>
        </Card>
        <Card muted>
          <div className="flex items-center justify-between gap-2"><h2 className="text-h3">NEAR Intents funding</h2><Badge tone="neutral" icon={null}>Not enabled</Badge></div>
          <p className="mt-1 text-body-s text-ink-secondary">Out of scope for this version. Cross-chain funding would need verified native-ZEC routes and clear provenance, slippage, fee and privacy disclosures before it could be offered.</p>
        </Card>
      </div>
    </>
  );
}
