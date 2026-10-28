import { docAsMarkdown, type Doc } from './content';
import { DOC_SECTIONS, SITE_URL } from './manifest';

export const PRODUCT_SUMMARY =
  'Setrya is self-hosted revenue-share settlement on Zcash. You import the fees you earned, apply versioned partner agreements, freeze and approve a hashed snapshot, and pay every partner in one fully shielded ZEC transaction that your own settlement host builds, inspects against the approval and signs. Each partner gets a statement of their own.';

export function markdownUrl(slug: string): string {
  return `${SITE_URL}/docs/${slug}.md`;
}

/** The llms.txt index described at https://llmstxt.org: a summary, then one linked list per docs section. */
export function buildLlmsTxt(docs: readonly Doc[]): string {
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  const sections = DOC_SECTIONS.map((section) => {
    const lines = section.pages.flatMap((page) => {
      const doc = bySlug.get(page.slug);
      return doc ? [`- [${doc.title}](${markdownUrl(doc.slug)}): ${doc.description}`] : [];
    });
    return `## ${section.title}\n\n${lines.join('\n')}`;
  });
  return (
    [
      '# Setrya',
      `> ${PRODUCT_SUMMARY}`,
      `Every page below is plain Markdown. The same docs are on the web at ${SITE_URL}/docs and all in one file at ${SITE_URL}/llms-full.txt.`,
      ...sections,
      `## Optional\n\n- [All docs in one file](${SITE_URL}/llms-full.txt): every page above, concatenated\n- [Source code](https://github.com/winsznx/setrya): the web app, API, signer and packages`,
    ].join('\n\n') + '\n'
  );
}

export function buildLlmsFullTxt(docs: readonly Doc[]): string {
  return [`# Setrya documentation\n\n> ${PRODUCT_SUMMARY}\n`, ...docs.map(docAsMarkdown)].join('\n---\n\n');
}
