import { type Dec, dec, floorTo, MoneyError, parseDec, sub } from './money';
import { ZAT_PER_ZEC } from './zec';

/**
 * A rate snapshot is an exact rational: 1 unit of `base` equals numerator/denominator units of `quote`.
 * Setrya only converts with snapshots whose quote is ZEC and whose base is the source currency.
 */
export interface RateSnapshot {
  id: string;
  base: string;
  quote: string;
  numerator: bigint;
  denominator: bigint;
  source: string;
  quotedAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
}

export type RateProblem = 'RATE_REQUIRED' | 'RATE_EXPIRED' | 'RATE_UNAPPROVED' | 'RATE_ORIENTATION';

/** Builds numerator/denominator from a decimal the operator typed, e.g. "1 USD = 0.02215 ZEC". */
export function rationalFromDecimal(text: string): { numerator: bigint; denominator: bigint } {
  const value = parseDec(text, 18);
  if (value.units <= 0n) throw new MoneyError('OUT_OF_RANGE', 'A rate must be greater than zero');
  return { numerator: value.units, denominator: 10n ** BigInt(value.scale) };
}

/**
 * The operator entered a ZEC price ("1 ZEC = 45.12 USD"). Inversion is an explicit, recorded step: the resulting
 * snapshot is stored as USD→ZEC so conversion never guesses an orientation.
 */
export function invertRational(r: { numerator: bigint; denominator: bigint }): { numerator: bigint; denominator: bigint } {
  if (r.numerator === 0n) throw new MoneyError('OUT_OF_RANGE', 'Cannot invert a zero rate');
  return { numerator: r.denominator, denominator: r.numerator };
}

export function checkRate(snapshot: RateSnapshot | undefined, currency: string, at: Date): RateProblem | null {
  if (snapshot === undefined) return 'RATE_REQUIRED';
  if (snapshot.base !== currency || snapshot.quote !== 'ZEC') return 'RATE_ORIENTATION';
  if (snapshot.approvedAt === null) return 'RATE_UNAPPROVED';
  if (snapshot.expiresAt.getTime() <= at.getTime()) return 'RATE_EXPIRED';
  return null;
}

export interface Conversion {
  zat: bigint;
  /** Exact zatoshi fraction dropped by the round-down rule, as a decimal with up to 18 places. */
  residualZat: Dec;
}

/** Converts an exact source amount to zatoshis, rounding down so Setrya never sends more than approved. */
export function convertToZat(amount: Dec, snapshot: Pick<RateSnapshot, 'base' | 'quote' | 'numerator' | 'denominator'>, currency: string): Conversion {
  if (snapshot.base !== currency || snapshot.quote !== 'ZEC') {
    throw new MoneyError('CURRENCY_MISMATCH', `Rate ${snapshot.base}/${snapshot.quote} cannot convert ${currency} to ZEC`);
  }
  const scaledNumerator = amount.units * snapshot.numerator * ZAT_PER_ZEC;
  const scaledDenominator = 10n ** BigInt(amount.scale) * snapshot.denominator;
  let zat = scaledNumerator / scaledDenominator;
  if (scaledNumerator < 0n && scaledNumerator % scaledDenominator !== 0n) zat -= 1n;
  const residualExact = sub(dec(scaledNumerator * 10n ** 18n / scaledDenominator, 18), dec(zat, 0));
  return { zat, residualZat: floorTo(residualExact, 18).value };
}

export function describeRate(snapshot: Pick<RateSnapshot, 'base' | 'quote' | 'numerator' | 'denominator'>): string {
  const scaled = (snapshot.numerator * 10n ** 12n) / snapshot.denominator;
  const text = dec(scaled, 12);
  const { value } = floorTo(text, 12);
  const s = value.units.toString().padStart(13, '0');
  const printed = `${s.slice(0, -12)}.${s.slice(-12)}`.replace(/0+$/, '').replace(/\.$/, '');
  return `1 ${snapshot.base} = ${printed} ${snapshot.quote}`;
}
