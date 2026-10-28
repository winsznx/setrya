/**
 * Structured logging with redaction. Keys that may hold addresses, amounts, secrets or partner data are replaced
 * before anything reaches stdout.
 */

const SENSITIVE_KEY = /pass|secret|token|cookie|seed|mnemonic|key|address|hex|pczt|memo|amount|zat|name|email|contact|note|raw|csv|authorization/i;
const UA_LIKE = /\b(u|utest|uregtest|zs|ztestsapling)1[02-9ac-hj-np-z]{20,}\b/gi;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (typeof value === 'string') return value.replace(UA_LIKE, '[address]');
  if (typeof value === 'bigint') return '[bigint]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message, depth + 1) };
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return value;
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const threshold = (process.env.SETRYA_LOG_LEVEL as Level | undefined) ?? 'info';
  if (ORDER[level] < (ORDER[threshold] ?? 20)) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(redact(fields) as Record<string, unknown>) });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}
