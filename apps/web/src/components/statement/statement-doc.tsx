import type { PaymentStatus, StatementDocument } from '@setrya/api/contract';
import { formatGrouped, formatZec, parseDec } from '@setrya/domain';

const STAMP: Record<PaymentStatus, { text: string; cls: string }> = {
  approved_not_paid: { text: 'Approved — not paid', cls: 'border-[#3138a8] text-[#3138a8]' },
  pending: { text: 'Payment pending', cls: 'border-[#8a5a00] text-[#8a5a00]' },
  confirmed: { text: 'Confirmed on chain', cls: 'border-[#17663f] text-[#17663f]' },
  failed: { text: 'Payment not completed', cls: 'border-[#b02c26] text-[#b02c26]' },
  held: { text: 'Held — not paid', cls: 'border-[#8a5a00] text-[#8a5a00]' },
};

const fmt = (v: string) => formatGrouped(parseDec(v, 36), 2, 8);
const date = (iso: string, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const dateTime = (iso: string, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

/**
 * The statement as a paper document. Fixed light colors on purpose: it must print identically and read the same in
 * any theme. Status is always written out in words, never conveyed by color alone.
 */
export function StatementDoc({ doc, page }: { doc: StatementDocument; page?: boolean }) {
  const tz = doc.period.timezone;
  const last = new Date(new Date(doc.period.endAt).getTime() - 1).toISOString();
  const stamp = STAMP[doc.payment.status];
  return (
    <article className={`relative mx-auto w-full max-w-[52rem] bg-[#fdfdfc] text-[#15171c] ${page ? '' : 'rounded-panel shadow-paper'} print:shadow-none`} aria-label={`Statement ${doc.reference}`}>
      <div className="p-6 sm:p-10">
        <header className="flex flex-col gap-6 border-b border-[#15171c] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {doc.issuer.logo && <img src={doc.issuer.logo} alt="" className="mb-3 h-9 w-auto" />}
            <div className="font-serif text-[1.75rem] leading-tight">{doc.issuer.label}</div>
            <div className="text-[0.8125rem] text-[#545a66]">{doc.issuer.org} · {doc.issuer.project}</div>
          </div>
          <div className="text-left text-[0.8125rem] sm:text-right">
            <div className="font-serif text-[1.125rem]">Settlement statement</div>
            <div className="font-mono text-[0.75rem]">{doc.reference} · v{doc.documentVersion}</div>
            <div className="mt-1 text-[#545a66]">Generated {dateTime(doc.generatedAt, tz)}</div>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 text-[0.875rem]">
            <dt className="text-[#545a66]">Prepared for</dt><dd className="font-semibold">{doc.recipientLabel}</dd>
            <dt className="text-[#545a66]">Period</dt><dd>{doc.period.label}</dd>
            <dt className="text-[#545a66]">Dates</dt><dd>{date(doc.period.startAt, tz)} – {date(last, tz)}</dd>
            <dt className="text-[#545a66]">Fee source</dt><dd>{doc.sources.join(', ')}</dd>
          </dl>
          <div className={`inline-block -rotate-2 self-start border-2 px-3 py-1.5 font-mono text-[0.75rem] font-medium uppercase tracking-[0.12em] ${stamp.cls}`} role="status">{stamp.text}</div>
        </div>

        <section className="mt-8" aria-labelledby={`calc-${doc.id}`}>
          <h2 id={`calc-${doc.id}`} className="font-serif text-[1.25rem]">How this amount was calculated</h2>
          <table className="mt-3 w-full border-collapse text-[0.875rem]">
            <thead>
              <tr className="border-b border-[#cfd3db] text-left text-[0.75rem] text-[#545a66]">
                <th className="py-2 pr-3 font-medium">Agreement</th>
                <th className="py-2 pr-3 text-right font-medium">Eligible fees</th>
                <th className="py-2 pr-3 text-right font-medium">Amount owed</th>
                <th className="py-2 text-right font-medium">ZEC</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} className="border-b border-[#e4e6eb] align-top">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{l.agreementTitle} <span className="text-[#687080]">v{l.agreementVersion}</span></div>
                    <div className="text-[0.8125rem] text-[#545a66]">{l.rule}</div>
                    {l.rateDescription && <div className="text-[0.75rem] text-[#545a66]">Rate {l.rateDescription}, {l.rateSource}, quoted {l.rateQuotedAt ? dateTime(l.rateQuotedAt, tz) : ''}. Manual rate, not an onchain conversion.</div>}
                    {l.held.length > 0 && <div className="text-[0.75rem] text-[#8a5a00]">Held: {l.held.join('; ')}</div>}
                  </td>
                  <td className="py-3 pr-3 text-right tnum">{l.eligibleBase ? `${fmt(l.eligibleBase)} ${l.currency}` : 'Fixed'}</td>
                  <td className="py-3 pr-3 text-right tnum">{fmt(l.owed)} {l.currency}</td>
                  <td className="py-3 text-right tnum">{l.zat ? formatZec(BigInt(l.zat)) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-semibold">Total</td>
                <td />
                <td className="pt-3 text-right font-semibold tnum">{Object.entries(doc.totals.owedByCurrency).map(([c, v]) => <div key={c}>{fmt(v)} {c}</div>)}</td>
                <td className="pt-3 text-right font-semibold tnum">{doc.totals.zat ? `${formatZec(BigInt(doc.totals.zat))} ZEC` : '—'}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-[0.75rem] text-[#687080]">ZEC amounts are rounded down to whole zatoshis (0.00000001 ZEC), so no more than the approved amount is ever sent.</p>
        </section>

        <section className="mt-8 rounded-[10px] border border-[#cfd3db] p-4 text-[0.875rem]" aria-labelledby={`pay-${doc.id}`}>
          <h2 id={`pay-${doc.id}`} className="font-serif text-[1.125rem]">Payment</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-[#545a66]">Status</dt><dd className="font-medium">{stamp.text}{doc.payment.status === 'pending' ? ` (${doc.payment.confirmations} of ${doc.payment.targetConfirmations} confirmations)` : ''}</dd>
            <dt className="text-[#545a66]">Network</dt><dd className="capitalize">Zcash {doc.payment.network}</dd>
            {doc.payment.confirmedAt && <><dt className="text-[#545a66]">Payment date</dt><dd>{dateTime(doc.payment.confirmedAt, tz)}</dd></>}
            {doc.payment.memoRef && <><dt className="text-[#545a66]">Payment reference</dt><dd className="font-mono text-[0.8125rem]">{doc.payment.memoRef}</dd></>}
            <dt className="text-[#545a66]">Transaction ID</dt><dd className="break-all font-mono text-[0.75rem]">{doc.payment.txid ?? 'Not broadcast'}</dd>
            {doc.acknowledgment && <><dt className="text-[#545a66]">Recipient</dt><dd>Self-attested receipt on {dateTime(doc.acknowledgment.at, tz)}. A declaration by the recipient, not cryptographic proof.</dd></>}
          </dl>
          <p className="mt-3 text-[0.75rem] text-[#545a66]">Shielded transfer details are verified only by authorised wallet views, not public explorers. A transaction ID shows that a transaction exists; it does not reveal the recipient or the amount, and it may include other recipients.</p>
        </section>

        <footer className="mt-8 border-t border-[#e4e6eb] pt-4 text-[0.75rem] text-[#687080]">
          <p>{doc.issuerNote}</p>
          <p className="mt-1">This document covers {doc.recipientLabel} only.</p>
        </footer>
      </div>
    </article>
  );
}
