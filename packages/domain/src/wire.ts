/**
 * JSON with the types the server's view models actually use: bigint (zatoshis, exact decimals), Date and Map.
 * Values are tagged so a decoded object has the same shape the server built, and plain JSON stays plain.
 */

const TAG = '$setrya';

type Tagged = { [TAG]: 'bigint'; v: string } | { [TAG]: 'date'; v: string } | { [TAG]: 'map'; v: [unknown, unknown][] };

function tag(value: unknown): unknown {
  if (typeof value === 'bigint') return { [TAG]: 'bigint', v: value.toString() } satisfies Tagged;
  if (value instanceof Date) return { [TAG]: 'date', v: value.toISOString() } satisfies Tagged;
  if (value instanceof Map) return { [TAG]: 'map', v: [...value.entries()].map(([k, v]) => [tag(k), tag(v)]) };
  if (Array.isArray(value)) return value.map(tag);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = tag(v);
    return out;
  }
  return value;
}

function untag(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(untag);
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  switch (record[TAG]) {
    case 'bigint':
      return BigInt(record.v as string);
    case 'date':
      return new Date(record.v as string);
    case 'map':
      return new Map((record.v as [unknown, unknown][]).map(([k, v]) => [untag(k), untag(v)]));
    default: {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(record)) out[k] = untag(v);
      return out;
    }
  }
}

export function encodeWire(value: unknown): string {
  return JSON.stringify(tag(value));
}

export function decodeWire<T>(text: string): T {
  return untag(JSON.parse(text)) as T;
}
