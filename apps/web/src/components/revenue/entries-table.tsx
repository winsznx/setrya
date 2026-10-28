'use client';

import { ENTRY_TYPE_LABEL, ENTRY_TYPES, type EntryType, ISSUE_TEXT, type IssueCode } from '@setrya/domain';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Money } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, DefinitionList } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextAreaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useSubmit } from '@/components/forms/use-submit';

export interface EntryRow {
  id: string;
  batchId: string | null;
  sourceName: string;
  externalId: string | null;
  description: string | null;
  reference: string | null;
  amount: string;
  amountRaw: string;
  currency: string;
  occurredAt: string;
  occurredLabel: string;
  type: EntryType;
  classification: 'eligible' | 'excluded' | 'held';
  issues: IssueCode[];
  note: string | null;
  raw: Record<string, string>;
  rowHash: string;
  rowIndex: number | null;
  origin: string;
  periodIds: string[];
  locked: boolean;
}

const CLASS_BADGE = { eligible: <Badge tone="success">Eligible</Badge>, excluded: <Badge tone="neutral" icon="x">Excluded</Badge>, held: <Badge tone="warning">Unresolved</Badge> };

export function EntriesTable({ projectId, rows, readOnly }: { projectId: string; rows: EntryRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<EntryRow | null>(null);
  const [bulk, setBulk] = useState<null | { classification: 'eligible' | 'excluded' | 'held'; type: EntryType | ''; reason: string }>(null);
  const { busy, message, fieldErrors, submit } = useSubmit<{ updated: number }>();
  const selectable = rows.filter((r) => !r.locked);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      {!readOnly && selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-accent-soft px-4 py-2.5 md:px-5" role="region" aria-label="Bulk actions">
          <span className="text-body-s font-medium">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setBulk({ classification: 'eligible', type: '', reason: '' })}>Mark eligible</Button>
          <Button size="sm" variant="secondary" onClick={() => setBulk({ classification: 'excluded', type: '', reason: '' })}>Exclude</Button>
          <Button size="sm" variant="secondary" onClick={() => setBulk({ classification: 'held', type: '', reason: '' })}>Flag for review</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-body-s">
          <caption className="sr-only">Revenue entries</caption>
          <thead>
            <tr className="border-b border-border text-left text-label text-ink-secondary">
              {!readOnly && (
                <th scope="col" className="w-10 py-2.5 pl-5">
                  <input type="checkbox" aria-label="Select all unlocked rows" checked={selectable.length > 0 && selected.size === selectable.length} onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set())} />
                </th>
              )}
              <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Source and reference</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Description</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Classification</th>
              <th scope="col" className="px-4 py-2.5 pr-5 font-medium">Period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cx('border-b border-border last:border-0 hover:bg-surface-muted', selected.has(r.id) && 'bg-accent-soft/60')}>
                {!readOnly && (
                  <td className="py-3 pl-5 align-top">
                    <input type="checkbox" aria-label={`Select row ${r.externalId ?? r.id.slice(0, 6)}`} disabled={r.locked} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 align-top">{r.occurredLabel}</td>
                <td className="px-4 py-3 align-top">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => setDetail(r)}>{r.sourceName}</button>
                  <div className="text-label text-ink-muted">{r.externalId ?? r.reference ?? 'no reference'}</div>
                </td>
                <td className="max-w-[18rem] px-4 py-3 align-top">
                  <div className="truncate">{r.description ?? '—'}</div>
                  {r.issues.filter((i) => i !== 'MISSING_EXTERNAL_ID').length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.issues.filter((i) => i !== 'MISSING_EXTERNAL_ID').slice(0, 2).map((i) => <Badge key={i} tone="warning">{ISSUE_TEXT[i]}</Badge>)}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right align-top"><Money value={r.amount} currency={r.currency} /></td>
                <td className="whitespace-nowrap px-4 py-3 align-top">{ENTRY_TYPE_LABEL[r.type]}</td>
                <td className="px-4 py-3 align-top">{CLASS_BADGE[r.classification]}</td>
                <td className="px-4 py-3 pr-5 align-top">{r.periodIds.length ? <Link prefetch={false} href={`/app/p/${projectId}/periods/${r.periodIds[0]}`} className="text-accent-text hover:underline">Linked</Link> : <span className="text-ink-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-3 px-4 py-3.5">
            {!readOnly && <input type="checkbox" className="mt-1" aria-label="Select row" disabled={r.locked} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
            <button type="button" onClick={() => setDetail(r)} className="min-w-0 flex-1 text-left">
              <div className="flex items-baseline justify-between gap-2"><Money value={r.amount} currency={r.currency} className="font-semibold" />{CLASS_BADGE[r.classification]}</div>
              <div className="mt-0.5 truncate text-body-s">{r.description ?? r.sourceName}</div>
              <div className="text-label text-ink-muted">{r.occurredLabel} · {ENTRY_TYPE_LABEL[r.type]}</div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={detail !== null} onClose={() => setDetail(null)} title="Revenue entry" wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3"><Money value={detail.amount} currency={detail.currency} className="text-figure-s" />{CLASS_BADGE[detail.classification]}</div>
            {detail.locked && <Callout tone="info">This row belongs to a frozen or closed period. Corrections go into a later period as an adjustment, so the original stays as it was.</Callout>}
            <DefinitionList items={[
              { term: 'Normalised as', detail: `${ENTRY_TYPE_LABEL[detail.type]}, ${detail.amount} ${detail.currency}, ${detail.occurredAt} UTC` },
              { term: 'Raw amount cell', detail: <code className="font-mono text-[0.8125rem]">{detail.amountRaw}</code> },
              { term: 'Operator note', detail: detail.note ?? '—' },
              { term: 'Issues', detail: detail.issues.length ? detail.issues.map((i) => ISSUE_TEXT[i]).join('; ') : 'None' },
              { term: 'Origin', detail: detail.origin === 'manual' ? 'Manual entry' : detail.batchId ? <Link prefetch={false} className="text-accent-text hover:underline" href={`/app/p/${projectId}/revenue/import/${detail.batchId}`}>Import batch, row {(detail.rowIndex ?? 0) + 1}</Link> : 'Import' },
              { term: 'Row fingerprint', detail: <code className="break-all font-mono text-[0.75rem]">{detail.rowHash}</code> },
            ]} />
            <div>
              <h3 className="mb-2 text-h3">Original fields</h3>
              <DefinitionList items={Object.entries(detail.raw).map(([k, v]) => ({ term: k, detail: <span className="break-all">{v || '—'}</span> }))} />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        title={`Reclassify ${selected.size} row${selected.size === 1 ? '' : 's'}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(null)}>Cancel</Button>
            <Button
              busy={busy}
              onClick={async () => {
                const r = await submit(`/api/v1/projects/${projectId}/revenue/classify`, { body: { entryIds: [...selected], classification: bulk!.classification, type: bulk!.type || null, reason: bulk!.reason } });
                if (r.ok) {
                  toast('success', `${r.data.updated} row${r.data.updated === 1 ? '' : 's'} reclassified. The change is in Activity.`);
                  setBulk(null);
                  setSelected(new Set());
                  router.refresh();
                }
              }}
            >
              Apply with reason
            </Button>
          </>
        }
      >
        {bulk && (
          <div className="space-y-4">
            {message && <Callout tone="danger">{message}</Callout>}
            <SelectField label="Classification" value={bulk.classification} onChange={(e) => setBulk({ ...bulk, classification: e.target.value as typeof bulk.classification })}>
              <option value="eligible">Eligible</option>
              <option value="excluded">Excluded</option>
              <option value="held">Held for review</option>
            </SelectField>
            <SelectField label="Entry type" optional value={bulk.type} onChange={(e) => setBulk({ ...bulk, type: e.target.value as EntryType | '' })}>
              <option value="">Keep each row’s type</option>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{ENTRY_TYPE_LABEL[t]}</option>)}
            </SelectField>
            <TextAreaField label="Reason" value={bulk.reason} onChange={(e) => setBulk({ ...bulk, reason: e.target.value })} error={fieldErrors.reason} required hint="Recorded with your name and the time in the audit trail." />
          </div>
        )}
      </Dialog>
    </div>
  );
}
