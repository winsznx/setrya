import { formatGrouped, formatZec, parseDec } from '@setrya/domain';

import { ZecMark } from '@/components/brand/zec-mark';

import { cx } from './cx';

/** A source-currency amount from its exact decimal string. Never formats through a JS number. */
export function Money({ value, currency, className, signed }: { value: string; currency: string; className?: string; signed?: boolean }) {
  if (currency === 'ZEC') return <Zec zat={null} decimal={value} className={className} />;
  const d = parseDec(value, 36);
  const text = formatGrouped(d, 2, 8);
  return (
    <span className={cx('tnum whitespace-nowrap', className)}>
      {signed && d.units > 0n ? '+' : ''}
      {text} <span className="text-ink-muted">{currency}</span>
    </span>
  );
}

export function Zec({ zat, decimal, className, trim = true }: { zat: bigint | string | null; decimal?: string; className?: string; trim?: boolean }) {
  let text: string;
  if (zat !== null) text = formatZec(typeof zat === 'string' ? BigInt(zat) : zat, { trim });
  else text = formatGrouped(parseDec(decimal ?? '0', 36), 2, 8);
  return (
    <span className={cx('tnum inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <ZecMark size={13} />
      {text} <span className="text-ink-muted">ZEC</span>
    </span>
  );
}

/** Totals grouped by currency. Different currencies are listed, never added. */
export function MoneyGroups({ groups, empty = '—' }: { groups: Record<string, string> | null | undefined; empty?: string }) {
  const entries = Object.entries(groups ?? {});
  if (entries.length === 0) return <span className="text-ink-muted">{empty}</span>;
  return (
    <span className="flex flex-col">
      {entries.map(([c, v]) => (
        <Money key={c} value={v} currency={c} />
      ))}
    </span>
  );
}
