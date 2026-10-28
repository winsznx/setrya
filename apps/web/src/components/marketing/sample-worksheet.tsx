import { formatGrouped, formatZec, parseDec } from '@setrya/domain';

import { Badge } from '@/components/ui/badge';

import { SAMPLE_PARTNERS, SAMPLE_ROWS, sampleCalculation } from './sample';

const money = (v: string) => formatGrouped(parseDec(v, 36), 2, 8);

/** The landing hero: a real engine run over sample rows, labelled as illustrative. */
export function SampleWorksheet() {
  const r = sampleCalculation();
  return (
    <figure className="relative rounded-workspace border border-border bg-surface p-4 shadow-floating sm:p-5" aria-label="Sample settlement worksheet">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-body-s font-semibold">October creator fees</span>
        <Badge tone="sample" icon="info">Illustrative data — not a real payment</Badge>
      </div>
      <table className="w-full text-body-s">
        <caption className="sr-only">Source rows</caption>
        <tbody>
          {SAMPLE_ROWS.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-2"><div className={row.inclusion === 'excluded' ? 'text-ink-muted line-through decoration-ink-muted/60' : ''}>{row.label}</div><div className="text-label text-ink-muted">{row.ref}{row.note ? ` · ${row.note}` : ''}</div></td>
              <td className="py-2 text-right tnum">{money(row.amount)} <span className="text-ink-muted">USD</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-between rounded-row bg-surface-muted px-3 py-2 text-body-s"><span>Eligible fee base</span><span className="font-semibold tnum">{money(r.totals.eligibleByCurrency.USD ?? '0')} USD</span></div>
      <ul className="mt-3 divide-y divide-border">
        {r.rows.map((row) => {
          const p = SAMPLE_PARTNERS.find((x) => x.id === row.partnerId)!;
          return (
            <li key={row.key} className="flex items-center justify-between gap-2 py-2 text-body-s">
              <span><span className="font-medium">{p.name}</span> <span className="text-ink-muted">{p.ratePct}%</span></span>
              <span className="flex items-center gap-2 tnum">
                {money(row.formula.owed)} USD
                {row.status === 'payable' ? <Badge tone="accent" icon={null}>{formatZec(row.zat!, { trim: true })} ZEC</Badge> : <Badge tone="warning">Held: no address</Badge>}
              </span>
            </li>
          );
        })}
      </ul>
      <ol className="mt-3 flex flex-wrap gap-1 text-micro text-ink-muted" aria-label="Lifecycle">
        {['Imported', 'Calculated', 'Exception resolved', 'Frozen', 'Approved', 'Shielded payment', 'Confirmed', 'Statement'].map((s) => <li key={s} className="rounded-pill bg-surface-muted px-2 py-0.5">{s}</li>)}
      </ol>
    </figure>
  );
}
