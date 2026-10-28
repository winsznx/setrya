'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ONBOARDING_STEPS } from '@/components/onboarding/steps';
import { cx } from '@/components/ui/cx';

export function ProgressRail() {
  const pathname = usePathname();
  const current = ONBOARDING_STEPS.findIndex((s) => pathname?.startsWith(s.href));
  return (
    <nav aria-label="Setup steps" className="md:sticky md:top-8 md:self-start">
      <ol className="flex gap-1.5 overflow-x-auto scrollbar-none md:flex-col md:gap-0">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s.key} className="shrink-0">
            <Link prefetch={false} href={s.href} aria-current={i === current ? 'step' : undefined} className={cx('flex items-center gap-2.5 rounded-row px-2.5 py-2 text-body-s', i === current ? 'bg-surface-muted font-semibold text-ink' : 'text-ink-secondary hover:text-ink')}>
              <span className={cx('grid size-6 place-items-center rounded-pill text-micro tnum', i === current ? 'bg-brand text-on-brand' : 'bg-surface-strong')}>{i + 1}</span>
              <span className="whitespace-nowrap">{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
