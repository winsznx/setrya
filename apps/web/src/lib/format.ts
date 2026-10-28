export function formatDate(d: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export function formatDateTime(d: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(d));
}

/** Inclusive calendar end for a half-open [start, end) range, for display. */
export function formatRange(start: Date | string, end: Date | string, timeZone: string): string {
  const last = new Date(new Date(end).getTime() - 1);
  return `${formatDate(start, timeZone)} – ${formatDate(last, timeZone)}`;
}

export function isoDay(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function age(d: Date | string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function shortHash(h: string | null | undefined, n = 10): string {
  if (!h) return '—';
  return h.length <= n * 2 ? h : `${h.slice(0, n)}…${h.slice(-4)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
