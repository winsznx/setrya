import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icons';
import type { Doc } from '@/lib/docs/content';
import { DOC_PAGES } from '@/lib/docs/manifest';

import { CopyButton } from './copy-button';
import { DocToc } from './doc-toc';

/** Long pages such as the FAQ and glossary list only their `##` sections. */
const MAX_TOC_ENTRIES = 24;
const SOURCE_BASE = 'https://github.com/winsznx/setrya/blob/main/apps/web/content/docs';

/** Styles for the HTML the markdown renderer produces. Bold text is how docs name a button or label on screen. */
const PROSE = [
  'text-body text-ink-secondary',
  '[&>*+*]:mt-4',
  '[&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:text-h1 [&_h2]:text-ink',
  '[&_h3]:mt-9 [&_h3]:scroll-mt-24 [&_h3]:text-h3 [&_h3]:text-ink',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_a]:font-medium [&_a]:text-accent-text [&_a]:underline-offset-2 hover:[&_a]:underline',
  '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:pl-1 [&_li>ul]:mt-2',
  '[&_code]:rounded-xs [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:text-ink',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-module [&_pre]:bg-surface-strong [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_.doc-table]:overflow-x-auto [&_.doc-table]:rounded-module [&_.doc-table]:border [&_.doc-table]:border-border',
  '[&_table]:w-full [&_table]:text-left [&_table]:text-body-s',
  '[&_th]:border-b [&_th]:border-border [&_th]:bg-surface-muted [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-semibold [&_th]:text-ink',
  '[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0',
  '[&_.doc-note]:rounded-module [&_.doc-note]:border [&_.doc-note]:border-accent-border [&_.doc-note]:bg-info-soft [&_.doc-note]:px-4 [&_.doc-note]:py-3 [&_.doc-note]:text-body-s',
  '[&_hr]:my-10 [&_hr]:border-border',
].join(' ');

export function DocArticle({ doc, beforeContent, afterContent }: { doc: Doc; beforeContent?: ReactNode; afterContent?: ReactNode }) {
  const index = DOC_PAGES.findIndex((page) => page.slug === doc.slug);
  const previous = index > 0 ? DOC_PAGES[index - 1] : undefined;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : undefined;
  const toc = doc.headings.length > MAX_TOC_ENTRIES ? doc.headings.filter((heading) => heading.depth === 2) : doc.headings;

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_13rem]">
      <article className="min-w-0 max-w-reading">
        <p className="text-body-s font-medium text-accent-text">{doc.section}</p>
        <h1 className="mt-2 text-balance text-display-l text-ink">{doc.title}</h1>
        <p className="mt-4 text-pretty text-body-l text-ink-secondary">{doc.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CopyButton value={doc.markdown} label="Copy page" />
          <a href={`/docs/${doc.slug}.md`} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-body-s font-medium text-ink-secondary transition-colors duration-fast hover:border-border-strong hover:text-ink">
            <Icon name="file" size={14} />View as Markdown
          </a>
          <a href={`${SOURCE_BASE}/${doc.slug}.md`} rel="noreferrer" target="_blank" className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-body-s font-medium text-ink-secondary transition-colors duration-fast hover:text-ink">
            Edit on GitHub<Icon name="external" size={14} />
          </a>
        </div>
        {toc.length > 0 && (
          <details className="group mt-6 rounded-module border border-border bg-surface px-4 py-3 xl:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between text-body-s font-medium text-ink [&::-webkit-details-marker]:hidden">
              On this page
              <Icon name="chevronDown" size={16} className="transition-transform duration-fast group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-2">
              {toc.map((heading) => (
                <li key={heading.id} className={heading.depth === 3 ? 'pl-4' : undefined}>
                  <a href={`#${heading.id}`} className="text-body-s text-ink-secondary hover:text-ink">{heading.text}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
        {beforeContent}
        <div className={`mt-10 ${PROSE}`} dangerouslySetInnerHTML={{ __html: doc.html }} />
        {afterContent}
        {(previous || next) && (
          <nav aria-label="More docs" className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
            {previous ? (
              <Link prefetch={false} href={previous.path} className="rounded-module border border-border p-4 transition-colors duration-fast hover:border-border-strong">
                <span className="flex items-center gap-1 text-label text-ink-muted"><Icon name="arrowLeft" size={12} />Previous</span>
                <strong className="mt-1 block text-body-s font-semibold text-ink">{previous.title}</strong>
              </Link>
            ) : <span />}
            {next && (
              <Link prefetch={false} href={next.path} className="rounded-module border border-border p-4 text-right transition-colors duration-fast hover:border-border-strong">
                <span className="flex items-center justify-end gap-1 text-label text-ink-muted">Next<Icon name="chevronRight" size={12} /></span>
                <strong className="mt-1 block text-body-s font-semibold text-ink">{next.title}</strong>
              </Link>
            )}
          </nav>
        )}
      </article>
      {toc.length > 0 && <DocToc headings={toc} />}
    </div>
  );
}
