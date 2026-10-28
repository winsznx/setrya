import { sampleStatement } from '@/components/marketing/sample-statement';
import { StatementDoc } from '@/components/statement/statement-doc';

import { Eyebrow, Section, SplitHeading } from './primitives';

const NOTES = [
  ['Every number has a source', 'The fee base, the agreement version, the rate and the exact zatoshis, line by line.'],
  ['The stamp says what was observed', 'Approved, pending or confirmed on chain. Never “verified by the recipient” unless they say so.'],
  ['Only their own line', 'A shared link is encrypted for one statement. No other partner, no revenue total, no balance.'],
];

export function Statement() {
  return (
    <Section id="statements" titleId="statements-title">
      <SplitHeading
        titleId="statements-title"
        eyebrow={<Eyebrow>What each partner receives</Eyebrow>}
        title="One statement per partner, and nothing more."
        lead="Partners see how their payout was calculated and whether it reached the chain. They never see your other partners or your revenue."
      />
      <div className="mt-10 grid gap-4 rounded-[28px] bg-panel-soft p-3 sm:p-6 md:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-8 lg:p-10">
        <div className="min-w-0"><StatementDoc doc={sampleStatement()} /></div>
        <ul className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-6 lg:pt-6">
          {NOTES.map(([title, body]) => (
            <li key={title} className="rounded-panel bg-surface p-4 shadow-raised lg:bg-transparent lg:p-0 lg:shadow-none">
              <h3 className="text-h3 text-ink">{title}</h3>
              <p className="mt-1.5 text-body-s text-ink-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
