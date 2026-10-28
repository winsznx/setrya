import type { ReactNode } from 'react';

import { Mark } from '@/components/brand/wordmark';
import { cx } from '@/components/ui/cx';
import { Icon, type IconName } from '@/components/ui/icons';

/** The page column every marketing section sits in: content width with the responsive gutter. */
export const CONTAINER = 'mx-auto w-full max-w-content px-gutter';

/** A marketing section's top spacing: 64 px on a phone, 104 px from 768 px. Anchors land clear of the sticky header. */
export const SECTION = 'pt-section scroll-mt-16';

export function Section({ id, titleId, children, className }: { id?: string; titleId: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={titleId} className={cx(SECTION, className)}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

/** The pill above a heading. It names the section, or carries live state when `mark` is given. */
export function Eyebrow({ children, mark, className }: { children: ReactNode; mark?: ReactNode; className?: string }) {
  return (
    <p className={cx('inline-flex min-h-control-sm max-w-full items-center gap-2.5 rounded-pill border border-border bg-surface px-4 py-2 text-left text-body-s text-ink-secondary shadow-raised', className)}>
      {mark ?? <Mark size={16} />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

interface HeadingProps {
  titleId: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  className?: string;
}

/** Title on the left and its lead on the right, sharing a baseline from 768 px. On a phone the lead stacks under it. */
export function SplitHeading({ titleId, eyebrow, title, lead, className }: HeadingProps) {
  return (
    <div className={cx('flex flex-col items-start gap-7', className)}>
      {eyebrow}
      <div className="grid w-full gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)] md:items-end md:gap-10">
        <h2 id={titleId} className="text-balance text-display-l text-ink">{title}</h2>
        <p className="max-w-[36rem] text-pretty text-body-l text-ink-secondary md:pb-1.5">{lead}</p>
      </div>
    </div>
  );
}

export function CenteredHeading({ titleId, eyebrow, title, lead, className }: HeadingProps) {
  return (
    <div className={cx('mx-auto flex max-w-[48.75rem] flex-col items-center gap-5 text-center', className)}>
      {eyebrow}
      <h2 id={titleId} className="text-balance text-display-l text-ink">{title}</h2>
      <p className="max-w-[40rem] text-pretty text-body-l text-ink-secondary">{lead}</p>
    </div>
  );
}

/** One icon tile for every card: a surface disc with an indigo line icon. */
export function IconDisc({ name, className }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('grid size-11 shrink-0 place-items-center rounded-pill bg-surface text-accent-text shadow-raised', className)}>
      <Icon name={name} size={20} />
    </span>
  );
}

/** ZEC is the only gold on the page: this dot sits beside every ZEC amount and the word that names the coin. */
export function ZecDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block size-2 shrink-0 rounded-pill bg-zec', className)} />;
}
