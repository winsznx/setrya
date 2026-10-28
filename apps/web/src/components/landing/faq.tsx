import { Icon } from '@/components/ui/icons';

import { Eyebrow, Section } from './primitives';

const FAQ = [
  ['Who holds the ZEC?', 'You do. The spending keys live in the wallet service on your own server, with the seed encrypted at rest. Setrya asks that wallet to build and sign. It is operator-managed custody, not a hosted wallet.'],
  ['Is it anonymous?', 'No product can promise that. A fully shielded transaction keeps recipients and amounts off the public chain, but its existence and timing are public, and whoever runs your server can read your records while the workspace is unlocked.'],
  ['Can partners see each other?', 'No. Each statement covers one partner, and a shared link is encrypted for that statement only.'],
  ['What if a payment times out?', 'Setrya stores the signed transaction before broadcasting. An unknown outcome is checked against the chain, and only those identical bytes are ever resubmitted.'],
  ['Does it fetch ZEC prices?', 'No. Converting fees needs a rate you enter, with its source and timestamp, and approve.'],
  ['What does it need to run?', 'A Linux server for the API, the database and the wallet service. The web app can run anywhere, including Vercel.'],
];

const LIMITS = [
  'One owner per installation, no multi-user approvals yet.',
  'Fee figures are what your platform reports. Setrya does not verify them independently.',
  'The wallet service is built on pre-release Zcash libraries. Start on testnet.',
  'Funds still in the old Orchard pool must be moved to Ironwood first, which reveals that amount.',
];

export function Faq() {
  return (
    <Section id="questions" titleId="questions-title">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="flex flex-col items-start gap-7">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="questions-title" className="text-balance text-display-l text-ink">Know what you are running.</h2>
          <div className="w-full rounded-workspace bg-panel-soft p-card md:p-6">
            <h3 className="text-h3 text-ink">What Setrya does not do</h3>
            <ul className="mt-3 space-y-2.5 text-body-s text-ink-secondary">
              {LIMITS.map((l) => <li key={l} className="flex gap-2.5"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-pill bg-ink-muted" />{l}</li>)}
            </ul>
          </div>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-medium text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-pill border border-border text-ink-secondary transition-transform duration-fast ease-standard group-open:rotate-45"><Icon name="plus" size={14} /></span>
              </summary>
              <p className="max-w-[38rem] pb-5 text-body-s text-ink-secondary">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
