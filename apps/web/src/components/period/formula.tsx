import { describeRate, type FormulaTrail } from '@setrya/domain';

import { Money, Zec } from '@/components/ui/amount';

/** Every step from fee base to the integer zatoshis that would be sent, with the exact residual dropped by round-down. */
export function FormulaBreakdown({ formula, currency }: { formula: FormulaTrail; currency: string }) {
  const rate = formula.rate ? describeRate({ base: formula.rate.base, quote: formula.rate.quote, numerator: BigInt(formula.rate.numerator), denominator: BigInt(formula.rate.denominator) }) : null;
  const lines: [string, React.ReactNode][] = [
    ['Window', `${formula.windowStart.slice(0, 16).replace('T', ' ')} → ${formula.windowEnd.slice(0, 16).replace('T', ' ')} UTC`],
  ];
  if (formula.kind === 'percentage') {
    lines.push(['Eligible fee base', <><Money key="b" value={formula.base ?? '0'} currency={currency} /> <span className="text-ink-muted">from {formula.eligibleEntryCount} row{formula.eligibleEntryCount === 1 ? '' : 's'}</span></>]);
    lines.push(['× rate', `${formula.ratePct}%`]);
    lines.push(['= calculated', <Money key="u" value={formula.uncapped} currency={currency} />]);
    if (formula.cap) lines.push(['Cap', <Money key="c" value={formula.cap} currency={currency} />]);
  } else lines.push(['Fixed amount', <Money key="f" value={formula.uncapped} currency={currency} />]);
  lines.push(['Amount owed', <strong key="o"><Money value={formula.owed} currency={currency} /></strong>]);
  if (rate) lines.push(['Conversion', `${rate} (approved snapshot ${formula.rate!.snapshotId.slice(0, 8)}…)`]);
  if (formula.zat) lines.push(['ZEC payable (rounded down)', <strong key="z"><Zec zat={formula.zat} trim={false} /> <span className="font-mono text-[0.75rem] text-ink-muted">{formula.zat} zat</span></strong>]);
  if (formula.residualZat) lines.push(['Residual not paid', <span key="r" className="font-mono text-[0.75rem]">{formula.residualZat} zat</span>]);
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-body-s sm:grid-cols-[11rem_1fr]">
      {lines.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-secondary">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
      <div className="contents"><dt className="text-ink-muted">Formula</dt><dd className="text-ink-muted">{formula.formulaVersion}</dd></div>
    </dl>
  );
}
