'use client';

import { ENTRY_TYPE_LABEL, ENTRY_TYPES } from '@setrya/domain';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { DecimalField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function ManualEntryButton({ projectId, sources }: { projectId: string; sources: { id: string; name: string; currency: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ sourceId: sources[0]?.id ?? '', occurredAt: '', amount: '', currency: sources[0]?.currency ?? 'USD', type: 'realised_fee', description: '', externalId: '', note: '' });
  const { busy, message, fieldErrors, submit } = useSubmit<{ id: string }>();
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));
  if (sources.length === 0) return null;
  return (
    <>
      <Button variant="secondary" icon="plus" onClick={() => setOpen(true)}>Add manual entry</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add manual entry"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button busy={busy} onClick={async () => {
              const r = await submit(`/api/v1/projects/${projectId}/revenue/manual`, { body: { ...v, externalId: v.externalId || null } });
              if (r.ok) { toast('success', 'Entry recorded.'); setOpen(false); router.refresh(); }
            }}>Save entry</Button>
          </>
        }
      >
        <div className="space-y-4">
          {message && <Callout tone="danger">{message}</Callout>}
          <SelectField label="Source" value={v.sourceId} onChange={(e) => { const s = sources.find((x) => x.id === e.target.value); setV((p) => ({ ...p, sourceId: e.target.value, currency: s?.currency ?? p.currency })); }}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Earned at" type="datetime-local" value={v.occurredAt} onChange={(e) => set('occurredAt', e.target.value)} error={fieldErrors.occurredAt} required hint="In the source's time zone." />
            <SelectField label="Type" value={v.type} onChange={(e) => set('type', e.target.value)}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{ENTRY_TYPE_LABEL[t]}</option>)}
            </SelectField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DecimalField maxDecimals={8} label="Amount" value={v.amount} onChange={(e) => set('amount', e.target.value)} error={fieldErrors.amount} required />
            <TextField label="Currency" value={v.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} error={fieldErrors.currency} maxLength={5} />
          </div>
          <TextField label="Description" value={v.description} onChange={(e) => set('description', e.target.value)} />
          <TextField label="External ID" optional value={v.externalId} onChange={(e) => set('externalId', e.target.value)} error={fieldErrors.externalId} hint="Prevents recording the same fee twice." />
          <TextAreaField label="Where this figure comes from" value={v.note} onChange={(e) => set('note', e.target.value)} error={fieldErrors.note} required />
        </div>
      </Dialog>
    </>
  );
}
