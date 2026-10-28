'use client';

import { describeTerms, formatGrouped, min, mul, parseDec, shift, type AgreementTerms } from '@setrya/domain';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, ChoiceCards, DecimalField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

import { useSubmit } from './use-submit';

interface Option {
  id: string;
  name: string;
  currency?: string;
  active?: boolean;
}

export interface AgreementDraft {
  partnerId: string;
  sourceIds: string[];
  title: string;
  externalRef: string;
  effectiveFrom: string;
  effectiveTo: string;
  kind: 'percentage' | 'fixed';
  ratePct: string;
  refundTreatment: 'net_adjustment' | 'exclude';
  capAmount: string;
  poolSemantics: 'exclusive' | 'independent';
  overcommitAcknowledged: boolean;
  fixedAmount: string;
  fixedCurrency: string;
  conversionBasis: 'zec_denominated' | 'rate_snapshot';
  cadence: 'per_period' | 'weekly' | 'monthly';
  basisDefinition: string;
  exclusions: string;
  notes: string;
}

export function termsFromDraft(d: AgreementDraft, capCurrency: string): AgreementTerms {
  const common = { basisDefinition: d.basisDefinition, exclusions: d.exclusions, cadence: d.cadence, notes: d.notes, overcommitAcknowledged: d.overcommitAcknowledged };
  return d.kind === 'percentage'
    ? { kind: 'percentage', ratePct: d.ratePct.trim(), refundTreatment: d.refundTreatment, cap: d.capAmount.trim() ? { amount: d.capAmount.trim(), currency: capCurrency } : null, poolSemantics: d.poolSemantics, conversionBasis: capCurrency === 'ZEC' ? 'zec_denominated' : 'rate_snapshot', ...common }
    : { kind: 'fixed', amount: d.fixedAmount.trim(), currency: d.fixedCurrency, poolSemantics: 'independent', conversionBasis: d.fixedCurrency === 'ZEC' ? 'zec_denominated' : 'rate_snapshot', ...common };
}

export function draftFromTerms(base: Omit<AgreementDraft, 'kind' | 'ratePct' | 'refundTreatment' | 'capAmount' | 'poolSemantics' | 'overcommitAcknowledged' | 'fixedAmount' | 'fixedCurrency' | 'conversionBasis' | 'cadence' | 'basisDefinition' | 'exclusions' | 'notes'>, t: AgreementTerms, projectCurrency: string): AgreementDraft {
  return {
    ...base,
    kind: t.kind,
    ratePct: t.kind === 'percentage' ? t.ratePct : '10',
    refundTreatment: t.kind === 'percentage' ? t.refundTreatment : 'net_adjustment',
    capAmount: t.kind === 'percentage' ? (t.cap?.amount ?? '') : '',
    poolSemantics: t.kind === 'percentage' ? t.poolSemantics : 'independent',
    overcommitAcknowledged: t.overcommitAcknowledged,
    fixedAmount: t.kind === 'fixed' ? t.amount : '',
    fixedCurrency: t.kind === 'fixed' ? t.currency : projectCurrency,
    conversionBasis: t.conversionBasis,
    cadence: t.cadence,
    basisDefinition: t.basisDefinition,
    exclusions: t.exclusions,
    notes: t.notes,
  };
}

function safeExample(d: AgreementDraft, exampleBase: string): string | null {
  try {
    if (d.kind === 'fixed') return d.fixedAmount ? formatGrouped(parseDec(d.fixedAmount, 8), 2, 8) : null;
    const owed = shift(mul(parseDec(exampleBase, 8), parseDec(d.ratePct, 4)), 2);
    return formatGrouped(d.capAmount ? min(owed, parseDec(d.capAmount, 8)) : owed, 2, 8);
  } catch {
    return null;
  }
}

interface Check {
  overcommitted: { sourceId: string; totalPct: string }[];
  needsIndependentAck: { sourceId: string; totalPct: string }[];
  overlapsSamePartner: string[];
}

