import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';
import { Icon, type IconName } from './icons';

export function Card({ className, children, padded = true, muted = false, ...rest }: HTMLAttributes<HTMLElement> & { padded?: boolean; muted?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-module border border-border', muted ? 'bg-surface-muted' : 'bg-surface shadow-raised', padded && 'p-card md:p-6', className)} {...rest}>
      {children}
    </section>
  );
}

export function Panel({ title, action, children, className, description }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; description?: ReactNode }) {
  return (
    <section className={cx('min-w-0 overflow-hidden rounded-module border border-border bg-surface shadow-raised', className)}>
      {title !== undefined && (
        <header className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-card py-3.5 md:px-6">
          <div className="min-w-0">
            <h2 className="text-h3">{title}</h2>
            {description && <p className="text-body-s text-ink-secondary">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, footnote, href, tone = 'default', explain }: { label: string; value: ReactNode; footnote?: ReactNode; href?: string; tone?: 'default' | 'warning' | 'success'; explain?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-body-s text-ink-secondary">
        {tone !== 'default' && <span aria-hidden className={cx('size-2 rounded-pill', tone === 'warning' ? 'bg-warning' : 'bg-success')} />}
        <span>{label}</span>
        {explain && (
          <span className="cursor-help text-ink-muted" title={explain}>
            <Icon name="info" size={14} />
            <span className="sr-only">{explain}</span>
          </span>
        )}
      </div>
      <div className="mt-3 text-figure tnum text-ink">{value}</div>
      {footnote && <div className="mt-1 text-body-s text-ink-muted">{footnote}</div>}
    </>
  );
  const cls = 'block min-w-0 rounded-module bg-panel-soft p-card md:p-5';
  return href ? (
    <Link prefetch={false} href={href} className={cx(cls, 'transition-shadow duration-fast hover:shadow-raised')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type CalloutTone = 'info' | 'warning' | 'danger' | 'success' | 'sample';
const TONE: Record<CalloutTone, { box: string; icon: IconName; iconClass: string }> = {
  info: { box: 'border-accent-border bg-info-soft', icon: 'info', iconClass: 'text-accent' },
  warning: { box: 'border-transparent bg-warning-soft', icon: 'alert', iconClass: 'text-warning' },
  danger: { box: 'border-transparent bg-danger-soft', icon: 'alert', iconClass: 'text-danger' },
  success: { box: 'border-transparent bg-success-soft', icon: 'check', iconClass: 'text-success' },
  sample: { box: 'border-transparent bg-sample-soft', icon: 'info', iconClass: 'text-sample' },
};

export function Callout({ tone = 'info', title, children, action, className, live }: { tone?: CalloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string; live?: boolean }) {
  const t = TONE[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : live ? 'status' : undefined} className={cx('flex gap-3 rounded-row border p-3.5 md:p-4', t.box, className)}>
      <Icon name={t.icon} className={cx('mt-0.5 shrink-0', t.iconClass)} />
      <div className="min-w-0 flex-1 text-body-s">
        {title && <div className="font-semibold text-ink">{title}</div>}
        {children && <div className={cx('text-ink-secondary', title ? 'mt-0.5' : undefined)}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/** Term beside detail from 640 px, or always stacked for narrow panes such as the exception inbox. */
export function DefinitionList({ items, className, stacked }: { items: { term: ReactNode; detail: ReactNode }[]; className?: string; stacked?: boolean }) {
  return (
    <dl className={cx('divide-y divide-border', className)}>
      {items.map((item, i) => (
        <div key={i} className={cx('grid grid-cols-1 gap-0.5', stacked ? 'py-2' : 'py-2.5 sm:grid-cols-[minmax(9rem,38%)_1fr] sm:gap-4')}>
          <dt className="text-body-s text-ink-secondary">{item.term}</dt>
          <dd className="min-w-0 break-words text-body-s text-ink">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ icon = 'file', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-border-strong bg-surface px-5 py-8 md:items-center md:px-8 md:py-12 md:text-center">
      <span className="grid size-11 place-items-center rounded-row bg-surface-muted text-ink-secondary">
        <Icon name={icon} size={20} />
      </span>
      <div className="max-w-md">
        <h2 className="text-h3">{title}</h2>
        {children && <div className="mt-1 text-body-s text-ink-secondary">{children}</div>}
      </div>
      {action && <div className="flex flex-wrap gap-2 md:justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx('block animate-pulse rounded-xs bg-skeleton', className)} />;
}

export function LoadingPage({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-panel" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-panel" />
    </div>
  );
}
