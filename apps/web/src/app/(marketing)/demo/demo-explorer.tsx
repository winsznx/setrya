'use client';

import { formatGrouped, formatZec, HOLD_TEXT, type HoldCode, parseDec, type FormulaTrail } from '@setrya/domain';
import Link from 'next/link';
import { useState } from 'react';
import type { StatementDocument } from '@setrya/api/contract';

import { FormulaBreakdown } from '@/components/period/formula';
import { StatementDoc } from '@/components/statement/statement-doc';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';

interface Row { key: string; partnerId: string; status: string; zat: string | null; holds: { code: HoldCode }[]; formula: FormulaTrail }
const money = (v: string) => formatGrouped(parseDec(v, 36), 2, 8);
const TABS = ['Revenue', 'Exception', 'Calculation', 'Statement'] as const;

export function DemoExplorer({ rows, partners, calc, statement }: { rows: { id: string; ref: string; label: string; amount: string; type: string; inclusion: string; note: string }[]; partners: { id: string; name: string; ratePct: string }[]; calc: { rows: Row[]; totals: { eligibleByCurrency: Record<string, string>; payableZat: string } }; statement: StatementDocument }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Revenue');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-8">
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t, i) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('flex items-center gap-2 rounded-pill px-4 py-2 text-body-s font-medium', tab === t ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink-secondary hover:text-ink')}><span className="tnum">{i + 1}</span>{t}</button>)}
      </div>
      <div role="tabpanel" className="mt-6 rounded-workspace border border-border bg-surface p-4 md:p-6">
        {tab === 'Revenue' && (
          <>
            <Callout tone="sample" className="mb-4">Three imported rows. Setrya classified the volume row as not fees, and the refund as a negative adjustment after review.</Callout>
            <ul className="divide-y divide-border">
              {rows.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body-s"><span><span className="font-medium">{r.label}</span><span className="block text-label text-ink-muted">{r.ref}{r.note ? ` · ${r.note}` : ''}</span></span><span className="flex items-center gap-2 tnum">{money(r.amount)} USD{r.inclusion === 'eligible' ? <Badge tone="success">Eligible</Badge> : <Badge tone="neutral" icon="x">Excluded</Badge>}</span></li>)}
            </ul>
            <p className="mt-3 text-body-s">Eligible fee base: <strong className="tnum">{money(calc.totals.eligibleByCurrency.USD ?? '0')} USD</strong>, not 21,150.</p>
          </>
        )}
        {tab === 'Exception' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div><Badge tone="danger">Blocking</Badge><h2 className="mt-2 text-h2">Source row appears to represent volume, not earned fees</h2><p className="mt-1 text-body-s text-ink-secondary">VOL-4402 was exported as a fee line for 20,000.00 USD. Until someone decides, every partner paid from this fee base is held.</p></div>
            <div className="rounded-row bg-surface-muted p-4 text-body-s"><div className="font-medium">Decision: exclude with reason</div><p className="mt-1 text-ink-secondary">“Volume is not fees earned.” Recorded with the time and actor; the row stays in the record.</p><p className="mt-2">Owed before: held · after: payable for two partners.</p></div>
          </div>
        )}
        {tab === 'Calculation' && (
          <>
            <ul className="divide-y divide-border">
              {calc.rows.map((r) => {
                const p = partners.find((x) => x.id === r.partnerId)!;
                return (
                  <li key={r.key} className="py-3">
                    <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key} className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-body-s">
                      <span><span className="font-medium">{p.name}</span> <span className="text-ink-muted">{p.ratePct}% of eligible fees</span></span>
                      <span className="flex items-center gap-2 tnum">{money(r.formula.owed)} USD {r.status === 'payable' ? <Badge tone="accent" icon={null}>{formatZec(BigInt(r.zat!), { trim: true })} ZEC</Badge> : <Badge tone="warning">{HOLD_TEXT[r.holds[0]!.code]}</Badge>}</span>
                    </button>
                    {open === r.key && <div className="mt-3 rounded-row bg-surface-muted p-3"><FormulaBreakdown formula={r.formula} currency="USD" /></div>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-body-s text-ink-secondary">Inspect sample calculation: select a partner. Studio Cy is held because no payout address was added, so they are left out of the transaction and stay visible as unpaid.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-row border border-dashed border-border-strong p-4">
              <span className="text-body-s">Sending is not available in the sample.</span>
              <Link href="/how-it-works" className="text-body-s font-medium text-accent-text hover:underline">See real payment walkthrough</Link>
            </div>
          </>
        )}
        {tab === 'Statement' && <div className="rounded-workspace bg-surface-strong p-3 sm:p-6"><StatementDoc doc={statement} /></div>}
      </div>
    </div>
  );
}
