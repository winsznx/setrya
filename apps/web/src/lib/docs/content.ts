import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { DOC_PAGES, SITE_URL, type IndexedDocPage } from './manifest';
import { parseDoc, type ParsedDoc } from './markdown';

export interface Doc extends IndexedDocPage, ParsedDoc {
  markdown: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs');
const PLACEHOLDER = 'This page is being written.';
/** Parsed pages keyed by slug, reparsed only when the file changes, so edits show up in `next dev` too. */
const cache = new Map<string, { modified: number; doc: Doc }>();

export function docFilePath(slug: string): string {
  return path.join(CONTENT_DIR, `${slug}.md`);
}

/** Unknown slugs return undefined. A manifest page without its markdown file throws in production, so a gap can't ship. */
export function getDoc(slug: string): Doc | undefined {
  const page = DOC_PAGES.find((entry) => entry.slug === slug);
  return page ? loadDoc(page) : undefined;
}

export function getAllDocs(): Doc[] {
  return DOC_PAGES.map(loadDoc);
}

function loadDoc(page: IndexedDocPage): Doc {
  const file = docFilePath(page.slug);
  if (!existsSync(file)) {
    if (process.env.NODE_ENV === 'production') throw new Error(`Docs page "${page.slug}" is in the manifest but ${file} does not exist.`);
    return { ...page, ...parseDoc(PLACEHOLDER, page.title), markdown: PLACEHOLDER };
  }
  const modified = statSync(file).mtimeMs;
  const cached = cache.get(page.slug);
  if (cached?.modified === modified) return cached.doc;
  const markdown = readFileSync(file, 'utf8');
  const doc = { ...page, ...parseDoc(markdown, page.title), markdown };
  cache.set(page.slug, { modified, doc });
  return doc;
}

/** One page as served to language models: title, summary and canonical URL first, with links that work off-site. */
export function docAsMarkdown(doc: Doc): string {
  return `# ${doc.title}\n\n> ${doc.description}\n\nSource: ${doc.url}\n\n${absoluteDocLinks(doc.markdown.trim())}\n`;
}

export function absoluteDocLinks(markdown: string): string {
  return markdown.replace(/\]\(\/docs/g, `](${SITE_URL}/docs`);
}
