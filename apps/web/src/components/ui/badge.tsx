import type { ReactNode } from 'react';

import { cx } from './cx';
import { Icon, type IconName } from './icons';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'sample' | 'zec';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-strong text-ink-secondary',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  sample: 'bg-sample-soft text-sample',
  zec: 'bg-zec-soft text-ink',
};

const DEFAULT_ICON: Partial<Record<Tone, IconName>> = { success: 'check', warning: 'pause', danger: 'alert' };

/** Status is always carried by words and a glyph, never by color alone. */
export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: IconName | null; children: ReactNode; className?: string }) {
  const glyph = icon === null ? null : (icon ?? DEFAULT_ICON[tone]);
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-label font-medium', TONE[tone], className)}>
      {glyph && <Icon name={glyph} size={12} strokeWidth={2.2} />}
      <span className="truncate">{children}</span>
    </span>
  );
}
