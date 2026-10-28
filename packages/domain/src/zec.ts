import { type Dec, dec, formatGrouped, MoneyError, parseDec } from './money';

/** 1 ZEC = 100,000,000 zatoshis. Zatoshis are always bigint in memory and decimal strings at boundaries. */
export const ZAT_PER_ZEC = 100_000_000n;
export const MAX_MONEY_ZAT = 21_000_000n * ZAT_PER_ZEC;

export function zecToZat(zec: string): bigint {
  const value = parseDec(zec, 8);
  const zat = value.units * 10n ** BigInt(8 - value.scale);
  assertZatRange(zat);
  return zat;
}

export function zatToDec(zat: bigint): Dec {
  return dec(zat, 8);
}

/** The exact eight-decimal string Zallet expects for an amount. */
export function zatToZecString(zat: bigint): string {
  assertZatRange(zat < 0n ? -zat : zat);
  const negative = zat < 0n;
  const abs = negative ? -zat : zat;
  const whole = abs / ZAT_PER_ZEC;
  const fraction = (abs % ZAT_PER_ZEC).toString().padStart(8, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function formatZec(zat: bigint, options: { trim?: boolean } = {}): string {
  const text = formatGrouped(zatToDec(zat), 8);
  if (!options.trim) return text;
  return text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.00');
}

export function parseZat(value: string): bigint {
  if (!/^-?\d{1,20}$/.test(value)) throw new MoneyError('INVALID_DECIMAL', `"${value}" is not a zatoshi amount`);
  const zat = BigInt(value);
  assertZatRange(zat < 0n ? -zat : zat);
  return zat;
}

function assertZatRange(zat: bigint): void {
  if (zat > MAX_MONEY_ZAT) throw new MoneyError('OUT_OF_RANGE', 'Amount exceeds the ZEC money supply');
}
