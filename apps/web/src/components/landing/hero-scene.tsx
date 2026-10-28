import { formatGrouped, formatZec, parseDec } from '@setrya/domain';

import { SAMPLE_PARTNERS, SAMPLE_ROWS, sampleCalculation } from '@/components/marketing/sample';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';

import { ZecDot } from './primitives';

const usd = (v: string) => formatGrouped(parseDec(v, 36), 2, 8);

/** ZIP 317 for two payees plus change: three Ironwood actions at 5,000 zatoshis each. */
const SAMPLE_FEE_ZAT = 15_000n;

/**
 * One settlement as a product scene: the period worksheet the engine computed from sample rows, and the wallet's
 * inspection of the transaction that pays it. Every figure comes from the real engine; the whole scene is labelled
 * as sample data.
 */
export function HeroScene({ className }: { className?: string }) {
  const run = sampleCalculation();
  const payable = run.rows.filter((r) => r.status === 'payable');
  const total = payable.reduce((s, r) => s + (r.zat ?? 0n), 0n);
  const name = (id: string) => SAMPLE_PARTNERS.find((p) => p.id === id)?.name ?? id;

  return (
    <figure aria-label="Sample settlement: worksheet and payment inspection" className={cx('relative overflow-hidden rounded-[28px] bg-stage p-3 sm:p-5 md:p-8', className)}>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[20px] border border-glass-light-edge bg-glass-light p-4 shadow-floating backdrop-blur-md sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-s font-semibold text-ink">October creator fees</p>
            <span className="rounded-pill bg-sample-soft px-2.5 py-1 text-micro font-medium text-sample">Sample data</span>
          </div>
          <ul className="mt-3 divide-y divide-border text-body-s">
            {SAMPLE_ROWS.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className={cx('block truncate', row.inclusion === 'excluded' && 'text-ink-muted line-through decoration-ink-muted/60')}>{row.label}</span>
                  <span className="block truncate text-label text-ink-muted">{row.note || row.ref}</span>
                </span>
                <span className="shrink-0 tnum text-ink">{usd(row.amount)} <span className="text-ink-muted">USD</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between rounded-row bg-surface-muted px-3 py-2.5 text-body-s">
            <span className="text-ink-secondary">Eligible fee base</span>
            <span className="font-semibold tnum">{usd(run.totals.eligibleByCurrency.USD ?? '0')} USD</span>
          </div>
          <ul className="mt-3 space-y-2 text-body-s">
            {run.rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate"><span className="font-medium">{name(row.partnerId)}</span> <span className="text-ink-muted">{SAMPLE_PARTNERS.find((p) => p.id === row.partnerId)?.ratePct}%</span></span>
                {row.status === 'payable' ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 tnum font-medium"><ZecDot />{formatZec(row.zat!, { trim: true })} ZEC</span>
                ) : (
                  <span className="shrink-0 rounded-pill bg-warning-soft px-2 py-0.5 text-label text-warning-text">Held until an address is added</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="rounded-[20px] border border-border bg-surface p-4 shadow-floating sm:p-5">
            <p className="flex items-center gap-2 text-body-s font-semibold text-ink"><Icon name="shield" size={16} className="text-accent-text" />Inspected before signing</p>
            <ul className="mt-3 space-y-2.5 text-body-s">
              {[
                ['Stays inside the Ironwood pool', 'No transparent inputs or outputs'],
                [`${payable.length} of ${payable.length} payees matched`, 'By address and exact zatoshis'],
                ['Fee matches ZIP 317', `${formatGrouped({ units: SAMPLE_FEE_ZAT, scale: 0 }, 0, 0)} zatoshis, paid by you`],
              ].map(([title, detail]) => (
                <li key={title} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill bg-success-soft text-success-text"><Icon name="check" size={12} /></span>
                  <span className="min-w-0"><span className="block font-medium text-ink">{title}</span><span className="block text-label text-ink-muted">{detail}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[20px] border border-glass-deep-edge bg-glass-deep p-4 text-white shadow-floating backdrop-blur-md sm:p-5">
            <p className="text-label text-white/70">Shielded payment, one transaction</p>
            <p className="mt-1 flex items-center gap-2 text-figure tnum"><ZecDot className="size-2.5" />{formatZec(total, { trim: true })} ZEC</p>
            <p className="mt-2 text-label text-white/70">Then one statement per partner, readable only by them.</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
