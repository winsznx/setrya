import type { WalletHealth } from '@setrya/api/contract';

import { Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icons';
import { cx } from '@/components/ui/cx';
import { formatDateTime } from '@/lib/format';

type Item = { label: string; state: 'pass' | 'fail' | 'unknown'; detail: string };

export function healthItems(h: WalletHealth): Item[] {
  const s = (b: boolean | null): Item['state'] => (b === null ? 'unknown' : b ? 'pass' : 'fail');
  return [
    { label: 'Chain connection available', state: s(h.configured ? h.zebra.reachable : null), detail: h.zebra.reachable ? `${h.zebra.build ?? 'version unknown'}` : (h.zebra.error ?? 'Not checked') },
    { label: 'Wallet service available', state: s(h.configured ? h.zallet.reachable : null), detail: h.zallet.reachable ? (h.connectionName ?? 'Connected') : (h.zallet.error ?? 'Not checked') },
    { label: 'Chain sync current', state: s(h.zebra.reachable ? h.zebra.synced && h.zallet.synced : null), detail: h.zebra.blocks !== null ? `Node at ${h.zebra.blocks}${h.zebra.estimatedHeight ? ` of ~${h.zebra.estimatedHeight}` : ''}${h.zallet.syncProgress ? `, wallet scan ${h.zallet.syncProgress}` : ''}` : 'Unknown' },
    { label: `Network is ${h.network.configured ?? 'configured network'}`, state: s(h.network.detected === 'unknown' ? null : h.network.match), detail: h.network.detected === 'unknown' ? 'Not detected yet' : `Wallet reports ${h.network.detected}` },
    { label: 'Wallet unlocked', state: s(h.zallet.encryptionLocked === null ? (h.zallet.reachable ? true : null) : !h.zallet.encryptionLocked), detail: h.zallet.encryptionLocked ? 'Unlock the wallet on the settlement host. Setrya never stores its passphrase.' : 'Signing available' },
    { label: 'Payer account exists', state: s(h.zallet.reachable ? h.account.found : null), detail: h.account.uuid ? `Account ${h.account.uuid.slice(0, 8)}…${h.account.name ? ` (${h.account.name})` : ''}` : 'SETRYA_PAYER_ACCOUNT_UUID not set' },
    { label: 'Ironwood-compatible PCZT path', state: s(h.zallet.reachable ? h.zallet.missingMethods.length === 0 : null), detail: h.zallet.missingMethods.length ? `Missing ${h.zallet.missingMethods.join(', ')}` : 'pczt_create, inspect, prove, sign, extract' },
    { label: 'Shielded spendable balance', state: s(h.balance ? BigInt(h.balance.spendableZat) > 0n : null), detail: h.balance ? `${h.balance.spendableZat} zat in one pool at ${h.balance.minConf}+ confirmations` : 'Unknown' },
    { label: 'RPC private', state: s(h.configured ? h.rpcPrivate : null), detail: 'Loopback or private network enforced by configuration' },
  ];
}

export function WalletChecklist({ health, timeZone }: { health: WalletHealth; timeZone: string }) {
  return (
    <div>
      <ul className="divide-y divide-border">
        {healthItems(health).map((i) => (
          <li key={i.label} className="flex items-start gap-3 py-2.5">
            <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill', i.state === 'pass' ? 'bg-success-soft text-success-text' : i.state === 'fail' ? 'bg-danger-soft text-danger-text' : 'bg-surface-strong text-ink-muted')}>
              <Icon name={i.state === 'pass' ? 'check' : i.state === 'fail' ? 'x' : 'clock'} size={12} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-s font-medium">{i.label}<span className="sr-only">: {i.state === 'pass' ? 'passing' : i.state === 'fail' ? 'failing' : 'not checked'}</span></span>
              <span className="block break-words text-body-s text-ink-secondary">{i.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-label text-ink-muted">Last checked {formatDateTime(health.checkedAt, timeZone)}</p>
    </div>
  );
}

export function BalanceSummary({ health }: { health: WalletHealth }) {
  if (!health.balance) return <span className="text-ink-muted">Balance unavailable</span>;
  const b = health.balance;
  return (
    <div className="space-y-1 text-body-s">
      <div className="text-figure tnum"><Zec zat={b.spendableZat} /></div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral" icon={null}>Orchard {b.orchardZat} zat</Badge>
        <Badge tone="neutral" icon={null}>Ironwood {b.ironwoodZat} zat</Badge>
        <Badge tone="neutral" icon={null}>Sapling {b.saplingZat} zat</Badge>
        {BigInt(b.transparentZat) > 0n && <Badge tone="warning">Transparent {b.transparentZat} zat</Badge>}
      </div>
    </div>
  );
}
