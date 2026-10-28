import type { Metadata } from 'next';

import { CONTAINER, Eyebrow } from '@/components/landing/primitives';
import { ZecMark } from '@/components/brand/zec-mark';

import { TryClaim } from './try-claim';

export const metadata: Metadata = {
  title: 'Get paid privately',
  description: 'Paste a Zcash testnet address and Setrya pays you a revenue share in one fully shielded transaction, then hands you a private statement you can verify.',
};

export default async function TryPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const { claim } = await searchParams;
  return (
    <div className={`${CONTAINER} pb-section pt-12 md:pt-16`}>
      <div className="flex max-w-[46rem] flex-col items-start gap-7">
        <Eyebrow mark={<ZecMark />}>Testnet sandbox</Eyebrow>
        <div>
          <h1 className="text-balance text-display-l text-ink">Get paid privately, in about three minutes.</h1>
          <p className="mt-5 text-pretty text-body-l text-ink-secondary">
            Paste a Zcash testnet address. Setrya treats you as a partner on a small sample revenue share, checks and signs one fully shielded payment, and sends it to you. Then you get a private statement and can prove your payout was part of the approved set, without seeing anyone else’s.
          </p>
        </div>
      </div>
      <TryClaim initialClaimId={claim && /^[0-9a-f-]{36}$/.test(claim) ? claim : null} />
    </div>
  );
}
