/**
 * Exact decimal arithmetic on bigint. A Dec is `units / 10^scale`. JavaScript numbers never hold money here.
 */

export interface Dec {
  readonly units: bigint;
  readonly scale: number;
}

export const MAX_SOURCE_SCALE = 8;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class MoneyError extends Error {
  constructor(
    readonly code: 'INVALID_DECIMAL' | 'TOO_PRECISE' | 'OUT_OF_RANGE' | 'CURRENCY_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function dec(units: bigint, scale: number): Dec {
  if (!Number.isInteger(scale) || scale < 0 || scale > 36) throw new MoneyError('OUT_OF_RANGE', `Invalid scale ${scale}`);
  return { units, scale };
}

export const ZERO: Dec = dec(0n, 0);

/**
 * Parses a canonical decimal string. Thousands separators and currency symbols are the importer's job to strip,
 * because guessing them here would silently change meaning.
 */
export function parseDec(input: string, maxScale = MAX_SOURCE_SCALE): Dec {
  const text = input.trim();
  if (!DECIMAL_PATTERN.test(text) && !/^-?\.\d+$/.test(text)) {
    throw new MoneyError('INVALID_DECIMAL', `"${input}" is not a decimal number`);
  }
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = body.split('.');
  if (fraction.length > maxScale) {
    throw new MoneyError('TOO_PRECISE', `"${input}" has more than ${maxScale} decimal places`);
  }
  const digits = `${whole === '' ? '0' : whole}${fraction}`;
  if (digits.length > 40) throw new MoneyError('OUT_OF_RANGE', `"${input}" is out of range`);
  const units = BigInt(digits);
  return dec(negative ? -units : units, fraction.length);
}

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

export function rescale(value: Dec, scale: number): Dec {
  if (scale < value.scale) throw new MoneyError('OUT_OF_RANGE', 'rescale would drop precision');
  return dec(value.units * pow10(scale - value.scale), scale);
}

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [rescale(a, scale).units, rescale(b, scale).units, scale];
}

export function add(a: Dec, b: Dec): Dec {
  const [x, y, scale] = align(a, b);
  return normalize(dec(x + y, scale));
}

export function sub(a: Dec, b: Dec): Dec {
  const [x, y, scale] = align(a, b);
  return normalize(dec(x - y, scale));
}

export function mul(a: Dec, b: Dec): Dec {
  return normalize(dec(a.units * b.units, a.scale + b.scale));
}

export function neg(a: Dec): Dec {
  return dec(-a.units, a.scale);
}

export function cmp(a: Dec, b: Dec): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function min(a: Dec, b: Dec): Dec {
  return cmp(a, b) <= 0 ? a : b;
}

export function isZero(a: Dec): boolean {
  return a.units === 0n;
}

export function isNegative(a: Dec): boolean {
  return a.units < 0n;
}

export function sum(values: readonly Dec[]): Dec {
  return values.reduce(add, ZERO);
}

/** Drops trailing zero digits so equal values compare and print the same. */
export function normalize(value: Dec): Dec {
  let { units, scale } = value;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return dec(units, scale);
}

/** Divides by 10^n exactly (moving the decimal point), used for percentages. */
export function shift(value: Dec, places: number): Dec {
  return normalize(dec(value.units, value.scale + places));
}

/** Prints with at least `minScale` decimals, never fewer digits than the value holds. */
export function formatDec(value: Dec, minScale = 0): string {
  const scale = Math.max(value.scale, minScale);
  const units = rescale(value, scale).units;
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${whole}${scale > 0 ? `.${fraction}` : ''}`;
}

/** Truncates toward negative infinity to `scale` places and reports the exact dropped remainder. */
export function floorTo(value: Dec, scale: number): { value: Dec; remainder: Dec } {
  if (value.scale <= scale) return { value: rescale(value, scale), remainder: ZERO };
  const divisor = pow10(value.scale - scale);
  let q = value.units / divisor;
  if (value.units < 0n && value.units % divisor !== 0n) q -= 1n;
  const floored = dec(q, scale);
  return { value: floored, remainder: sub(value, floored) };
}

export function decToString(value: Dec): string {
  return formatDec(normalize(value));
}

/** Groups thousands for display only. */
export function formatGrouped(value: Dec, minScale = 2, maxScale?: number): string {
  let v = value;
  if (maxScale !== undefined && v.scale > maxScale) v = floorTo(v, maxScale).value;
  const text = formatDec(v, minScale);
  const negative = text.startsWith('-');
  const [whole = '0', fraction] = (negative ? text.slice(1) : text).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}
