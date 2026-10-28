import Link from 'next/link';
import type { ReactNode } from 'react';

import { ZecMark } from '@/components/brand/zec-mark';
import { Wordmark } from '@/components/brand/wordmark';
import { CONTAINER } from '@/components/landing/primitives';
import { MobileMenu } from '@/components/marketing/mobile-menu';
import { loadView } from '@/lib/api/views';

export const dynamic = 'force-dynamic';

const NAV = [
  ['/try', 'Try it'],
  ['/how-it-works', 'How it works'],
  ['/privacy', 'Privacy'],
  ['/docs', 'Docs'],
  ['/demo', 'Sample'],
] as const;

const FOOTER = [
  { title: 'Product', links: [['/how-it-works', 'How it works'], ['/demo', 'Sample project'], ['/privacy', 'Privacy model']] },
  { title: 'Operators', links: [['/docs', 'Documentation'], ['/docs/getting-started', 'Self-host'], ['https://github.com/winsznx/setrya', 'Source code']] },
  { title: 'Legal', links: [['/terms', 'Terms'], ['/privacy', 'Data handling']] },
] as const;

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const provisioned = await loadView('auth.status').then((s) => s.ownerExists, () => true);
  const open = provisioned ? '/sign-in' : '/setup-owner';
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-pill focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
        <div className={`${CONTAINER} flex h-16 items-center gap-6 md:h-[4.25rem]`}>
          <Wordmark />
          <nav aria-label="Site" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(([href, label]) => (
              <Link key={href} prefetch={false} href={href} className="rounded-pill px-3.5 py-2 text-body-s font-medium text-ink-secondary transition-colors duration-fast hover:bg-surface-muted hover:text-ink">{label}</Link>
            ))}
          </nav>
          <Link prefetch={false} href={open} className="hidden rounded-pill bg-brand px-5 py-2.5 text-body-s font-medium text-on-brand transition-colors duration-fast hover:bg-brand-strong md:inline-flex">Open workspace</Link>
          <div className="ml-auto md:hidden"><MobileMenu items={[...NAV, [open, 'Open workspace']]} /></div>
        </div>
      </header>
      <main id="main-content" className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface-muted">
        <div className={`${CONTAINER} grid gap-10 py-14 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:py-16`}>
          <div className="max-w-[20rem]">
            <Wordmark />
            <p className="mt-4 text-body-s text-ink-secondary">Revenue-share settlement in fully shielded ZEC. Self-hosted: your server, your wallet, your records.</p>
            <p className="mt-4 inline-flex items-center gap-2 text-label text-ink-muted"><ZecMark />Settles on Zcash</p>
          </div>
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-label font-semibold text-ink">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map(([href, label]) => (
                  <li key={label}><Link prefetch={false} href={href} className="text-body-s text-ink-secondary transition-colors duration-fast hover:text-ink">{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-border">
          <p className={`${CONTAINER} py-6 text-label text-ink-muted`}>Setrya is software you run. It does not hold funds, give financial advice or verify the fee figures your platform reports.</p>
        </div>
      </footer>
    </div>
  );
}
