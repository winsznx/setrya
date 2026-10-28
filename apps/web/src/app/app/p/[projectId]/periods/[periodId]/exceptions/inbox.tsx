'use client';

import { ENTRY_TYPE_LABEL, EXCEPTION_TITLE, type EntryType, type ExceptionCode, ISSUE_TEXT, type IssueCode } from '@setrya/domain';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Money, MoneyGroups, Zec } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, DefinitionList } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { TextAreaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client/api';

type Decision = 'exclude' | 'include' | 'hold' | 'confirm_both' | 'leave';

export interface InboxException {
  id: string;
  code: ExceptionCode;
  severity: 'blocking' | 'warning';
  status: 'open' | 'resolved' | 'held';
  decision: string | null;
  reason: string | null;
  detail: string;
  moneyAtRisk: { amount: string; currency: string } | null;
  createdAt: string;
  partner: string | null;
  allowed: Decision[];
  entries: { id: string; externalId: string | null; description: string | null; amount: string; amountRaw: string; currency: string; type: EntryType; occurredAt: string; raw: Record<string, string>; issues: string[]; importClassification: string; periodInclusion: string }[];
  rows: { key: string; partner: string; agreement: string; owed: string; currency: string; zat: string | null; status: string }[];
}

const DECISION_LABEL: Record<Decision, { label: string; help: string }> = {
  exclude: { label: 'Exclude with reason', help: 'The row stays in the record and leaves this period’s fee base.' },
  include: { label: 'Correct classification to eligible', help: 'Count the row as realised fees in this period.' },
  hold: { label: 'Hold payment', help: 'Affected payouts stay unpaid in this revision and can carry forward at close.' },
  confirm_both: { label: 'Confirm both agreements apply', help: 'Both obligations are intended to stack on the same fees.' },
  leave: { label: 'Leave unresolved', help: 'Records your note; affected payouts stay held.' },
};

interface Preview {
  before: { owedByCurrency: Record<string, string>; payableZat: string; payableCount: number; heldCount: number };
  after: { owedByCurrency: Record<string, string>; payableZat: string; payableCount: number; heldCount: number };
  rows: { key: string; partnerId: string; currency: string; beforeOwed: string; afterOwed: string; beforeStatus: string; afterStatus: string; beforeZat: string | null; afterZat: string | null }[];
}

export function ExceptionInbox({ projectId, periodId, revision, items, readOnly, timezone }: { projectId: string; periodId: string; revision: number; items: InboxException[]; readOnly: boolean; timezone: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(sp.get('e') ?? items.find((i) => i.status === 'open')?.id ?? items[0]!.id);
  const selected = items.find((i) => i.id === selectedId) ?? items[0]!;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const { busy, message, fieldErrors, submit } = useSubmit();
  const open = items.filter((i) => i.status === 'open');

  useEffect(() => {
    setDecision(null);
    setReason('');
    setPreview(null);
  }, [selectedId]);

  useEffect(() => {
    if (!decision || readOnly) return setPreview(null);
    let cancelled = false;
    void api<Preview>(`/api/v1/projects/${projectId}/periods/${periodId}/exceptions/${selected.id}/preview`, { method: 'POST', body: { decision } }).then((r) => !cancelled && setPreview(r.ok ? r.data : null));
    return () => { cancelled = true; };
  }, [decision, selected.id, projectId, periodId, readOnly]);

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <nav aria-label="Exceptions" className="border-b border-border lg:border-b-0 lg:border-r">
          <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {items.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => setSelectedId(x.id)} aria-current={x.id === selected.id ? 'true' : undefined} className={cx('block w-full px-4 py-3 text-left', x.id === selected.id ? 'bg-accent-soft' : 'hover:bg-surface-muted')}>
                  <div className="flex items-center gap-1.5">
                    {x.status === 'open' ? (x.severity === 'blocking' ? <Badge tone="danger">Blocking</Badge> : <Badge tone="warning">Warning</Badge>) : x.status === 'held' ? <Badge tone="warning" icon="pause">Held</Badge> : <Badge tone="success">Resolved</Badge>}
                  </div>
                  <div className="mt-1 text-body-s font-medium">{EXCEPTION_TITLE[x.code]}</div>
                  <div className="text-label text-ink-secondary">{x.partner ?? (x.entries[0]?.externalId ? `Row ${x.entries[0].externalId}` : 'Shared fee base')}{x.moneyAtRisk ? ' · ' : ''}{x.moneyAtRisk && <Money value={x.moneyAtRisk.amount} currency={x.moneyAtRisk.currency} />}</div>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="exception-title" className="min-w-0 space-y-5 border-b border-border p-4 md:p-5 lg:border-b-0 lg:border-r">
          <div>
            <h2 id="exception-title" className="text-h2">{EXCEPTION_TITLE[selected.code]}</h2>
            <p className="mt-1 text-body-s text-ink-secondary">{selected.detail}</p>
            <p className="mt-1 text-label text-ink-muted">Raised {new Date(selected.createdAt).toLocaleString('en-GB', { timeZone: timezone })} · code {selected.code}</p>
          </div>
          {selected.status !== 'open' && selected.reason && <Callout tone={selected.status === 'resolved' ? 'success' : 'warning'} title={`Decision: ${DECISION_LABEL[(selected.decision ?? 'leave') as Decision]?.label ?? selected.decision}`}>{selected.reason}</Callout>}
          {selected.entries.map((e) => (
            <div key={e.id} className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-row border border-border p-3">
                <h3 className="mb-2 text-body-s font-semibold">Original record</h3>
                <DefinitionList stacked items={Object.entries(e.raw).map(([k, v]) => ({ term: k, detail: <span className="break-all">{v || '—'}</span> }))} />
              </div>
              <div className="rounded-row border border-border p-3">
                <h3 className="mb-2 text-body-s font-semibold">Normalised interpretation</h3>
                <DefinitionList stacked items={[
                  { term: 'Amount', detail: <Money value={e.amount} currency={e.currency} /> },
                  { term: 'Type', detail: ENTRY_TYPE_LABEL[e.type] },
                  { term: 'Occurred', detail: `${e.occurredAt.slice(0, 16).replace('T', ' ')} UTC` },
                  { term: 'Import decision', detail: e.importClassification },
                  { term: 'This period', detail: e.periodInclusion },
                  { term: 'Why flagged', detail: e.issues.length ? e.issues.map((i) => ISSUE_TEXT[i as IssueCode] ?? i).join('; ') : 'Classified as unresolved' },
                ]} />
              </div>
            </div>
          ))}
          {selected.rows.length > 0 && (
            <div>
              <h3 className="mb-2 text-body-s font-semibold">Affected payouts</h3>
              <ul className="divide-y divide-border rounded-row border border-border">
                {selected.rows.map((r) => (
                  <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-body-s">
                    <span><span className="font-medium">{r.partner}</span> <span className="text-ink-secondary">· {r.agreement}</span></span>
                    <span className="flex items-center gap-2"><Money value={r.owed} currency={r.currency} />{r.status === 'held' ? <Badge tone="warning">Held</Badge> : <Badge tone="accent" icon={null}>{r.status}</Badge>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside aria-label="Decision" className="space-y-4 p-4 md:p-5">
          <h2 className="text-h3">Decision</h2>
          {readOnly ? <p className="text-body-s text-ink-secondary">This revision is frozen.</p> : (
            <>
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose a decision</legend>
                {selected.allowed.map((dk) => (
                  <label key={dk} className={cx('flex cursor-pointer gap-3 rounded-row border p-3', decision === dk ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}>
                    <input type="radio" name="decision" className="mt-1" checked={decision === dk} onChange={() => setDecision(dk)} />
                    <span><span className="block text-body-s font-medium">{DECISION_LABEL[dk].label}</span><span className="block text-label text-ink-secondary">{DECISION_LABEL[dk].help}</span></span>
                  </label>
                ))}
              </fieldset>
              {selected.code === 'RATE_MISSING' && <p className="text-body-s text-ink-secondary">To pay instead of hold, attach an approved rate in Conversion rates on the <a className="text-accent-text hover:underline" href={`/app/p/${projectId}/periods/${periodId}`}>period page</a>. The exception resolves itself on recalculation.</p>}
              {selected.code === 'ADDRESS_INVALID' && <p className="text-body-s text-ink-secondary">An owner override never bypasses the address check. Fix the address on the partner profile, then recalculate.</p>}
              {preview && (
                <div className="space-y-2 rounded-row bg-surface-muted p-3 text-body-s" aria-live="polite">
                  <div className="font-medium">Preview before saving</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-label text-ink-muted">Owed now</div><MoneyGroups groups={preview.before.owedByCurrency} /></div>
                    <div><div className="text-label text-ink-muted">Owed after</div><MoneyGroups groups={preview.after.owedByCurrency} /></div>
                    <div><div className="text-label text-ink-muted">Payable now</div>{preview.before.payableCount} · <Zec zat={preview.before.payableZat} /></div>
                    <div><div className="text-label text-ink-muted">Payable after</div>{preview.after.payableCount} · <Zec zat={preview.after.payableZat} /></div>
                  </div>
                  {preview.rows.length > 0 && <ul className="space-y-1 border-t border-border pt-2">{preview.rows.map((r) => <li key={r.key} className="flex justify-between gap-2"><span className="text-ink-secondary">{r.beforeStatus} → {r.afterStatus}</span><span><Money value={r.beforeOwed} currency={r.currency} /> → <Money value={r.afterOwed} currency={r.currency} /></span></li>)}</ul>}
                </div>
              )}
              <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} hint="Recorded with the decision. Decisions can be changed only while the period is a draft." />
              {message && <Callout tone="danger">{message}</Callout>}
              <Button full busy={busy} disabled={!decision || reason.trim().length < 3} onClick={async () => {
                const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/exceptions/${selected.id}/resolve`, { body: { decision, reason, expectedRevision: revision } });
                if (r.ok) {
                  toast('success', 'Decision saved and the period recalculated.');
                  const next = open.find((x) => x.id !== selected.id);
                  if (next) setSelectedId(next.id);
                  router.refresh();
                }
              }}>Save decision</Button>
            </>
          )}
        </aside>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted px-4 py-3 md:px-5">
        <span className="text-body-s" aria-live="polite"><span className="font-semibold tnum">{open.length}</span> unresolved · {items.filter((i) => i.status === 'open' && i.severity === 'blocking').length} blocking</span>
        <a href={`/app/p/${projectId}/periods/${periodId}`} className="text-body-s font-medium text-accent-text hover:underline">Back to period</a>
      </footer>
    </div>
  );
}
