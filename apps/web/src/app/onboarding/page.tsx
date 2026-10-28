import Link from 'next/link';

import { ONBOARDING_STEPS } from '@/components/onboarding/steps';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { loadView } from '@/lib/api/views';

export default async function OnboardingHub() {
  const { project, status } = await loadView('onboarding.hub', {}, '/onboarding');
  const firstOpen = ONBOARDING_STEPS.find((s) => !status[s.key]);
  return (
    <div className="animate-rise">
      <h1 className="text-h1">Set up your settlement workspace</h1>
      <p className="mt-2 max-w-reading text-ink-secondary">Six steps take you from an empty install to a period you can review. You can leave and come back; each step saves as you go.</p>
      <ol className="mt-8 divide-y divide-border rounded-panel border border-border">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = status[s.key];
          return (
            <li key={s.key}>
              <Link prefetch={false} href={s.href} className="flex items-center gap-4 px-4 py-4 hover:bg-surface-muted md:px-5">
                <span className={`grid size-8 shrink-0 place-items-center rounded-pill ${done ? 'bg-success-soft text-success-text' : 'bg-surface-strong text-ink-secondary'}`}>{done ? <Icon name="check" size={16} /> : <span className="text-body-s tnum">{i + 1}</span>}</span>
                <span className="flex-1">
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-body-s text-ink-secondary">
                    {s.key === 'wallet' ? (done ? 'Wallet verified and funded' : 'Required before any payment. Accounting works without it.') : done ? 'Done' : s.skippable ? 'Can be deferred; payments stay blocked until it is done' : 'Required'}
                  </span>
                </span>
                {done ? <Badge tone="success">Done</Badge> : <Badge tone="neutral" icon={null}>To do</Badge>}
              </Link>
            </li>
          );
        })}
      </ol>
      {!status.wallet && <Callout tone="warning" className="mt-5" title="Not ready to pay">Until the wallet step passes, Setrya works for imports, calculations and review, and every send control stays locked.</Callout>}
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href={firstOpen?.href ?? '/onboarding/ready'} size="lg">Continue setup</ButtonLink>
        {project && <ButtonLink href={`/app/p/${project.id}`} variant="secondary" size="lg">Go to overview</ButtonLink>}
      </div>
    </div>
  );
}
