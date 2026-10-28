import type { ReactNode } from 'react';

import { CONTAINER, Eyebrow } from '@/components/landing/primitives';

/** The top of every public subpage: the eyebrow naming the page, the title and its lead, on the landing's rhythm. */
export function PageIntro({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className={`${CONTAINER} flex flex-col items-start gap-7 pt-12 md:pt-16`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div>
        <h1 className="max-w-[48rem] text-balance text-display-l text-ink">{title}</h1>
        {children && <div className="mt-5 max-w-[40rem] text-pretty text-body-l text-ink-secondary">{children}</div>}
      </div>
    </header>
  );
}

/** Long-form text in the reading column. Headings open new sections with the same generous gaps as the landing. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className={`${CONTAINER} pb-section pt-12`}>
      <div className="max-w-reading space-y-4 text-body text-ink-secondary [&_a:hover]:underline [&_a]:font-medium [&_a]:text-accent-text [&_code]:rounded-xs [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_h2]:mt-14 [&_h2]:text-h1 [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:text-h3 [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ol>li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-panel [&_pre]:bg-surface-strong [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.8125rem] [&_pre]:text-ink [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}
