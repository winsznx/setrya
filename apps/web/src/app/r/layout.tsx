import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Mark } from '@/components/brand/wordmark';

export const metadata: Metadata = { title: 'Private statement', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** No navigation, no project directory, no third-party scripts. One statement and nothing else. */
export default function RecipientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="flex h-14 items-center gap-2 px-4 text-ink-secondary">
        <Mark size={18} />
        <span className="text-body-s">Private statement</span>
      </header>
      <main id="main-content" className="mx-auto max-w-[54rem] px-3 pb-16 sm:px-4">{children}</main>
    </div>
  );
}
