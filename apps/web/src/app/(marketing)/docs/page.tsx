import type { Metadata } from 'next';
import Link from 'next/link';

import { DocArticle } from '@/components/docs/doc-article';
import { getDoc } from '@/lib/docs/content';
import { DOC_SECTIONS, INTRODUCTION_SLUG, docPath } from '@/lib/docs/manifest';

export const metadata: Metadata = {
  title: { absolute: 'Setrya docs' },
  alternates: { types: { 'text/markdown': `/docs/${INTRODUCTION_SLUG}.md` } },
};

const START_HERE = [
  { slug: 'getting-started', title: 'Deploy Setrya', blurb: 'Settlement host, web app, owner and wallet.' },
  { slug: 'import-revenue', title: 'Import a fee export', blurb: 'Map columns and classify every row.' },
  { slug: 'approve-and-pay', title: 'Approve and pay', blurb: 'From a frozen snapshot to confirmations.' },
  { slug: 'privacy', title: 'Who sees what', blurb: 'Exactly what each party can read.' },
];

export default function DocsHome() {
  const doc = getDoc(INTRODUCTION_SLUG);
  if (!doc) throw new Error('The introduction page is missing from the docs manifest.');
  return (
    <DocArticle
      doc={doc}
      beforeContent={
        <nav aria-label="Start here" className="mt-8 grid gap-3 sm:grid-cols-2">
          {START_HERE.map((item) => (
            <Link prefetch={false} key={item.slug} href={docPath(item.slug)} className="rounded-module bg-panel-soft p-4 transition-shadow duration-fast hover:shadow-raised">
              <strong className="block text-body-s font-semibold text-ink">{item.title}</strong>
              <span className="mt-1 block text-body-s text-ink-secondary">{item.blurb}</span>
            </Link>
          ))}
        </nav>
      }
      afterContent={
        <section aria-labelledby="all-docs" className="mt-16 border-t border-border pt-10">
          <h2 id="all-docs" className="text-h1 text-ink">All docs</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            {DOC_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-h3 text-ink">{section.title}</h3>
                <ul className="mt-3 space-y-3">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link prefetch={false} href={docPath(page.slug)} className="text-body-s font-medium text-accent-text hover:underline">{page.title}</Link>
                      <p className="text-body-s text-ink-secondary">{page.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      }
    />
  );
}
