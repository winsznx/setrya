'use client';

import { useRouter } from 'next/navigation';
import { describeTerms, type AgreementTerms, HOLD_TEXT, type HoldCode, EXCEPTION_TITLE, type ExceptionCode } from '@setrya/domain';
import { useEffect, useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Money, MoneyGroups, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { RateQuoteForm } from '@/components/period/rate-quote';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/client/api';

interface Rate { id: string; base: string; description: string; source: string; quotedAt: string; expiresAt: string; enteredAs: string }
interface Preview {
  matched: number;
  alreadyClaimed: number;
  byClassification: Record<'eligible' | 'excluded' | 'held', Record<string, string>>;
  heldCount: number;
  currencies: string[];
  agreements: { versionId: string; title: string; partner: string; version: number; effectiveFrom: string; effectiveTo: string | null; terms: AgreementTerms }[];
  rows: { key: string; partner: string; currency: string; owed: string; base: string | null; zat: string | null; status: string; holds: HoldCode[] }[];
  totals: { payableZat: string; payableCount: number; heldCount: number; owedByCurrency: Record<string, string> };
  exceptions: { code: ExceptionCode; severity: string }[];
}

const STEPS = ['Scope', 'Eligible fee base', 'Apply agreements', 'Conversion', 'Calculate'];

export function PeriodWizard({ projectId, timezone, sources, rates: initialRates, rateExpiryHours, spendableZat, initial }: { projectId: string; timezone: string; sources: { id: string; name: string; currency: string }[]; rates: Rate[]; rateExpiryHours: number; spendableZat: string | null; initial: { label: string; startDate: string; endDate: string; sourceIds: string[] } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState(initial);
  const [rates, setRates] = useState(initialRates);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const create = useSubmit<{ id: string }>();
  const [quoting, setQuoting] = useState<string | null>(null);

  const validScope = scope.label.trim() && scope.startDate && scope.endDate && scope.sourceIds.length > 0 && scope.endDate >= scope.startDate;
  const liveRates = rates.filter((r) => new Date(r.expiresAt) > new Date());

  useEffect(() => {
    if (!scope.startDate || !scope.endDate || scope.sourceIds.length === 0 || scope.endDate < scope.startDate) return setPreview(null);
    const t = setTimeout(async () => {
      const r = await api<Preview>(`/api/v1/projects/${projectId}/periods/preview`, { method: 'POST', body: { ...scope, label: scope.label || 'preview', rateSnapshotIds: chosen } });
      if (r.ok) { setPreview(r.data); setPreviewError(null); } else setPreviewError(r.error.message);
    }, 300);
    return () => clearTimeout(t);
  }, [projectId, scope, chosen]);

  const nonZec = preview?.currencies.filter((c) => c !== 'ZEC') ?? [];
  const fixedNonZec = (preview?.agreements ?? []).filter((a) => a.terms.kind === 'fixed' && a.terms.currency !== 'ZEC').map((a) => (a.terms as { currency: string }).currency);
  const needRates = [...new Set([...nonZec, ...fixedNonZec])];
  const shortfall = spendableZat !== null && preview ? BigInt(preview.totals.payableZat) > BigInt(spendableZat) : false;

  const summary = (
    <Card className="space-y-3 lg:sticky lg:top-24">
      <h2 className="text-h3">Summary</h2>
      <dl className="space-y-2 text-body-s">
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Period</dt><dd className="text-right">{scope.label || '—'}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Dates</dt><dd className="text-right">{scope.startDate} → {scope.endDate}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Matched rows</dt><dd className="tnum">{preview?.matched ?? '—'}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Eligible base</dt><dd className="text-right"><MoneyGroups groups={preview?.byClassification.eligible} /></dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Owed</dt><dd className="text-right"><MoneyGroups groups={preview?.totals.owedByCurrency} /></dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Payable now</dt><dd>{preview?.totals.payableCount ? <Zec zat={preview.totals.payableZat} /> : '—'}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Held rows</dt><dd className="tnum">{preview?.totals.heldCount ?? '—'}</dd></div>
      </dl>
      <p className="text-label text-ink-muted">Live dry run of the same engine. Nothing is saved until you create the draft.</p>
    </Card>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-5">
        <ol className="flex flex-wrap gap-2" aria-label="Period steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > step && !validScope} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-pill px-3 py-1.5 text-body-s', i === step ? 'bg-brand text-on-brand' : i < step ? 'bg-success-soft text-success-text' : 'bg-surface-muted text-ink-muted')}>
                <span className="tnum">{String.fromCharCode(65 + i)}</span>{s}
              </button>
            </li>
          ))}
        </ol>
        {previewError && <Callout tone="danger">{previewError}</Callout>}

        {step === 0 && (
          <Card className="space-y-5">
            <TextField label="Period name" placeholder="October creator fees" value={scope.label} onChange={(e) => setScope({ ...scope, label: e.target.value })} required />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="First day" type="date" value={scope.startDate} onChange={(e) => setScope({ ...scope, startDate: e.target.value })} />
              <TextField label="Last day" type="date" value={scope.endDate} onChange={(e) => setScope({ ...scope, endDate: e.target.value })} hint={`Inclusive. Stored as [start, day after end) in ${timezone}.`} error={scope.endDate < scope.startDate ? 'Must be on or after the first day' : undefined} />
            </div>
            <fieldset>
              <legend className="mb-2 text-body-s font-medium">Sources</legend>
              {sources.map((s) => <CheckboxField key={s.id} className="mb-2" label={`${s.name} (${s.currency})`} checked={scope.sourceIds.includes(s.id)} onChange={(e) => setScope({ ...scope, sourceIds: e.target.checked ? [...scope.sourceIds, s.id] : scope.sourceIds.filter((x) => x !== s.id) })} />)}
            </fieldset>
            {preview && <p className="text-body-s">{preview.matched} imported row{preview.matched === 1 ? '' : 's'} fall in this range.</p>}
            {preview && preview.alreadyClaimed > 0 && <Callout tone="warning" title={`${preview.alreadyClaimed} row(s) already belong to another period`}>They are left out so no fee is consumed twice. Corrections to settled rows go into a new period as adjustments.</Callout>}
            <Button size="lg" disabled={!validScope} onClick={() => setStep(1)}>Continue</Button>
          </Card>
        )}

        {step === 1 && preview && (
          <Card className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {(['eligible', 'excluded', 'held'] as const).map((k) => (
                <div key={k} className="rounded-row bg-surface-muted p-3">
                  <div className="text-body-s text-ink-secondary">{k === 'eligible' ? 'Eligible fees' : k === 'excluded' ? 'Excluded (volume, other)' : 'Unresolved'}</div>
                  <div className="mt-1 font-semibold"><MoneyGroups groups={preview.byClassification[k]} /></div>
                </div>
              ))}
            </div>
            <p className="text-body-s text-ink-secondary">Refunds and chargebacks count as negative adjustments only for agreements that net them. Each currency is totalled separately.</p>
            {preview.heldCount > 0 && <Callout tone="warning" title={`${preview.heldCount} unresolved row(s)`}>They become exceptions in the new period. Agreements that draw on them are held until you decide each one in the exception inbox.</Callout>}
            <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button><Button size="lg" onClick={() => setStep(2)}>Continue</Button></div>
          </Card>
        )}

        {step === 2 && preview && (
          <Card className="space-y-4">
            {preview.agreements.length === 0 ? <Callout tone="warning" title="No agreement covers these sources and dates">The period would owe nothing. Add or activate an agreement, or change the scope.</Callout> : (
              <ul className="divide-y divide-border">
                {preview.agreements.map((a) => (
                  <li key={a.versionId} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium">{a.partner}</span><Badge tone="neutral" icon={null}>{a.title} · v{a.version}</Badge></div>
                    <div className="text-body-s">{describeTerms(a.terms)}</div>
                    <div className="text-label text-ink-muted">Effective {a.effectiveFrom.slice(0, 10)}{a.effectiveTo ? ` until ${a.effectiveTo.slice(0, 10)}` : ' onward'}. Only fees inside both windows count.</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-body-s text-ink-secondary">When versions change mid-period, the fee base is split by date so each version applies only to its own days.</p>
            <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button><Button size="lg" onClick={() => setStep(3)}>Continue</Button></div>
          </Card>
        )}

        {step === 3 && preview && (
          <Card className="space-y-5">
            {needRates.length === 0 ? <Callout tone="success" title="Already denominated in ZEC">Amounts are paid exactly as calculated. No price is involved.</Callout> : needRates.map((c) => (
              <div key={c} className="space-y-3 rounded-row border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-h3">{c} → ZEC</h3><Badge tone="warning" icon="info">Manual rate, not an onchain conversion</Badge></div>
                <SelectField label="Approved rate snapshot" value={chosen[c] ?? ''} onChange={(e) => setChosen({ ...chosen, [c]: e.target.value })}>
                  <option value="">No rate. Rows in {c} will be held.</option>
                  {liveRates.filter((r) => r.base === c).map((r) => <option key={r.id} value={r.id}>{r.description} · {r.source} · quoted {r.quotedAt.slice(0, 16).replace('T', ' ')} UTC</option>)}
                </SelectField>
                {quoting === c ? (
                  <RateQuoteForm projectId={projectId} currency={c} rateExpiryHours={rateExpiryHours} onCancel={() => setQuoting(null)} onSaved={async (id) => {
                    const list = await api<Rate[]>(`/api/v1/projects/${projectId}/rates`);
                    if (list.ok) setRates(list.data.map((x) => ({ ...x, quotedAt: String(x.quotedAt), expiresAt: String(x.expiresAt) })));
                    setChosen((prev) => ({ ...prev, [c]: id }));
                    setQuoting(null);
                  }} />
                ) : <Button variant="secondary" icon="plus" onClick={() => setQuoting(c)}>Enter a quote</Button>}
              </div>
            ))}
            {spendableZat !== null && preview.totals.payableCount > 0 && (shortfall ? <Callout tone="warning" title="Wallet balance is below the payable total">You can still create and review the period. Approval stays blocked until the account holds enough confirmed shielded ZEC plus the network fee.</Callout> : <p className="text-body-s text-success-text"><Icon name="check" size={14} className="inline" /> Spendable shielded balance covers the payable total before network fees.</p>)}
            <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button><Button size="lg" disabled={quoting !== null} onClick={() => setStep(4)}>Continue</Button></div>
            {quoting !== null && <p className="text-body-s text-ink-secondary">Save or cancel the quote you are entering first.</p>}
          </Card>
        )}

        {step === 4 && preview && (
          <Card className="space-y-5" padded>
            {create.message && <Callout tone="danger">{create.message}</Callout>}
            <div className="overflow-x-auto">
              <table className="w-full text-body-s">
                <caption className="sr-only">Calculated rows</caption>
                <thead><tr className="border-b border-border text-left text-label text-ink-secondary"><th className="py-2 pr-3 font-medium">Partner</th><th className="py-2 pr-3 text-right font-medium">Base</th><th className="py-2 pr-3 text-right font-medium">Owed</th><th className="py-2 pr-3 text-right font-medium">ZEC</th><th className="py-2 font-medium">State</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0 align-top">
                      <td className="py-2.5 pr-3">{r.partner}</td>
                      <td className="py-2.5 pr-3 text-right">{r.base ? <Money value={r.base} currency={r.currency} /> : 'Fixed'}</td>
                      <td className="py-2.5 pr-3 text-right"><Money value={r.owed} currency={r.currency} /></td>
                      <td className="py-2.5 pr-3 text-right">{r.zat ? <Zec zat={r.zat} /> : '—'}</td>
                      <td className="py-2.5">{r.status === 'payable' ? <Badge tone="accent" icon="check">Payable</Badge> : r.status === 'nothing_owed' ? <Badge tone="neutral" icon={null}>Nothing owed</Badge> : <span className="space-y-1"><Badge tone="warning">Held</Badge>{r.holds.map((h) => <span key={h} className="block text-label text-ink-secondary">{HOLD_TEXT[h]}</span>)}</span>}</td>
                    </tr>
                  ))}
                  {preview.rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-muted">Nothing payable yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {preview.exceptions.length > 0 && <Callout tone="warning" title={`${preview.exceptions.length} exception(s) will need a decision`}>{[...new Set(preview.exceptions.map((e) => EXCEPTION_TITLE[e.code]))].join('; ')}</Callout>}
            <p className="text-body-s text-ink-secondary">Creating the draft saves this calculation and its exceptions. Nothing is approved and no funds move.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={() => setStep(3)}>Back</Button>
              <Button size="lg" busy={create.busy} disabled={!validScope} onClick={async () => {
                const r = await create.submit(`/api/v1/projects/${projectId}/periods`, { body: { ...scope, rateSnapshotIds: Object.fromEntries(Object.entries(chosen).filter(([, v]) => v)) } });
                if (r.ok) router.push(`/app/p/${projectId}/periods/${r.data.id}`);
              }}>Create draft period</Button>
            </div>
          </Card>
        )}
      </div>
      <aside>{summary}</aside>
    </div>
  );
}
