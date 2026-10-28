import type { NetworkLabel, WalletState } from '@setrya/api/contract';

import { ZecMark } from '@/components/brand/zec-mark';
import { Icon } from '@/components/ui/icons';
import { cx } from '@/components/ui/cx';

export type { NetworkLabel, WalletState };

export function NetworkBadge({ network, className }: { network: NetworkLabel; className?: string }) {
  const tone = network === 'MAINNET' ? 'bg-brand text-on-brand' : network === 'SAMPLE' ? 'bg-sample-soft text-sample' : 'bg-zec-soft text-ink';
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-micro font-semibold tracking-[0.06em]', tone, className)} title={network === 'SAMPLE' ? 'Sample data, no funds move' : `Settles on Zcash ${network.toLowerCase()}`}>
      {network === 'SAMPLE' ? <span aria-hidden className="size-1.5 rounded-pill bg-sample" /> : <ZecMark size={12} />}
      {network}
    </span>
  );
}


export function WalletPill({ state, label, href }: { state: WalletState; label: string; href?: string }) {
  const tone = { ready: 'text-success-text', degraded: 'text-warning-text', offline: 'text-danger-text', unconfigured: 'text-ink-secondary' }[state];
  const icon = state === 'ready' ? 'check' : state === 'unconfigured' ? 'info' : 'alert';
  const inner = (
    <span className={cx('inline-flex items-center gap-1.5 text-body-s font-medium', tone)}>
      <Icon name={icon} size={14} strokeWidth={2} />
      {label}
    </span>
  );
  return href ? <a href={href} className="hover:underline">{inner}</a> : inner;
}
