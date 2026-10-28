import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <header className="flex h-16 items-center px-gutter md:h-[4.25rem]">
        <Wordmark />
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-gutter pb-16 pt-4 md:items-center md:pt-0">
        {children}
      </main>
    </div>
  );
}
