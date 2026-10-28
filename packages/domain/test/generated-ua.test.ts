import { describe, expect, it } from 'vitest';

import { assessAddress } from '../src/address';
import { makeUa } from '../../../tests/fixtures/make-test-ua.mjs';

describe('generated test addresses', () => {
  it('round trips a testnet UA with sapling and orchard receivers', () => {
    const a = assessAddress(makeUa('utest'), 'testnet');
    expect(a.ok).toBe(true);
    expect(a.receivers.map((r) => r.kind)).toEqual(['sapling', 'orchard']);
  });
  it('rejects a transparent-only UA', () => {
    expect(assessAddress(makeUa('utest', [[0, 20]]), 'testnet').problem).toBe('TRANSPARENT_ONLY');
  });
  it('flags a sapling-only UA as needing a cross-pool send', () => {
    expect(assessAddress(makeUa('utest', [[2, 43]]), 'testnet').problem).toBe('NO_POOL_RECEIVER');
  });
});

describe('ZIP 316 Revision 0 consumer rules', () => {
  it('rejects a UA carrying both transparent receiver types', () => {
    expect(assessAddress(makeUa('utest', [[0, 20], [1, 20], [3, 43]]), 'testnet').problem).toBe('INVALID');
  });
  it('rejects MUST-understand metadata on a Revision 0 UA', () => {
    expect(assessAddress(makeUa('utest', [[3, 43], [0xe0, 4]]), 'testnet').problem).toBe('INVALID');
  });
  it('rejects a receiver with the wrong length', () => {
    expect(assessAddress(makeUa('utest', [[3, 42]]), 'testnet').problem).toBe('INVALID');
  });
  it('rejects a UA whose only non-transparent item is unknown', () => {
    expect(assessAddress(makeUa('utest', [[0, 20], [5, 32]]), 'testnet').problem).toBe('INVALID');
  });
  it('accepts ignorable metadata alongside an Orchard receiver', () => {
    expect(assessAddress(makeUa('utest', [[3, 43], [0xc0, 8]]), 'testnet').ok).toBe(true);
  });
});
