import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { docFilePath, getAllDocs } from './content';
import { DOC_PAGES, docPath } from './manifest';

/** These run against the real pages in content/docs, so a broken link or banned character fails CI instead of shipping. */
const written = DOC_PAGES.filter((page) => existsSync(docFilePath(page.slug)));
const missing = DOC_PAGES.filter((page) => !written.includes(page)).map((page) => page.slug);

describe('docs content', () => {
  it.skipIf(missing.length > 0 && !process.env.CI)('has a markdown file for every page in the manifest (always enforced in CI)', () => {
    expect(missing).toEqual([]);
  });

  it('leaves the page title to the manifest', () => {
    expect(written.filter((page) => /^#\s/m.test(readFileSync(docFilePath(page.slug), 'utf8'))).map((page) => page.slug)).toEqual([]);
  });

  it('uses no em or en dashes', () => {
    expect(written.filter((page) => /[—–]/.test(readFileSync(docFilePath(page.slug), 'utf8'))).map((page) => page.slug)).toEqual([]);
  });

  it('links only to docs pages and headings that exist, checked across the pages written so far', () => {
    const docs = getAllDocs().filter((doc) => written.some((page) => page.slug === doc.slug));
    const anchors = new Map(getAllDocs().map((doc) => [doc.path, new Set(doc.headings.map((h) => h.id).concat(allIds(doc.html)))]));
    const writtenPaths = new Set(written.map((page) => docPath(page.slug)));
    const broken = docs.flatMap((doc) =>
      [...doc.html.matchAll(/href="(\/docs[^"#]*)(?:#([^"]*))?"/g)].flatMap(([, path = '', anchor]) => {
        const target = path.replace(/\/$/, '') || '/docs';
        const ids = anchors.get(target);
        if (!ids) return [`${doc.slug}: ${path}`];
        if (anchor && writtenPaths.has(target) && !ids.has(anchor)) return [`${doc.slug}: ${path}#${anchor}`];
        return [];
      }),
    );
    expect(broken).toEqual([]);
  });

  it('serves the introduction at /docs', () => {
    expect(docPath('introduction')).toBe('/docs');
  });
});

function allIds(html: string): string[] {
  return [...html.matchAll(/ id="([^"]+)"/g)].map(([, id = '']) => id);
}
