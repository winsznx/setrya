import { describe, expect, it } from 'vitest';

import { decodeWire, encodeWire } from '../src/wire';

describe('wire codec', () => {
  it('round trips bigint, Date and Map values in nested structures', () => {
    const value = {
      zat: 460_000_000n,
      at: new Date('2026-10-28T12:00:00.000Z'),
      history: new Map([['p1', [{ amount: -5n, when: new Date(0) }]]]),
      plain: { n: 1, s: 'x', list: [1n, null] },
    };
    expect(decodeWire<typeof value>(encodeWire(value))).toEqual(value);
  });

  it('drops undefined object fields like JSON does', () => {
    expect(decodeWire(encodeWire({ a: 1, b: undefined }))).toEqual({ a: 1 });
  });

  it('leaves untagged objects alone', () => {
    expect(decodeWire('{"$other":"bigint","v":"1"}')).toEqual({ $other: 'bigint', v: '1' });
  });
});
