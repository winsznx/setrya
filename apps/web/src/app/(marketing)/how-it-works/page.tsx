import type { Metadata } from 'next';
import Link from 'next/link';

import { CtaBand } from '@/components/landing/cta-band';
import { Eyebrow, Section, SplitHeading } from '@/components/landing/primitives';
import { PageIntro } from '@/components/marketing/prose';
import { SampleWorksheet } from '@/components/marketing/sample-worksheet';

export const metadata: Metadata = { title: 'How it works', description: 'From fee statement to private settlement, step by step.' };

const STEPS: [string, string, string][] = [
  ['Import the real record', 'Upload the CSV your launchpad or platform exports. You map its columns, and Setrya flags rows that look wrong: a line labelled fees that reads like trading volume, a duplicate ID, a refund that needs a decision. Nothing is committed until you review every row.', 'Each row keeps its raw fields and a hash; the file keeps its SHA-256 fingerprint.'],
  ['Apply agreements to the eligible base', 'Agreements are versioned terms: 20% of eligible realised fees, a fixed 1 ZEC per period, with caps and refund rules. If a version changes mid-month, the fee base splits by date. Exclusive shares on one pool cannot exceed 100%.', 'Amounts are exact decimals. ZEC is integer zatoshis. No floating point anywhere.'],
  ['Decide the exceptions', 'An unresolved row holds only the payouts that depend on it. You exclude it, correct it, or hold the payment, with a reason. The inbox previews how totals change before you save.', 'Decisions are locked once you freeze; later changes need a new revision.'],
  ['Freeze, approve, inspect, sign', 'Freezing hashes every input: rows, agreement versions, rates, address versions, payer account. Approval needs your password. The wallet service on your server then builds a FullPrivacy PCZT, and Setrya compares the wallet’s inspection with the approval to the zatoshi before you authorise signing.', 'Any transparent output, cross-pool amount or mismatch blocks the send.'],
  ['Confirm and issue statements', 'Setrya stores the signed transaction before broadcasting it, then watches confirmations. Each partner gets a statement and, if you choose, an encrypted link only they can open.', 'No status says paid until the confirmation threshold is reached.'],
];

export default function HowItWorks() {
  return (
    <div className="pb-section">
      <PageIntro eyebrow="How it works" title="From fee statement to private settlement">Picture a launch studio paying a promoter 20% and a creator 10% of last month&apos;s fees. The export shows $1,200 of fees, a $50 refund, and a $20,000 line that is trading volume. Here is what happens to it.</PageIntro>
      <Section titleId="steps-title">
        <h2 id="steps-title" className="sr-only">Steps</h2>
        <ol className="relative space-y-4 md:space-y-6">
          {STEPS.map(([title, body, note], i) => (
            <li key={title} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-6">
              <div className="flex md:flex-col md:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-accent-soft text-body-s font-semibold text-accent-text">{i + 1}</span>
                {i < STEPS.length - 1 && <span aria-hidden className="mt-3 hidden w-px flex-1 bg-border md:block" />}
              </div>
              <div className="min-w-0 rounded-workspace border border-border bg-surface p-card shadow-raised md:p-6">
                <h3 className="text-h2 text-ink">{title}</h3>
                <p className="mt-3 max-w-reading text-body-s text-ink-secondary">{body}</p>
                <p className="mt-3 rounded-row bg-surface-muted px-3 py-2 text-label text-ink-secondary">{note}</p>
                {i === 1 && <div className="mt-6 max-w-xl"><SampleWorksheet /></div>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section titleId="boundaries-title">
        <SplitHeading titleId="boundaries-title" eyebrow={<Eyebrow>Privacy boundaries</Eyebrow>} title="Who can see each step." lead={<>The same rules hold at every stage. <Link prefetch={false} href="/privacy" className="font-medium text-accent-text hover:underline">Read the privacy model</Link>.</>} />
        <div className="mt-10 grid gap-3 md:grid-cols-2 md:gap-4">
          {[
            ['What the operator can see', 'Everything in your project, decrypted only while your workspace is unlocked.'],
            ['What recipients can see', 'Their own statement: fee base, rule, amount, payment status and txid. Nothing about other partners.'],
            ['What the public chain can see', 'That a shielded transaction exists and when it was mined. Not its recipients or amounts.'],
            ['What Setrya cannot hide', 'Timing, your server’s network activity, anything readable by your host administrator, and statements a partner forwards.'],
          ].map(([t, b]) => <div key={t} className="rounded-workspace bg-panel-soft p-card md:p-6"><h3 className="text-h3 text-ink">{t}</h3><p className="mt-2 text-body-s text-ink-secondary">{b}</p></div>)}
        </div>
      </Section>
      <CtaBand openHref="/sign-in" />
    </div>
  );
}
