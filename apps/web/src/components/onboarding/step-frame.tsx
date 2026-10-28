import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

import { neighbours, type StepKey } from './steps';

/** Every onboarding step offers the same three exits: back, save and exit, continue. */
export function StepFrame({ step, title, description, children, continueHref, continueLabel = 'Continue', canContinue = true, hideContinue }: { step: StepKey; title: string; description: ReactNode; children: ReactNode; continueHref?: string; continueLabel?: string; canContinue?: boolean; hideContinue?: boolean }) {
  const { prev, next } = neighbours(step);
  return (
    <div className="animate-rise">
      <h1 className="text-h1">{title}</h1>
      <div className="mt-2 max-w-reading text-body text-ink-secondary">{description}</div>
      <div className="mt-7">{children}</div>
      <nav className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5" aria-label="Setup navigation">
        <Link prefetch={false} href={prev} className={buttonClasses({ variant: 'ghost' })}>
          <Icon name="arrowLeft" /> Back
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link prefetch={false} href="/app" className={buttonClasses({ variant: 'secondary' })}>Save and exit</Link>
          {!hideContinue && (canContinue ? <Link prefetch={false} href={continueHref ?? next} className={buttonClasses({})}>{continueLabel}</Link> : <span className={buttonClasses({ className: 'pointer-events-none opacity-50' })} aria-disabled="true">{continueLabel}</span>)}
        </div>
      </nav>
    </div>
  );
}
