import { ZecMark } from '@/components/brand/zec-mark';
import { Icon } from '@/components/ui/icons';

import { CenteredHeading, Eyebrow, IconDisc, Section } from './primitives';

const ART = 'mt-6 space-y-1.5 rounded-panel bg-surface p-3 text-label shadow-raised';

export function Features() {
  return (
    <Section id="features" titleId="features-title">
      <CenteredHeading
        titleId="features-title"
        eyebrow={<Eyebrow>Built for money that has to be exact</Eyebrow>}
        title="Careful where it counts, quiet everywhere else."
        lead="Setrya works in whole zatoshis and exact decimals, refuses anything it cannot prove, and keeps one partner’s problem from holding up everyone else."
      />
      <div className="mt-10 grid gap-3 md:mt-14 lg:grid-cols-3 lg:gap-4">
        <article className="flex flex-col rounded-workspace bg-panel-soft p-card md:p-6">
          <IconDisc name="pause" />
          <h3 className="mt-5 text-h2 text-ink">A problem holds one payout, not the period</h3>
          <p className="mt-2 text-body-s text-ink-secondary">A missing address or an unresolved row holds only the payouts it affects. Everyone else can still be paid.</p>
          <ul className={ART}>
            <li className="flex justify-between gap-3"><span>Promoter Ana</span><span className="flex items-center gap-1.5 font-medium"><ZecMark />4.6 ZEC</span></li>
            <li className="flex justify-between gap-3"><span>Creator Bo</span><span className="flex items-center gap-1.5 font-medium"><ZecMark />2.3 ZEC</span></li>
            <li className="flex justify-between gap-3"><span>Studio Cy</span><span className="rounded-pill bg-warning-soft px-2 text-warning-text">Held: no address</span></li>
          </ul>
        </article>

        <article className="flex flex-col rounded-workspace bg-band p-card text-white md:p-6">
          <span aria-hidden className="grid size-11 place-items-center rounded-pill bg-white/10 text-white"><Icon name="shield" size={20} /></span>
          <h3 className="mt-5 text-h2">A crash never pays anyone twice</h3>
          <p className="mt-2 text-body-s text-white/75">The signed transaction is stored encrypted before it is broadcast. If the outcome is unknown, Setrya checks the chain and only ever resubmits those exact bytes.</p>
          <ol className="mt-6 space-y-1.5 text-label">
            {['Signed and stored', 'Broadcast timed out', 'Found in the mempool', 'Confirmed, once'].map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 rounded-row border border-glass-deep-edge bg-white/5 px-3 py-2">
                <span className="font-mono text-white/60">{i + 1}</span>{s}
              </li>
            ))}
          </ol>
        </article>

        <article className="flex flex-col rounded-workspace bg-panel-soft p-card md:p-6">
          <IconDisc name="clock" />
          <h3 className="mt-5 text-h2 text-ink">Rates you approve, never fetched</h3>
          <p className="mt-2 text-body-s text-ink-secondary">Converting fees to ZEC uses a rate you enter with its source and time, and approve. Amounts round down to whole zatoshis, and the remainder is recorded.</p>
          <div className={ART}>
            <div className="flex justify-between gap-3"><span className="text-ink-secondary">1 USD</span><span className="font-medium">0.02 ZEC</span></div>
            <div className="flex justify-between gap-3 text-ink-muted"><span>Source</span><span>Your OTC desk, 31 Oct 12:00</span></div>
          </div>
        </article>
      </div>
    </Section>
  );
}
