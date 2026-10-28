import { ButtonLink } from '@/components/ui/button';

import { CONTAINER, SECTION } from './primitives';

export function CtaBand({ openHref }: { openHref: string }) {
  return (
    <section aria-labelledby="cta-title" className={SECTION}>
      <div className={CONTAINER}>
        <div className="flex flex-col items-center rounded-[28px] bg-band px-6 py-14 text-center text-white md:py-20">
          <h2 id="cta-title" className="max-w-[40rem] text-balance text-display-l">Close your next period in one sitting.</h2>
          <p className="mt-5 max-w-[34rem] text-pretty text-body-l text-white/75">Start on testnet with a sample project, then point it at your own fee export when the numbers match yours.</p>
          <div className="mt-9 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
            <ButtonLink href={openHref} variant="secondary" size="lg" className="w-full border-transparent sm:w-auto">Open workspace</ButtonLink>
            <ButtonLink href="/demo" variant="ghost" size="lg" className="w-full text-white hover:bg-white/10 hover:text-white sm:w-auto">Explore the sample</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
