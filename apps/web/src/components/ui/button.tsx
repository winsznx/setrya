import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';
import { Icon, type IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  accent: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'border border-border-strong bg-surface text-ink hover:border-ink-muted hover:bg-surface-muted',
  ghost: 'text-ink-secondary hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-strong',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-control-sm px-3.5 text-body-s',
  md: 'min-h-control px-5 text-body',
  lg: 'min-h-[3rem] px-6 text-body',
};

export function buttonClasses({ variant = 'primary', size = 'md', full = false, className }: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    full && 'w-full',
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: IconName;
  busy?: boolean;
  children?: ReactNode;
}

export function Button({ variant, size, full, icon, busy, className, children, disabled, type = 'button', ...rest }: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={buttonClasses({ variant, size, full, className })} {...rest}>
      {busy ? <Icon name="pending" className="animate-spin" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, full, icon, className, children, href, ...rest }: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <Link prefetch={false} href={href} className={buttonClasses({ variant, size, full, className })} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

/** A real control that cannot run yet, with the reason as visible text rather than a hover tooltip. */
export function BlockedAction({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" disabled className={buttonClasses({ variant: 'primary' })}>
        <Icon name="lock" />
        {label}
      </button>
      <p className="text-body-s text-ink-secondary">{reason}</p>
    </div>
  );
}
