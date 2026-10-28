import Link from 'next/link';
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Hidden in the stacked phone card. */
  hideOnCard?: boolean;
  className?: string;
}

/**
 * A real table from 768 px and stacked cards below it. Rows link with a real anchor in the first cell so keyboard
 * and screen reader users get the same destination as a click on the row.
 */
export function DataTable<T>({ rows, columns, rowKey, rowHref, caption, empty, cardTitle }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; rowHref?: (row: T) => string; caption: string; empty?: ReactNode; cardTitle?: (row: T) => ReactNode }) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-body-s">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('whitespace-nowrap px-4 py-2.5 text-label font-medium text-ink-secondary first:pl-5 last:pr-5', c.align === 'right' ? 'text-right' : 'text-left', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cx('border-b border-border last:border-0', rowHref && 'relative transition-colors duration-fast hover:bg-surface-muted')}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cx('px-4 py-3 align-top first:pl-5 last:pr-5', c.align === 'right' ? 'text-right tnum' : 'text-left', c.className)}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(row)} prefetch={false} className="font-medium text-ink after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-focus">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const inner = (
            <div className="space-y-2 px-4 py-3.5">
              <div className="text-body font-medium text-ink">{cardTitle ? cardTitle(row) : columns[0]!.cell(row)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {columns.slice(1).filter((c) => !c.hideOnCard).map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-micro text-ink-muted">{c.header}</dt>
                    <dd className={cx('min-w-0 break-words text-body-s', c.align === 'right' && 'tnum')}>{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
          return <li key={rowKey(row)}>{rowHref ? <Link prefetch={false} href={rowHref(row)} className="block hover:bg-surface-muted">{inner}</Link> : inner}</li>;
        })}
      </ul>
    </>
  );
}
