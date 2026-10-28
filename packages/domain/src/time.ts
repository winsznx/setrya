/** UTC instants internally; IANA zones only to interpret operator-entered wall times and to display. */

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function zoneOffsetMs(zone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time in `zone` to the UTC instant, resolving DST gaps forward. */
export function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, zone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - zoneOffsetMs(zone, new Date(guess));
  const second_ = guess - zoneOffsetMs(zone, new Date(first));
  return new Date(second_);
}

/** Midnight at the start of a calendar date in `zone`, as a UTC instant. Used for `[start, end)` period bounds. */
export function startOfDayInZone(isoDate: string, zone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid date ${isoDate}`);
  return zonedWallTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0, zone);
}

export type DateFormat = 'iso' | 'mdy' | 'dmy';

/** Parses an imported date cell. Values with an explicit offset or Z keep it; bare wall times use `zone`. */
export function parseImportedDate(text: string, zone: string, format: DateFormat = 'iso'): Date | null {
  const value = text.trim();
  if (value === '') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
  let y: number, mo: number, d: number, h = 0, mi = 0, s = 0;
  let offset: string | undefined;
  if (iso) {
    [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    h = Number(iso[4] ?? 0);
    mi = Number(iso[5] ?? 0);
    s = Number(iso[6] ?? 0);
    offset = iso[7];
  } else {
    const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (!slash || format === 'iso') return null;
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    [mo, d] = format === 'mdy' ? [a, b] : [b, a];
    y = Number(slash[3]);
    h = Number(slash[4] ?? 0);
    mi = Number(slash[5] ?? 0);
    s = Number(slash[6] ?? 0);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  if (offset !== undefined) {
    if (offset.toUpperCase() === 'Z') return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
    const om = /^([+-])(\d{2}):?(\d{2})$/.exec(offset)!;
    const sign = om[1] === '-' ? -1 : 1;
    const minutes = sign * (Number(om[2]) * 60 + Number(om[3]));
    return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - minutes * 60_000);
  }
  return zonedWallTimeToUtc(y, mo, d, h, mi, s, zone);
}

export function inHalfOpen(instant: Date, start: Date, end: Date): boolean {
  const t = instant.getTime();
  return t >= start.getTime() && t < end.getTime();
}
