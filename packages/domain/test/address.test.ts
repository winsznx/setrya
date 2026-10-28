import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { describe, expect, it } from 'vitest';

import { assessAddress, f4jumble, f4jumbleInverse } from '../src/address';
import vectors from './vectors/zip316.json';

describe('F4Jumble (ZIP 316 vectors)', () => {
  for (const [i, v] of vectors.f4jumble.entries()) {
    it(`vector ${i} jumbles and unjumbles`, () => {
      expect(bytesToHex(f4jumble(hexToBytes(v.normal)))).toBe(v.jumbled);
      expect(bytesToHex(f4jumbleInverse(hexToBytes(v.jumbled)))).toBe(v.normal);
    });
  }
});

describe('Unified Address parsing (ZIP 316 vectors)', () => {
  for (const [i, v] of vectors.ua.entries()) {
    it(`vector ${i} parses its receivers`, () => {
      const a = assessAddress(v.ua, 'mainnet', 'orchard');
      expect(a.encoding).toBe('unified');
      expect(a.network).toBe('mainnet');
      const kinds = a.receivers.map((r) => r.kind);
      expect(kinds.includes('orchard')).toBe(v.orchard);
      expect(kinds.includes('sapling')).toBe(v.sapling);
      expect(a.ok).toBe(v.orchard);
      if (!v.orchard) expect(a.problem).toBe('NO_POOL_RECEIVER');
    });
  }

  it('rejects a corrupted address', () => {
    const ua = vectors.ua[0]!.ua;
    const broken = `${ua.slice(0, -3)}${ua.slice(-3) === 'qqq' ? 'ppp' : 'qqq'}`;
    expect(assessAddress(broken, 'mainnet').problem).toBe('INVALID');
  });

  it('rejects a mainnet address on testnet (P19)', () => {
    const v = vectors.ua.find((x) => x.orchard)!;
    expect(assessAddress(v.ua, 'testnet').problem).toBe('WRONG_NETWORK');
  });

  it('rejects transparent and TEX addresses', () => {
    expect(assessAddress('t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU', 'mainnet').problem).toBe('TRANSPARENT_ONLY');
    expect(assessAddress('tex1s2rt77ggv6q989lr49rkgzmh5slsksa9khdgte', 'mainnet').problem).toBe('TEX_ONLY');
  });
});
