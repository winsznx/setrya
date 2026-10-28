import { describe, expect, it } from 'vitest';

import { parseDoc } from './markdown';
import { findDocTarget, searchDocs, type FetchableDoc } from './search';

function doc(slug: string, title: string, markdown: string): FetchableDoc {
  const { chunks, sections } = parseDoc(markdown, title);
  return { slug, title, url: `https://setrya.xyz/docs/${slug}`, chunks, sections };
}

const DOCS = [
  doc('introduction', 'What is Setrya', 'Setrya is revenue-share settlement on Zcash.\n\n## Who it is for\n\nBusinesses that pay partners a share of fees.'),
  doc('statements', 'Statements and sharing', 'One statement per partner.\n\n## Share a statement\n\nShared links are encrypted for one partner. Sharing never reveals other partners.\n\n## Revoke a link\n\nRevoking stops the link working.'),
  doc('fees-and-limits', 'Fees and limits', 'What each payment costs.\n\n## Minimum payout\n\nA minimum payout holds tiny amounts until they grow.'),
];

describe('searchDocs', () => {
  it('ranks the section that matches the query best', () => {
    const [top] = searchDocs(DOCS, 'how do I share a statement');
    expect(top?.id).toBe('statements#share-a-statement');
    expect(top?.title).toBe('Statements and sharing: Share a statement');
    expect(top?.url).toBe('https://setrya.xyz/docs/statements#share-a-statement');
    expect(top?.snippet).toMatch(/encrypted for one partner/);
  });

  it('matches longer forms and light plurals of a term', () => {
    expect(searchDocs(DOCS, 'payouts')[0]?.id).toBe('fees-and-limits#minimum-payout');
  });

  it('uses the page id for text before the first section', () => {
    expect(searchDocs(DOCS, 'revenue-share settlement')[0]?.id).toBe('introduction');
  });

  it('returns nothing for empty or unmatched queries', () => {
    expect(searchDocs(DOCS, '   ')).toEqual([]);
    expect(searchDocs(DOCS, 'zzzz')).toEqual([]);
  });

  it('returns at most two results per page and respects the limit', () => {
    const results = searchDocs(DOCS, 'partner statement link', 10);
    const perPage = new Map<string, number>();
    for (const r of results) {
      const page = r.id.split('#')[0] ?? '';
      perPage.set(page, (perPage.get(page) ?? 0) + 1);
    }
    expect([...perPage.values()].every((count) => count <= 2)).toBe(true);
    expect(searchDocs(DOCS, 'partner', 1)).toHaveLength(1);
  });
});

describe('findDocTarget', () => {
  it('resolves ids, docs paths and full URLs', () => {
    expect(findDocTarget(DOCS, 'statements')?.doc.slug).toBe('statements');
    expect(findDocTarget(DOCS, 'statements#revoke-a-link')?.section?.heading).toBe('Revoke a link');
    expect(findDocTarget(DOCS, '/docs/fees-and-limits#minimum-payout')?.section?.id).toBe('minimum-payout');
    expect(findDocTarget(DOCS, 'https://setrya.xyz/docs/statements.md')?.doc.slug).toBe('statements');
    expect(findDocTarget(DOCS, 'https://setrya.xyz/docs')?.doc.slug).toBe('introduction');
  });

  it('returns undefined for unknown pages and sections', () => {
    expect(findDocTarget(DOCS, 'nope')).toBeUndefined();
    expect(findDocTarget(DOCS, 'statements#nope')).toBeUndefined();
  });
});
