import { describe, expect, it } from 'vitest';

import { parseDoc, slugifyHeading } from './markdown';

describe('slugifyHeading', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugifyHeading('Who can see what')).toBe('who-can-see-what');
    expect(slugifyHeading('What’s live today?')).toBe('what-s-live-today');
    expect(slugifyHeading('Fees & limits')).toBe('fees-limits');
    expect(slugifyHeading('  `SETRYA_EDGE_KEY` is required ')).toBe('setrya-edge-key-is-required');
  });
});

describe('parseDoc', () => {
  const markdown = [
    'Setrya settles revenue shares.',
    '',
    '## Fees',
    '',
    'Every payment pays the ZIP 317 fee. See [limits](/docs/fees-and-limits) and [ZIP 317](https://zips.z.cash/zip-0317).',
    '',
    '### Network fees',
    '',
    '| Actions | Fee |',
    '| --- | --- |',
    '| 3 | 15,000 zatoshis |',
    '',
    '> Note: the operator pays the fee.',
    '',
    '## Fees',
    '',
    '<script>alert(1)</script>',
    '',
    '```sh',
    'docker compose up -d',
    '```',
  ].join('\n');
  const doc = parseDoc(markdown, 'Fees and limits');

  it('gives every heading a stable id and suffixes repeats', () => {
    expect(doc.headings.map((h) => [h.id, h.depth])).toEqual([
      ['fees', 2],
      ['network-fees', 3],
      ['fees-1', 2],
    ]);
    expect(doc.html).toMatch(/<h2 id="fees">Fees<\/h2>/);
    expect(doc.html).toMatch(/<h2 id="fees-1">Fees<\/h2>/);
  });

  it('opens external links in a new tab and keeps internal links in place', () => {
    expect(doc.html).toMatch(/<a href="https:\/\/zips\.z\.cash\/zip-0317" target="_blank" rel="noopener noreferrer">ZIP 317<\/a>/);
    expect(doc.html).toMatch(/<a href="\/docs\/fees-and-limits">limits<\/a>/);
  });

  it('wraps tables, renders notes, and escapes raw HTML', () => {
    expect(doc.html).toMatch(/<div class="doc-table"><table>/);
    expect(doc.html).toMatch(/<aside class="doc-note">/);
    expect(doc.html).not.toMatch(/<script>/);
    expect(doc.html).toMatch(/&lt;script&gt;/);
  });

  it('splits the page into an intro chunk and one chunk per ## or ### heading for search', () => {
    expect(doc.chunks.map((c) => [c.id, c.heading])).toEqual([
      ['', 'Fees and limits'],
      ['fees', 'Fees'],
      ['network-fees', 'Network fees'],
      ['fees-1', 'Fees'],
    ]);
    const [, fees, networkFees] = doc.chunks;
    expect(fees?.text).toMatch(/Every payment pays the ZIP 317 fee/);
    expect(fees?.text).not.toMatch(/\]\(/);
    expect(networkFees?.text).toMatch(/3 \| 15,000 zatoshis/);
  });

  it('keeps each section whole, subsections included', () => {
    const fees = doc.sections.find((s) => s.id === 'fees');
    expect(fees?.depth).toBe(2);
    expect(fees?.markdown).toMatch(/### Network fees/);
    expect(fees?.markdown).toMatch(/the operator pays the fee/);
    expect(fees?.markdown).not.toMatch(/docker compose/);
  });

  it('keeps code in the plain text so commands are searchable', () => {
    expect(doc.text).toMatch(/docker compose up -d/);
  });
});
