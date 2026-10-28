import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';

export function ErrorFrame({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <header className="flex h-16 items-center px-5"><Wordmark /></header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 pb-16">
        <section className="w-full max-w-md rounded-workspace bg-canvas p-7 shadow-workspace">
          <p className="font-mono text-label text-ink-muted">{code}</p>
          <h1 className="mt-2 text-h1">{title}</h1>
          <div className="mt-2 text-body text-ink-secondary">{children}</div>
          <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
        </section>
      </main>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link prefetch={false} href={href} className="inline-flex min-h-control items-center rounded-pill bg-brand px-5 text-body font-medium text-on-brand hover:bg-brand-strong">{children}</Link>;
}
