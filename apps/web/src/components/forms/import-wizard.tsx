'use client';

import { type Classification, decToString, ENTRY_TYPE_LABEL, ENTRY_TYPES, type EntryType, ISSUE_TEXT, type IssueCode, MAPPABLE_FIELDS, type MappableField, parseDec, sum } from '@setrya/domain';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Money } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { CheckboxField, SelectField } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';

import { useSubmit } from './use-submit';
import { timeZones } from '@/lib/client/time-zones';

interface SourceOption {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

interface Preview {
  token: string;
  filename: string;
  fileHash: string;
  delimiter: string;
  rowCount: number;
  header: string[];
  sample: string[][];
  guessedMapping: Partial<Record<MappableField, number>>;
  duplicateOfImportId: string | null;
}

interface Row {
  rowIndex: number;
  externalId: string | null;
  occurredAt: string | null;
  amountRaw: string;
  amount: string | null;
  currency: string;
  description: string;
  type: EntryType;
  issues: IssueCode[];
  suggested: Classification;
  suggestedNote: string;
  unusable: boolean;
}

const FIELD_LABEL: Record<MappableField, string> = { date: 'Date', amount: 'Amount', currency: 'Currency', externalId: 'External ID', description: 'Description', status: 'Status', type: 'Fee type', feePeriod: 'Fee period', reference: 'Reference' };
const STEPS = ['Upload', 'Map columns', 'Classify', 'Commit'];
const MAX_MB = 5;

export function ImportWizard({ projectId, sources, defaultSourceId, onCommitted, onSkip }: { projectId: string; sources: SourceOption[]; defaultSourceId?: string; onCommitted: (importId: string) => void; onSkip?: () => void }) {
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState(defaultSourceId ?? sources[0]?.id ?? '');
  const source = sources.find((s) => s.id === sourceId);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<MappableField, number>>>({});
  const [dateFormat, setDateFormat] = useState<'iso' | 'mdy' | 'dmy'>('iso');
  const [decimalSeparator, setDecimalSeparator] = useState<'.' | ','>('.');
  const [timeZone, setTimeZone] = useState(source?.timezone ?? 'UTC');
  const [rows, setRows] = useState<Row[]>([]);
  const [decisions, setDecisions] = useState<Record<number, { classification: Classification; type: EntryType; note: string }>>({});
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip_duplicates' | 'import_as_held'>('skip_duplicates');
  const [ack, setAck] = useState(false);
  const up = useSubmit<Preview>();
  const norm = useSubmit<{ rows: Row[] }>();
  const commit = useSubmit<{ importId: string }>();

  const decisionFor = (r: Row) => decisions[r.rowIndex] ?? { classification: r.suggested, type: r.type, note: r.suggestedNote };
  const missingRequired = !('date' in mapping && mapping.date !== undefined) || mapping.amount === undefined;

  const counts = useMemo(() => {
    const usable = rows.filter((r) => !r.unusable && r.occurredAt !== null);
    const dup = usable.filter((r) => r.issues.includes('DUPLICATE_EXISTING') || r.issues.includes('DUPLICATE_IN_FILE'));
    const willImport = usable.filter((r) => !(duplicatePolicy === 'skip_duplicates' && r.issues.includes('DUPLICATE_EXISTING')));
    const by = (c: Classification) => willImport.filter((r) => decisionFor(r).classification === c);
    const totals = (list: Row[]) => {
      const m = new Map<string, string[]>();
      for (const r of list) if (r.amount) m.set(r.currency, [...(m.get(r.currency) ?? []), r.amount]);
      return Object.fromEntries([...m].map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))]));
    };
    return { rejected: rows.length - usable.length, duplicates: dup.length, eligible: by('eligible'), held: by('held'), excluded: by('excluded'), willImport, totals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, decisions, duplicatePolicy]);

  const exclusionsMissingNotes = rows.filter((r) => decisionFor(r).classification === 'excluded' && decisionFor(r).note.trim() === '').length;

  async function upload(f: File) {
    setFile(f);
    if (f.size > MAX_MB * 1024 * 1024) return up.setMessage(`This file is larger than ${MAX_MB} MB.`);
    const form = new FormData();
    form.set('file', f);
    form.set('sourceId', sourceId);
    const r = await up.submit(`/api/v1/projects/${projectId}/imports/preview`, { form });
    if (r.ok) {
      setPreview(r.data);
      setMapping(r.data.guessedMapping);
      setTimeZone(source?.timezone ?? 'UTC');
    }
  }

  async function normalize() {
    const r = await norm.submit(`/api/v1/projects/${projectId}/imports/normalize`, { body: { token: preview!.token, sourceId, mapping, dateFormat, decimalSeparator, timeZone } });
    if (r.ok) {
      setRows(r.data.rows);
      setDecisions({});
      setStep(2);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Import steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-pill px-3 py-1.5 text-body-s', i === step ? 'bg-brand text-on-brand' : i < step ? 'bg-success-soft text-success-text' : 'bg-surface-muted text-ink-muted')}>
            <span className="tnum">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="space-y-5">
          {up.message && <Callout tone="danger" title="The file was not imported">{up.message}</Callout>}
          <SelectField label="Revenue source" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setPreview(null); }}>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
            ))}
          </SelectField>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void upload(f); }}
            className={cx('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed px-6 py-10 text-center transition-colors', dragging ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface-muted hover:border-ink-muted')}
          >
            <Icon name="upload" size={24} className="text-ink-secondary" />
            <span className="text-body font-medium">{up.busy ? 'Reading file…' : 'Drop a CSV here or choose a file'}</span>
            <span className="text-body-s text-ink-secondary">UTF-8 CSV, up to {MAX_MB} MB and 20,000 rows. Processed on this host only.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} disabled={!sourceId || up.busy} />
          </label>
          <p className="text-body-s text-ink-secondary">
            Need a starting point? <a href="/templates/setrya-revenue-template.csv" download className="text-accent-text hover:underline">Download the template</a> with columns external_id, occurred_at, description, amount, currency, fee_type, status, source_reference.
          </p>
          {preview && (
            <div className="space-y-3 rounded-row border border-border p-4">
              <div className="grid gap-2 text-body-s sm:grid-cols-2">
                <div><span className="text-ink-muted">File</span> {preview.filename}</div>
                <div><span className="text-ink-muted">Rows</span> <span className="tnum">{preview.rowCount}</span> · delimiter {preview.delimiter}</div>
                <div className="sm:col-span-2 break-all"><span className="text-ink-muted">SHA-256</span> <span className="font-mono text-[0.75rem]">{preview.fileHash}</span></div>
                <div><span className="text-ink-muted">Size</span> {file ? `${Math.ceil(file.size / 1024)} KB` : ''}</div>
              </div>
              {preview.duplicateOfImportId && (
                <Callout tone="warning" title="This exact file was already imported for this source">
                  Committing it again is refused. <Link prefetch={false} href={`/app/p/${projectId}/revenue/import/${preview.duplicateOfImportId}`} className="text-accent-text hover:underline">Open the existing import</Link>.
                </Callout>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={!preview || preview.duplicateOfImportId !== null} onClick={() => setStep(1)}>Preview mapping</Button>
            {onSkip && <Button variant="ghost" size="lg" onClick={onSkip}>Skip for now</Button>}
          </div>
        </Card>
      )}

      {step === 1 && preview && (
        <Card className="space-y-5">
          {norm.message && <Callout tone="danger">{norm.message}</Callout>}
          <div className="grid gap-4 sm:grid-cols-3">
            {MAPPABLE_FIELDS.map((f) => (
              <SelectField key={f} label={FIELD_LABEL[f]} optional={f !== 'date' && f !== 'amount'} value={mapping[f] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === '' ? undefined : Number(e.target.value) }))} error={norm.fieldErrors[`mapping.${f}`]}>
                <option value="">Not mapped</option>
                {preview.header.map((h, i) => (
                  <option key={i} value={i} disabled={Object.entries(mapping).some(([k, v]) => k !== f && v === i)}>{h || `Column ${i + 1}`}</option>
                ))}
              </SelectField>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Date format" value={dateFormat} onChange={(e) => setDateFormat(e.target.value as typeof dateFormat)}>
              <option value="iso">YYYY-MM-DD (ISO)</option>
              <option value="mdy">MM/DD/YYYY</option>
              <option value="dmy">DD/MM/YYYY</option>
            </SelectField>
            <SelectField label="Decimal separator" value={decimalSeparator} onChange={(e) => setDecimalSeparator(e.target.value as '.' | ',')}>
              <option value=".">1,234.56</option>
              <option value=",">1.234,56</option>
            </SelectField>
            <SelectField label="Time zone for dates without one" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {timeZones().map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </SelectField>
          </div>
          <div className="overflow-x-auto rounded-row border border-border">
            <table className="w-full text-body-s">
              <caption className="sr-only">First ten rows of the file</caption>
              <thead className="bg-surface-muted">
                <tr>
                  {preview.header.map((h, i) => {
                    const field = (Object.entries(mapping) as [MappableField, number][]).find(([, v]) => v === i)?.[0];
                    return (
                      <th key={i} scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                        <div>{h || `Column ${i + 1}`}</div>
                        <div className={cx('text-micro', field ? 'text-accent-text' : 'text-ink-muted')}>{field ? `→ ${FIELD_LABEL[field]}` : 'ignored'}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {preview.header.map((_, j) => (
                      <td key={j} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5">{r[j]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
            <Button size="lg" busy={norm.busy} disabled={missingRequired} onClick={() => void normalize()}>Continue to classify</Button>
          </div>
          {missingRequired && <p className="text-body-s text-warning-text">Map a date and an amount column to continue.</p>}
        </Card>
      )}

      {step === 2 && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 md:p-5">
            <div className="text-body-s text-ink-secondary">
              Suggestions below are a starting point. Every exclusion needs a note. No row is classified without your review.
            </div>
            <CheckboxField label="Only rows with issues" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          </div>
          <ul className="divide-y divide-border">
            {rows.filter((r) => !issuesOnly || r.issues.some((i) => i !== 'MISSING_EXTERNAL_ID') || r.unusable).map((r) => {
              const d = decisionFor(r);
              const setD = (patch: Partial<typeof d>) => setDecisions((s) => ({ ...s, [r.rowIndex]: { ...d, ...patch } }));
              return (
                <li key={r.rowIndex} className={cx('grid gap-3 p-4 md:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)] md:items-start md:px-5', r.unusable && 'opacity-70')}>
                  <div className="text-body-s tnum text-ink-muted">#{r.rowIndex + 1}</div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {r.amount ? <Money value={r.amount} currency={r.currency} className="font-semibold" /> : <span className="text-danger-text">“{r.amountRaw}”</span>}
                      <span className="text-body-s text-ink-secondary">{r.occurredAt ? r.occurredAt.slice(0, 16).replace('T', ' ') + ' UTC' : 'no date'}</span>
                    </div>
                    <div className="truncate text-body-s">{r.description || <span className="text-ink-muted">No description</span>}</div>
                    <div className="text-label text-ink-muted">{r.externalId ?? 'no external_id'}</div>
                    <div className="flex flex-wrap gap-1">
                      {r.issues.filter((i) => i !== 'MISSING_EXTERNAL_ID' || issuesOnly).map((i) => (
                        <Badge key={i} tone={i === 'MISSING_EXTERNAL_ID' || i === 'CURRENCY_MISMATCH' ? 'neutral' : 'warning'}>{ISSUE_TEXT[i]}</Badge>
                      ))}
                    </div>
                  </div>
                  {r.unusable || !r.occurredAt ? (
                    <div className="text-body-s text-danger-text md:col-span-2">Cannot be imported: {r.unusable ? 'the amount is unreadable' : 'the date is missing or unreadable'}. Fix the file and upload it again.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-micro text-ink-muted">
                          Type
                          <select value={d.type} onChange={(e) => setD({ type: e.target.value as EntryType })} className="mt-0.5 block w-full rounded-control border border-border-control bg-surface px-2 py-1.5 text-body-s text-ink">
                            {ENTRY_TYPES.map((t) => <option key={t} value={t}>{ENTRY_TYPE_LABEL[t]}</option>)}
                          </select>
                        </label>
                        <label className="text-micro text-ink-muted">
                          Decision
                          <select value={d.classification} onChange={(e) => setD({ classification: e.target.value as Classification })} className="mt-0.5 block w-full rounded-control border border-border-control bg-surface px-2 py-1.5 text-body-s text-ink">
                            <option value="eligible">Eligible</option>
                            <option value="held">Held for review</option>
                            <option value="excluded">Excluded</option>
                          </select>
                        </label>
                      </div>
                      <label className="text-micro text-ink-muted">
                        Note {d.classification === 'excluded' && <span className="text-danger-text">required</span>}
                        <input value={d.note} onChange={(e) => setD({ note: e.target.value })} className={cx('mt-0.5 block w-full rounded-control border bg-surface px-2 py-1.5 text-body-s text-ink', d.classification === 'excluded' && !d.note.trim() ? 'border-danger' : 'border-border-control')} placeholder="Why this decision" />
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4 md:p-5">
            <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
            <Button size="lg" disabled={exclusionsMissingNotes > 0} onClick={() => setStep(3)}>Review commit</Button>
            {exclusionsMissingNotes > 0 && <span className="text-body-s text-warning-text">{exclusionsMissingNotes} exclusion(s) need a note.</span>}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5">
          {commit.message && <Callout tone="danger" title="Nothing was committed">{commit.message}</Callout>}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Will import', counts.willImport.length],
              ['Eligible', counts.eligible.length],
              ['Held for review', counts.held.length],
              ['Excluded', counts.excluded.length],
              ['Duplicates found', counts.duplicates],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-row bg-surface-muted p-3">
                <dt className="text-label text-ink-secondary">{k}</dt>
                <dd className="text-figure-s tnum">{v}</dd>
              </div>
            ))}
          </dl>
          {counts.rejected > 0 && <Callout tone="warning">{counts.rejected} row(s) have no readable amount or date and will not be imported.</Callout>}
          <div className="grid gap-4 sm:grid-cols-3">
            {(['eligible', 'held', 'excluded'] as const).map((k) => (
              <div key={k}>
                <div className="text-body-s text-ink-secondary">{k === 'eligible' ? 'Eligible total' : k === 'held' ? 'Held total' : 'Excluded total'}</div>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(counts.totals(counts[k])).map(([c, v]) => <div key={c}><Money value={v} currency={c} /></div>)}
                  {counts[k].length === 0 && <span className="text-ink-muted">—</span>}
                </div>
              </div>
            ))}
          </div>
          {counts.duplicates > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-body-s font-medium">Duplicates</legend>
              <label className="flex gap-2 text-body-s"><input type="radio" checked={duplicatePolicy === 'skip_duplicates'} onChange={() => setDuplicatePolicy('skip_duplicates')} /> Skip rows whose external_id is already imported</label>
              <label className="flex gap-2 text-body-s"><input type="radio" checked={duplicatePolicy === 'import_as_held'} onChange={() => setDuplicatePolicy('import_as_held')} /> Import them as distinct revisions, held until I review each one</label>
            </fieldset>
          )}
          <p className="text-body-s text-ink-secondary">Source: {source?.name}. File fingerprint {preview?.fileHash.slice(0, 16)}…</p>
          <Callout tone="info">Imported values are not independently verified. Setrya records what your file says, with its hash, so every later calculation can be traced back to it.</Callout>
          <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="I reviewed these rows and understand the values come from my source file" error={commit.fieldErrors.acknowledgeUnverified} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button>
            <Button
              size="lg"
              busy={commit.busy}
              disabled={!ack || counts.willImport.length === 0}
              onClick={async () => {
                const r = await commit.submit(`/api/v1/projects/${projectId}/imports`, {
                  body: { token: preview!.token, sourceId, mapping, dateFormat, decimalSeparator, timeZone, duplicatePolicy, acknowledgeUnverified: true, decisions: rows.filter((r) => !r.unusable && r.occurredAt).map((r) => ({ rowIndex: r.rowIndex, ...decisionFor(r) })) },
                });
                if (r.ok) onCommitted(r.data.importId);
              }}
            >
              Commit import
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
