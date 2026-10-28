import { ButtonLink } from '@/components/ui/button';
import { cx } from '@/components/ui/cx';

import { HeroScene } from './hero-scene';
import { CONTAINER, Eyebrow, ZecDot } from './primitives';

const FACTS = ['Fully shielded ZEC', 'Ironwood pool only', 'Inspected before signing', 'Self-hosted keys'];

export function Hero({ openHref }: { openHref: string }) {
  return (
    <section aria-labelledby="hero-title" className={cx(CONTAINER, 'flex flex-col items-center pt-12 text-center md:pt-16')}>
      <Eyebrow mark={<ZecDot />}>Revenue-share settlement on Zcash</Eyebrow>
      <h1 id="hero-title" className="mt-7 max-w-[60rem] text-balance text-display-xl text-ink md:mt-8">
        Pay every partner what they earned, and nothing about it lands on a public ledger.
      </h1>
      <p className="mt-6 max-w-[38rem] text-pretty text-body-l text-ink-secondary">
        Import the fees you actually earned, apply each partner’s agreement, approve a frozen snapshot, then pay everyone in one fully shielded ZEC transaction your own server builds and signs.
      </p>
      <div className="mt-9 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:justify-center">
        <ButtonLink href={openHref} size="lg" className="w-full sm:w-auto">Open workspace</ButtonLink>
        <ButtonLink href="#how" variant="secondary" size="lg" icon="chevronDown" className="w-full sm:w-auto">How it works</ButtonLink>
      </div>
      <HeroScene className="mt-12 w-full text-left md:mt-14" />
      <ul aria-label="What every payment guarantees" className="mt-10 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-border pt-7 md:justify-between">
        {FACTS.map((fact) => (
          <li key={fact} className="flex items-center gap-2 text-body-s font-medium text-ink-secondary">
            <span aria-hidden className="size-1.5 rounded-pill bg-accent" />
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}
