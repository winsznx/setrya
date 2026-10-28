import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TestConnectionButton } from '@/components/app/test-connection';
import { BalanceSummary, WalletChecklist } from '@/components/app/wallet-health';
import { StepFrame } from '@/components/onboarding/step-frame';
import { Callout, Card } from '@/components/ui/card';
import { RevealValue } from '@/components/ui/copy-button';
import { loadView } from '@/lib/api/views';

export default async function WalletStepPage() {
  const { project, health, receive } = await loadView('onboarding.wallet', {}, '/onboarding/wallet');
  if (!project || !health) redirect('/onboarding/workspace');
  return (
    <StepFrame step="wallet" title="Wallet status" description="Setrya does not connect to a browser wallet. It talks to the wallet service on your own Linux settlement host, through a connection configured on the server.">
      <div className="space-y-5">
        <Callout tone="info" title="Wallet operations run on your own Linux settlement host.">
          This page runs read-only checks against the server-side connection <strong className="font-semibold">{health.connectionName ?? 'not configured'}</strong>. Seeds and wallet passphrases never pass through the browser.
        </Callout>
        {!health.configured && (
          <Callout tone="warning" title="No wallet connection is configured">
            Set ZALLET_RPC_URL, ZEBRA_RPC_URL, SETRYA_NETWORK and SETRYA_PAYER_ACCOUNT_UUID on the server, then test again. Until then Setrya runs in accounting mode: imports, calculations and reviews work and every send control stays locked. <Link prefetch={false} href="/docs/getting-started#wallet" className="text-accent-text hover:underline">Wallet setup guide</Link>
          </Callout>
        )}
        {health.configProblem && health.configured && <Callout tone="danger" title="Connection settings are invalid">{health.configProblem}</Callout>}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-h3">Checks</h2>
            <TestConnectionButton />
          </div>
          <WalletChecklist health={health} timeZone={project.timezone} />
        </Card>
        {health.balance && (
          <Card>
            <h2 className="mb-2 text-h3">Spendable under FullPrivacy</h2>
            <BalanceSummary health={health} />
            {BigInt(health.balance.transparentZat) > 0n && BigInt(health.balance.spendableZat) === 0n && (
              <Callout tone="warning" className="mt-3">This balance cannot pay under FullPrivacy. Add shielded funds or use an independently approved funding process.</Callout>
            )}
          </Card>
        )}
        {receive && 'address' in receive && (
          <Card>
            <h2 className="text-h3">Fund the payer account</h2>
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <div className="size-36 shrink-0 rounded-xs bg-white p-1.5" role="img" aria-label="QR code of the shielded receiving address" dangerouslySetInnerHTML={{ __html: receive.qrSvg }} />
              <div className="min-w-0 flex-1 space-y-2 text-body-s">
                <p className="text-ink-secondary">Shielded receiving address derived by the wallet service for account {health.account.uuid?.slice(0, 8)}…</p>
                <RevealValue masked={receive.masked} value={receive.address} />
              </div>
            </div>
          </Card>
        )}
        {receive && 'error' in receive && <Callout tone="warning">Receiving address unavailable: {receive.error}</Callout>}
      </div>
    </StepFrame>
  );
}
