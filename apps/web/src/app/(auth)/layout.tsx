import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <header className="flex h-16 items-center px-5 md:px-8">
        <Wordmark />
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 md:items-center md:pt-0">
        {children}
      </main>
    </div>
  );
}
