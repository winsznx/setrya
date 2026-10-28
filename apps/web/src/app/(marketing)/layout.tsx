import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { MobileMenu } from '@/components/marketing/mobile-menu';
import { loadView } from '@/lib/api/views';

export const dynamic = 'force-dynamic';

const NAV = [
  ['/how-it-works', 'How it works'],
  ['/privacy', 'Privacy'],
  ['/docs', 'Docs'],
  ['/demo', 'Sample'],
] as const;

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const provisioned = await loadView('auth.status').then((s) => s.ownerExists, () => true);
  const open = provisioned ? '/sign-in' : '/setup-owner';
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-pill focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center gap-6 px-4 md:px-8">
          <Wordmark />
          <span className="hidden items-center gap-1.5 rounded-pill bg-zec-soft px-2.5 py-1 text-label lg:inline-flex"><span aria-hidden className="size-1.5 rounded-pill bg-zec" />Zcash settlement</span>
          <nav aria-label="Site" className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="text-body-s text-ink-secondary hover:text-ink">{label}</Link>)}
            <Link href={open} className="rounded-pill bg-brand px-4 py-2 text-body-s font-medium text-on-brand hover:bg-brand-strong">Open workspace</Link>
          </nav>
          <div className="ml-auto md:hidden"><MobileMenu items={[...NAV, [open, 'Open workspace']]} /></div>
        </div>
      </header>
      <main id="main-content" className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-10 text-body-s text-ink-secondary md:flex-row md:items-center md:justify-between md:px-8">
          <Wordmark />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/docs" className="hover:text-ink">Docs</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/docs/getting-started" className="hover:text-ink">Self-host</Link>
          </nav>
          <p>Self-hosted. Your server, your wallet, your records.</p>
        </div>
      </footer>
    </div>
  );
}
