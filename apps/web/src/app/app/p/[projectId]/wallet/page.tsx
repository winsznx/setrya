import Link from 'next/link';

import { TestConnectionButton } from '@/components/app/test-connection';
import { WalletChecklist } from '@/components/app/wallet-health';
import { NetworkBadge } from '@/components/shell/status-pills';
import { Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Callout, Card, MetricCard, Panel } from '@/components/ui/card';
import { RevealValue } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { RecentWalletTransactions } from './recent';

export default async function WalletPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, health, receive, reservedZat, summary, network } = await loadView('wallet.overview', { projectId }, `/app/p/${projectId}/wallet`);
  const b = health.balance;
  const transparentOnly = b && BigInt(b.transparentZat) > 0n && BigInt(b.spendableZat) === 0n;
  const split = b && BigInt(b.orchardZat) > 0n && BigInt(b.ironwoodZat) > 0n;
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Wallet' }]} title="Wallet" meta={<><NetworkBadge network={network} /><Badge tone={summary.state === 'ready' ? 'success' : summary.state === 'unconfigured' ? 'neutral' : 'warning'} icon={summary.state === 'ready' ? 'check' : undefined}>{summary.label}</Badge></>} actions={<TestConnectionButton label="Refresh" />} description="Read from the wallet service on your settlement host. Setrya never holds or shows a seed." />
      {!health.configured && <Callout tone="info" className="mb-5" title="Accounting mode">No wallet connection is configured on this server. Everything except sending works. <Link prefetch={false} className="text-accent-text hover:underline" href="/docs/getting-started#wallet">Connect a wallet service</Link>.</Callout>}
      {transparentOnly && <Callout tone="warning" className="mb-5" title="Funding requires a different privacy policy or conversion">This account only holds transparent funds, which cannot pay under FullPrivacy. Shield them with your wallet first, following official Zcash guidance. Setrya never downgrades the policy to spend them.</Callout>}
      {split && <Callout tone="warning" className="mb-5" title="Funds are split across Orchard and Ironwood">A FullPrivacy payment spends from one pool. The spendable figure below is the larger pool only. Moving funds between pools reveals the amount crossing and is never done automatically.</Callout>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Spendable shielded balance" value={b ? <Zec zat={b.spendableZat} /> : '—'} footnote={b ? `Largest single pool, ${b.minConf}+ confirmations` : 'Wallet not reachable'} />
        <MetricCard label="Pending incoming" value={<span className="text-ink-muted">Not reported</span>} footnote="The wallet reports confirmed balances by pool" />
        <MetricCard label="Reserved for approved payouts" value={<Zec zat={reservedZat} />} footnote="Local planning only. Not locked on chain." />
        <MetricCard label="Next payment requirement" value={<Zec zat={reservedZat} />} footnote="Plus the ZIP 317 fee the wallet calculates" tone={b && reservedZat > BigInt(b.spendableZat) ? 'warning' : 'default'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Health">
          <div className="p-4 md:p-5"><WalletChecklist health={health} timeZone={project.timezone} /></div>
        </Panel>
        <div className="space-y-6">
          <Card>
            <h2 className="text-h3">Receive</h2>
            {receive && 'address' in receive ? (
              <div className="mt-3 flex flex-wrap items-start gap-5">
                <div className="size-36 shrink-0 rounded-xs bg-white p-1.5" role="img" aria-label="QR code of the shielded receiving address" dangerouslySetInnerHTML={{ __html: receive.qrSvg }} />
                <div className="min-w-0 flex-1 space-y-2 text-body-s">
                  <p className="text-ink-secondary">Unified Address with an Orchard receiver only, so incoming funds land shielded in the Ironwood pool. A UA can bundle several receiver types. Setrya always requires shielded outputs when it sends.</p>
                  <RevealValue masked={receive.masked} value={receive.address} timeoutSeconds={project.revealTimeoutSeconds} />
                  <p className="text-label text-ink-muted">Each refresh asks the wallet for a fresh diversified address of the same account.</p>
                </div>
              </div>
            ) : <p className="mt-2 text-body-s text-ink-secondary">{receive && 'error' in receive ? receive.error : 'Available once the payer account is reachable.'}</p>}
          </Card>
          {b && (
            <Card>
              <h2 className="mb-2 text-h3">Balance by pool</h2>
              <dl className="grid grid-cols-2 gap-2 text-body-s">
                <dt className="text-ink-secondary">Ironwood</dt><dd><Zec zat={b.ironwoodZat} /></dd>
                <dt className="text-ink-secondary">Orchard</dt><dd><Zec zat={b.orchardZat} /></dd>
                <dt className="text-ink-secondary">Sapling</dt><dd><Zec zat={b.saplingZat} /></dd>
                <dt className="text-ink-secondary">Transparent</dt><dd><Zec zat={b.transparentZat} /></dd>
              </dl>
              <p className="mt-2 text-label text-ink-muted">Fund source {health.fundSource}. Orchard receivers route to Ironwood after NU6.3; the orchard fund source spends either pool, one at a time.</p>
            </Card>
          )}
        </div>
      </div>
      <Panel title="Recent wallet transactions" className="mt-6" action={<Link prefetch={false} href={projectPath(project.id, '/wallet/activity')} className="text-body-s text-accent-text hover:underline">All wallet activity</Link>}>
        <RecentWalletTransactions projectId={project.id} limit={10} timezone={project.timezone} />
      </Panel>
    </>
  );
}
