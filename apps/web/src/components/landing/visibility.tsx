import Link from 'next/link';

import { Icon } from '@/components/ui/icons';

import { CenteredHeading, Eyebrow, Section } from './primitives';

const VIEWERS = [
  { who: 'You, the operator', sees: ['Revenue, partners, agreements and payments', 'Decrypted only while your workspace is unlocked'], hidden: ['Nothing of your own'] },
  { who: 'Each partner', sees: ['Their own statement', 'Through a link encrypted for them'], hidden: ['Your revenue', 'Other partners', 'Your balance'] },
  { who: 'The public chain', sees: ['That a shielded transaction happened, and when'], hidden: ['Who was paid', 'How much', 'Which agreement'] },
];

export function Visibility() {
  return (
    <Section id="privacy" titleId="privacy-title">
      <CenteredHeading
        titleId="privacy-title"
        eyebrow={<Eyebrow>Who sees what</Eyebrow>}
        title="Private by default, honest about the limits."
        lead="Payments stay inside one shielded pool, so recipients and amounts never reach the public chain. Here is exactly who can read what."
      />
      <div className="mt-10 grid gap-3 md:mt-14 md:grid-cols-3 md:gap-4">
        {VIEWERS.map((v) => (
          <article key={v.who} className="rounded-workspace border border-border bg-surface p-card shadow-raised md:p-6">
            <h3 className="text-h2 text-ink">{v.who}</h3>
            <p className="mt-5 text-label font-medium text-ink-muted">Can see</p>
            <ul className="mt-2 space-y-2 text-body-s text-ink">
              {v.sees.map((s) => <li key={s} className="flex gap-2"><Icon name="eye" size={16} className="mt-0.5 shrink-0 text-accent-text" />{s}</li>)}
            </ul>
            <p className="mt-5 text-label font-medium text-ink-muted">Cannot see</p>
            <ul className="mt-2 space-y-2 text-body-s text-ink-secondary">
              {v.hidden.map((s) => <li key={s} className="flex gap-2"><Icon name="eyeOff" size={16} className="mt-0.5 shrink-0 text-ink-muted" />{s}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[44rem] text-center text-body-s text-ink-secondary">
        Setrya cannot hide transaction timing, the fact that you run a server, or what your host administrator can read. The chain server your wallet talks to sees your server’s address, never amounts or recipients.{' '}
        <Link prefetch={false} href="/privacy" className="font-medium text-accent-text hover:underline">Read the privacy model</Link>
      </p>
    </Section>
  );
}
