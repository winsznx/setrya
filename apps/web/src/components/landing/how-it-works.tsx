import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icons';

import { Eyebrow, Section, SplitHeading, ZecDot } from './primitives';

interface Step {
  title: string;
  body: string;
  artifact: ReactNode;
}

const ROW = 'flex flex-col gap-0.5 rounded-row bg-surface-muted px-3 py-2 text-label';

const STEPS: Step[] = [
  {
    title: 'Import the fees you earned',
    body: 'Upload the statement your platform gives you. Every row keeps its original fields, and the file is fingerprinted so the same import is never counted twice.',
    artifact: (
      <div className="space-y-1.5">
        <div className={ROW}><span className="flex items-center gap-2 text-ink"><Icon name="file" size={14} />fees-october.csv</span><span className="font-mono text-ink-muted">sha256 4f1c…a9</span></div>
        <div className={ROW}><span className="text-ink-secondary">Trading volume row</span><span className="text-warning-text">Excluded: not a fee</span></div>
      </div>
    ),
  },
  {
    title: 'Apply each agreement',
    body: 'Versioned agreements turn eligible fees into an exact amount per partner, with the formula, the rate you approved and the rounding all written down.',
    artifact: (
      <div className={ROW}><span className="font-mono text-ink-secondary">1,150.00 × 20% × 0.02</span><span className="flex items-center gap-1.5 font-medium text-ink"><ZecDot />4.6 ZEC</span></div>
    ),
  },
  {
    title: 'Freeze and approve',
    body: 'Problems hold only the payouts they touch. You freeze a hashed snapshot of every input and approve it with a fresh password check.',
    artifact: (
      <div className={ROW}><span className="flex items-center gap-2 text-ink"><Icon name="lock" size={14} />Snapshot frozen</span><span className="font-mono text-ink-muted">c2e8…71d0</span></div>
    ),
  },
  {
    title: 'Pay, privately',
    body: 'Your server builds one fully shielded transaction. Setrya checks it against the approval to the zatoshi before anything is signed, then tracks confirmations.',
    artifact: (
      <div className={ROW}><span className="flex items-center gap-2 text-ink"><Icon name="check" size={14} className="text-success-text" />Confirmed</span><span className="text-ink-muted">3 blocks</span></div>
    ),
  },
];

export function HowItWorks() {
  return (
    <Section id="how" titleId="how-title">
      <SplitHeading
        titleId="how-title"
        eyebrow={<Eyebrow>How a period closes</Eyebrow>}
        title="From a fee export to a paid, documented period."
        lead="Each step leaves a record you can show a partner or an accountant. Nothing moves to the next step on a timer."
      />
      <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4 lg:gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col rounded-workspace border border-border bg-surface p-card shadow-raised">
            <span className="grid size-8 place-items-center rounded-pill bg-accent-soft text-label font-semibold text-accent-text">{i + 1}</span>
            <h3 className="mt-5 text-h3 text-ink">{step.title}</h3>
            <p className="mt-2 flex-1 text-body-s text-ink-secondary">{step.body}</p>
            <div className="mt-5">{step.artifact}</div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
