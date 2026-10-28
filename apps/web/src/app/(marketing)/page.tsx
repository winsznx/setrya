import type { Metadata } from 'next';
import Link from 'next/link';

import { SampleWorksheet } from '@/components/marketing/sample-worksheet';
import { sampleStatement } from '@/components/marketing/sample-statement';
import { StatementDoc } from '@/components/statement/statement-doc';
import { loadView } from '@/lib/api/views';

export const metadata: Metadata = {
  title: 'Setrya: private revenue-share settlement in ZEC',
  description: 'Import the fees you earned, apply partner agreements, review exceptions, and pay each partner with a fully shielded Zcash transaction and a statement of their own.',
};

const STEPS = [
  ['Import', 'Upload the fee statement your platform gives you. Each row keeps its original fields, file hash and your classification.'],
  ['Calculate', 'Versioned agreements turn eligible realised fees into an exact amount owed per partner. Volume never counts as fees.'],
  ['Review', 'Exceptions hold only the payouts they affect. You freeze a hashed snapshot and approve it with a fresh password check.'],
  ['Settle', 'The wallet service on your own server builds a FullPrivacy transaction. Setrya shows its inspected outputs before anything is signed.'],
];

const FAQ = [
  ['Who holds the ZEC?', 'You do. The spending keys live in the wallet service on your own Linux server. Setrya is self-hosted software that asks that wallet to build and sign. It is operator-managed custody, not a hosted wallet.'],
  ['Is it anonymous?', 'No product can promise that. A fully shielded transaction keeps recipients and amounts off the public chain, but its existence and timing are public, and whoever runs your server can read your records while the workspace is unlocked.'],
  ['Can partners see each other?', 'No. Each statement covers one partner, and a shared link is encrypted for that statement only.'],
  ['What if the payment times out?', 'Setrya stores the signed transaction before broadcasting. An unknown outcome is investigated against the node, and only the identical bytes are ever resubmitted.'],
  ['Does it fetch ZEC prices?', 'No. Converting fees in USD needs a rate you enter, with its source and timestamp, and approve.'],
];

export default async function Landing() {
  const open = (await loadView('auth.status').then((s) => s.ownerExists, () => true)) ? '/sign-in' : '/setup-owner';
  return (
    <>
      <section className="mx-auto grid max-w-content items-center gap-10 px-4 py-14 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:py-20">
        <div className="animate-rise">
          <p className="text-label font-semibold tracking-[0.12em] text-accent-text">PRIVATE REVENUE SETTLEMENTS</p>
          <h1 className="mt-4 font-serif text-display text-balance">Know what’s owed. Settle it privately.</h1>
          <p className="mt-5 max-w-reading text-[1.0625rem] text-ink-secondary">Setrya turns the fees you actually earned into exact partner payouts: import your fee statement, apply each agreement, resolve what looks wrong, then pay every partner with a fully shielded ZEC transaction and a statement of their own.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={open} className="inline-flex min-h-[3rem] items-center rounded-pill bg-brand px-6 font-medium text-on-brand hover:bg-brand-strong">Open Setrya</Link>
            <Link href="/how-it-works" className="inline-flex min-h-[3rem] items-center rounded-pill border border-border-strong px-6 font-medium hover:bg-surface-muted">See how it works</Link>
          </div>
        </div>
        <SampleWorksheet />
      </section>

      <section className="border-y border-border bg-surface-muted">
        <ol className="mx-auto grid max-w-content gap-8 px-4 py-14 md:grid-cols-4 md:px-8">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <span className="font-mono text-label text-ink-muted">Step {i + 1}</span>
              <h2 className="mt-1 text-h2">{title}</h2>
              <p className="mt-2 text-body-s text-ink-secondary">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-content items-start gap-10 px-4 py-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <div className="lg:sticky lg:top-24">
          <h2 className="font-serif text-[2rem] leading-tight">One statement per partner.</h2>
          <p className="mt-3 max-w-reading text-ink-secondary">Every line shows the fee base, the agreement version, the rate and its source, and the exact zatoshis. The stamp says what was actually observed: approved, pending, or confirmed on chain. Never “verified by the recipient” unless they say so, and then it is labelled as their own declaration.</p>
          <p className="mt-3 text-body-s text-ink-muted">Sample document shown. Illustrative data.</p>
        </div>
        <div className="rounded-workspace bg-surface-strong p-3 sm:p-6"><StatementDoc doc={sampleStatement()} /></div>
      </section>

      <section className="border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 md:px-8">
          <h2 className="text-h1">Who can see what</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['You, the operator', 'All your revenue, partners, agreements and payments, decrypted only while your workspace is unlocked on your own server.'],
              ['Each partner', 'Their own statement through an encrypted link. Not your revenue, not other partners, not your balance.'],
              ['The public chain', 'That a shielded transaction happened, and when. Not who received it or how much, when it stays inside one shielded pool.'],
            ].map(([t, b]) => <div key={t} className="rounded-panel border border-border bg-surface p-5"><h3 className="text-h3">{t}</h3><p className="mt-2 text-body-s text-ink-secondary">{b}</p></div>)}
          </div>
          <p className="mt-6 max-w-reading text-body-s text-ink-secondary">What Setrya cannot hide: transaction timing, the fact that you run a server, anything your host administrator or a compromised browser can read, and statements partners choose to forward. <Link href="/privacy" className="text-accent-text hover:underline">Read the full privacy model</Link>.</p>
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 py-16 md:px-8">
        <h2 className="text-h1">Limitations</h2>
        <ul className="mt-4 grid gap-3 text-body-s text-ink-secondary md:grid-cols-2">
          <li>Payments need a Linux settlement host running the Setrya signer, which is built on pre-release Zcash libraries.</li><li>The signer reads the chain from a lightwalletd server, which sees your server’s IP address and broadcast timing but not amounts or recipients.</li>
          <li>One owner per installation. No multi-user approvals yet.</li>
          <li>Fee figures are what your platform reports. Setrya does not verify them independently.</li>
          <li>Statements prove what you calculated and what the chain shows, not that a partner checked their wallet.</li>
        </ul>
        <h2 className="mt-14 text-h1">Questions</h2>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none text-body font-medium">{q}</summary>
              <p className="mt-2 max-w-reading text-body-s text-ink-secondary">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