export function AgreementForm({ projectId, projectCurrency, partners, sources, initial, mode, agreementId, expectedVersion, previous, onDone }: {
  projectId: string;
  projectCurrency: string;
  partners: Option[];
  sources: Option[];
  initial: AgreementDraft;
  mode: 'create' | 'revision';
  agreementId?: string;
  expectedVersion?: number;
  previous?: { version: number; summary: string; effectiveFrom: string };
  onDone: (id: string) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [exampleBase, setExampleBase] = useState('1000.00');
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const { busy, message, fieldErrors, submit } = useSubmit<{ id?: string; version?: number }>();
  const set = <K extends keyof AgreementDraft>(k: K, v: AgreementDraft[K]) => setD((s) => ({ ...s, [k]: v }));
  const sourceCurrency = sources.find((s) => s.id === d.sourceIds[0])?.currency ?? projectCurrency;
  const terms = useMemo(() => termsFromDraft(d, sourceCurrency), [d, sourceCurrency]);
  const example = safeExample(d, exampleBase);

  useEffect(() => {
    if (!d.partnerId || d.sourceIds.length === 0 || !d.effectiveFrom) return setCheck(null);
    const t = setTimeout(async () => {
      const r = await api<Check>(`/api/v1/projects/${projectId}/agreements/check`, { method: 'POST', body: { agreementId: agreementId ?? null, partnerId: d.partnerId, sourceIds: d.sourceIds, effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo || null, terms } });
      setCheck(r.ok ? r.data : null);
    }, 400);
    return () => clearTimeout(t);
  }, [projectId, agreementId, d.partnerId, d.sourceIds, d.effectiveFrom, d.effectiveTo, terms]);

  const save = async (activate: boolean) => {
    const r =
      mode === 'create'
        ? await submit(`/api/v1/projects/${projectId}/agreements`, { body: { partnerId: d.partnerId, sourceIds: d.sourceIds, title: d.title, externalRef: d.externalRef, effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo || null, terms, activate, acknowledgeSnapshot: ack } })
        : await submit(`/api/v1/projects/${projectId}/agreements/${agreementId}/revisions`, { body: { effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo || null, terms, reason, activate, expectedVersion } });
    if (r.ok) onDone(r.data.id ?? agreementId ?? '');
  };

  const blockers = [check?.overcommitted.length ? 'Exclusive shares on a source would exceed 100%' : null, check?.needsIndependentAck.length && !d.overcommitAcknowledged ? 'Acknowledge the independent overcommitment' : null].filter(Boolean) as string[];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void save(true); }}>
        {message && <Callout tone="danger">{message}</Callout>}
        {mode === 'revision' && previous && (
          <Callout tone="info" title={`You're creating version ${previous.version + 1}. Historical calculations do not change.`}>
            Version {previous.version}: {previous.summary}, effective from {previous.effectiveFrom}. Activating this revision supersedes it from the new effective date for future calculations only.
          </Callout>
        )}

        <Card className="space-y-5">
          <h2 className="text-h3">Parties</h2>
          {mode === 'create' ? (
            <>
              <SelectField label="Partner" value={d.partnerId} onChange={(e) => set('partnerId', e.target.value)} error={fieldErrors.partnerId} required>
                <option value="">Choose a partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.active === false}>{p.name}{p.active === false ? ' (inactive)' : ''}</option>
                ))}
              </SelectField>
              <fieldset>
                <legend className="mb-2 text-body-s font-medium">Revenue sources</legend>
                <div className="space-y-2">
                  {sources.map((s) => (
                    <CheckboxField key={s.id} label={`${s.name} (${s.currency})`} checked={d.sourceIds.includes(s.id)} onChange={(e) => set('sourceIds', e.target.checked ? [...d.sourceIds, s.id] : d.sourceIds.filter((x) => x !== s.id))} />
                  ))}
                </div>
                {fieldErrors.sourceIds && <p className="mt-1 text-body-s text-danger-text">{fieldErrors.sourceIds}</p>}
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Agreement label" placeholder="Creator share 2026" value={d.title} onChange={(e) => set('title', e.target.value)} error={fieldErrors.title} required />
                <TextField label="External contract reference" optional value={d.externalRef} onChange={(e) => set('externalRef', e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Effective from" type="date" value={d.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} error={fieldErrors.effectiveFrom} required />
            <TextField label="Effective until" type="date" optional value={d.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} error={fieldErrors.effectiveTo} hint="Exclusive. Leave empty for open-ended." />
          </div>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-h3">Entitlement</h2>
          <ChoiceCards
            legend="Rule"
            name="kind"
            value={d.kind}
            onChange={(k) => set('kind', k)}
            options={[
              { value: 'percentage', label: 'Percentage of eligible realised fees', description: 'Applied to the period’s eligible fee base for the chosen sources.' },
              { value: 'fixed', label: 'Fixed amount per period', description: 'Owed once for each period the agreement covers.' },
            ]}
          />
          {d.kind === 'percentage' ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <DecimalField maxDecimals={4} label="Rate" suffix="%" value={d.ratePct} onChange={(e) => set('ratePct', e.target.value)} error={fieldErrors['terms.ratePct']} hint="Up to 4 decimal places." required />
                <DecimalField maxDecimals={8} label="Cap per period" optional suffix={sourceCurrency} value={d.capAmount} onChange={(e) => set('capAmount', e.target.value)} error={fieldErrors['terms.cap.amount']} />
              </div>
              <SelectField label="Refunds and chargebacks" value={d.refundTreatment} onChange={(e) => set('refundTreatment', e.target.value as AgreementDraft['refundTreatment'])}>
                <option value="net_adjustment">Reduce the fee base (negative adjustment)</option>
                <option value="exclude">Ignore refunds for this agreement</option>
              </SelectField>
              <ChoiceCards
                legend="How this share relates to other agreements on the same fees"
                name="pool"
                value={d.poolSemantics}
                onChange={(p) => set('poolSemantics', p)}
                options={[
                  { value: 'exclusive', label: 'Share of one pool', description: 'All exclusive shares on a source must total 100% or less.' },
                  { value: 'independent', label: 'Independent obligation', description: 'Paid from your own balance even if shares exceed 100%.' },
                ]}
              />
            </>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <DecimalField maxDecimals={8} label="Amount" value={d.fixedAmount} onChange={(e) => set('fixedAmount', e.target.value)} error={fieldErrors['terms.amount']} required />
              <SelectField label="Currency" value={d.fixedCurrency} onChange={(e) => set('fixedCurrency', e.target.value)} hint={d.fixedCurrency === 'ZEC' ? 'Paid exactly, no price involved.' : 'Converted with a rate snapshot you approve per period.'}>
                <option value="ZEC">ZEC</option>
                {projectCurrency !== 'ZEC' && <option value={projectCurrency}>{projectCurrency}</option>}
              </SelectField>
            </div>
          )}
          {check && check.needsIndependentAck.length > 0 && (
            <CheckboxField checked={d.overcommitAcknowledged} onChange={(e) => set('overcommitAcknowledged', e.target.checked)} label={`Independent commissions on this source total ${check.needsIndependentAck[0]!.totalPct}% of fees. I will fund the difference from my own balance.`} error={fieldErrors['terms.overcommitAcknowledged']} />
          )}
        </Card>

        <Card className="space-y-5">
          <h2 className="text-h3">Payment and terms</h2>
          <p className="text-body-s text-ink-secondary">Settled in ZEC from your shielded account. Network fees are paid by you, never deducted from the partner. The payout address comes from the partner profile. Setrya performs no onchain conversion.</p>
          <SelectField label="Settlement cadence" value={d.cadence} onChange={(e) => set('cadence', e.target.value as AgreementDraft['cadence'])}>
            <option value="per_period">Each settlement period</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </SelectField>
          <TextAreaField label="Basis definition" optional placeholder="Net creator fees shown on the launchpad payout report, after platform fees." value={d.basisDefinition} onChange={(e) => set('basisDefinition', e.target.value)} />
          <TextAreaField label="Exclusions" optional value={d.exclusions} onChange={(e) => set('exclusions', e.target.value)} />
          <TextAreaField label="Operator notes" optional value={d.notes} onChange={(e) => set('notes', e.target.value)} hint="Private." />
          {mode === 'create' ? (
            <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="Terms will be snapshotted when a period is frozen" hint="Later revisions never change a frozen or paid period." error={fieldErrors.acknowledgeSnapshot} />
          ) : (
            <TextAreaField label="Reason for this revision" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} required />
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" busy={busy} disabled={blockers.length > 0 || (mode === 'create' && !ack)}>{mode === 'create' ? 'Activate' : 'Activate revision'}</Button>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => void save(false)}>Save as draft</Button>
          <Button variant="ghost" size="lg" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <h2 className="text-h3">Formula</h2>
          <p className="mt-2 font-serif text-[1.125rem] leading-snug">{(() => { try { return describeTerms(terms); } catch { return 'Complete the rule'; } })()}</p>
          {d.kind === 'percentage' && (
            <p className="mt-2 text-body-s text-ink-secondary">owed = eligible fee base × {d.ratePct || '?'}%{d.capAmount ? `, capped at ${d.capAmount} ${sourceCurrency}` : ''}</p>
          )}
          {previous && mode === 'revision' && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-body-s">
              <div>
                <div className="text-micro text-ink-muted">Version {previous.version}</div>
                <div>{previous.summary}</div>
              </div>
              <div>
                <div className="text-micro text-ink-muted">Version {previous.version + 1}</div>
                <div className="font-medium">{(() => { try { return describeTerms(terms); } catch { return '—'; } })()}</div>
              </div>
            </div>
          )}
        </Card>
        <Card muted>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-h3">Worked example</h2>
            <Badge tone="sample" icon={null}>Example only</Badge>
          </div>
          {d.kind === 'percentage' && (
            <DecimalField maxDecimals={8} label="Sample fee base" suffix={sourceCurrency} value={exampleBase} onChange={(e) => setExampleBase(e.target.value)} fieldClassName="mt-3" />
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-body-s text-ink-secondary">Would be owed</span>
            <span className="text-figure-s tnum">{example ?? '—'} <span className="text-body-s text-ink-muted">{d.kind === 'fixed' ? d.fixedCurrency : sourceCurrency}</span></span>
          </div>
          <p className="mt-2 text-body-s text-ink-muted">Illustrative arithmetic, not an amount payable. Real amounts come from imported fees in a settlement period.</p>
        </Card>
        {check && (check.overcommitted.length > 0 || check.overlapsSamePartner.length > 0) && (
          <Callout tone="warning" title="Overlapping terms">
            {check.overcommitted.length > 0 && <p>Exclusive shares on this source would total {check.overcommitted[0]!.totalPct}%. Activation is blocked until they total 100% or less.</p>}
            {check.overlapsSamePartner.length > 0 && <p className="mt-1">This partner already has an active agreement on the same fees ({check.overlapsSamePartner.join(', ')}). Periods will hold both until you confirm they are meant to stack.</p>}
          </Callout>
        )}
      </aside>
    </div>
  );
}
