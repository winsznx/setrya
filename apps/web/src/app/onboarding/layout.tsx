import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { NetworkBadge } from '@/components/shell/status-pills';
import { ToastProvider } from '@/components/ui/toast';
import { loadView } from '@/lib/api/views';

import { ProgressRail } from './progress-rail';

export const metadata: Metadata = { title: 'Set up Setrya', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const { network } = await loadView('onboarding.layout', {}, '/onboarding');
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-shell md:p-3">
        <div className="flex min-h-dvh flex-col bg-canvas md:min-h-[calc(100dvh-1.5rem)] md:rounded-workspace md:shadow-workspace">
          <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-5 md:px-8">
            <Wordmark href="/app" />
            <div className="flex items-center gap-3">
              <NetworkBadge network={network} />
              <Link prefetch={false} href="/app" className="text-body-s text-ink-secondary hover:text-ink">Exit setup</Link>
            </div>
          </header>
          <div className="mx-auto grid w-full max-w-content flex-1 gap-8 px-5 py-8 md:grid-cols-[13rem_minmax(0,1fr)] md:px-8 lg:gap-14">
            <ProgressRail />
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
