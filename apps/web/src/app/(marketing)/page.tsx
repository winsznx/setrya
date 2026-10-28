import type { Metadata } from 'next';

import { CtaBand } from '@/components/landing/cta-band';
import { Faq } from '@/components/landing/faq';
import { Features } from '@/components/landing/features';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Statement } from '@/components/landing/statement';
import { Visibility } from '@/components/landing/visibility';
import { loadView } from '@/lib/api/views';

export const metadata: Metadata = {
  title: 'Setrya: private revenue-share settlement in ZEC',
  description: 'Import the fees you earned, apply partner agreements, review exceptions, and pay each partner with a fully shielded Zcash transaction and a statement of their own.',
};

export default async function Landing() {
  const openHref = (await loadView('auth.status').then((s) => s.ownerExists, () => true)) ? '/sign-in' : '/setup-owner';
  return (
    <div className="pb-section">
      <Hero openHref={openHref} />
      <HowItWorks />
      <Features />
      <Statement />
      <Visibility />
      <Faq />
      <CtaBand openHref={openHref} />
    </div>
  );
}
