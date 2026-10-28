import type { ReactNode } from 'react';

export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-16">
        <h1 className="max-w-3xl font-serif text-[clamp(2rem,1.5rem+2vw,3rem)] leading-tight text-balance">{title}</h1>
        {children && <div className="mt-4 max-w-reading text-[1.0625rem] text-ink-secondary">{children}</div>}
      </div>
    </header>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-reading space-y-4 px-4 py-12 text-body text-ink-secondary [&_h2]:mt-10 [&_h2]:text-h2 [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-h3 [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_a]:text-accent-text [&_a:hover]:underline [&_code]:rounded-xs [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_pre]:overflow-x-auto [&_pre]:rounded-row [&_pre]:bg-surface-strong [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.8125rem] [&_pre]:text-ink md:px-0">{children}</div>;
}
