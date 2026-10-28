'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Money } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, TextAreaField } from '@/components/ui/field';

type Disposition = 'carry_forward' | 'waived' | 'remain_open';

export function CloseForm({ projectId, periodId, unpaid }: { projectId: string; periodId: string; unpaid: { key: string; partner: string; owed: string; currency: string; reason: string; credit: boolean }[] }) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, { disposition: Disposition; reason: string }>>(Object.fromEntries(unpaid.map((u) => [u.key, { disposition: 'carry_forward' as Disposition, reason: '' }])));
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <Card className="space-y-4">
      <h2 className="text-h3">Close</h2>
      {unpaid.length > 0 ? (
        <ul className="space-y-3">
          {unpaid.map((u) => {
            const c = choices[u.key]!;
            return (
              <li key={u.key} className="rounded-row border border-border p-3 text-body-s">
                <div className="flex justify-between gap-2"><span className="font-medium">{u.partner}</span><Money value={u.owed} currency={u.currency} /></div>
                <div className="text-ink-secondary">{u.reason}</div>
                <fieldset className="mt-2 flex flex-wrap gap-3">
                  <legend className="sr-only">Disposition for {u.partner}</legend>
                  {(['carry_forward', 'waived', 'remain_open'] as const).map((dval) => (
                    <label key={dval} className="flex items-center gap-1.5"><input type="radio" name={`d-${u.key}`} checked={c.disposition === dval} onChange={() => setChoices({ ...choices, [u.key]: { ...c, disposition: dval } })} />{dval === 'carry_forward' ? (u.credit ? 'Carry credit forward' : 'Carry forward') : dval === 'waived' ? 'Waive with reason' : 'Remain open'}</label>
                  ))}
                </fieldset>
                {c.disposition === 'waived' && <TextAreaField label="Why it is waived" value={c.reason} onChange={(e) => setChoices({ ...choices, [u.key]: { ...c, reason: e.target.value } })} error={fieldErrors[u.key]} fieldClassName="mt-2" />}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-body-s text-ink-secondary">Every row is confirmed paid.</p>}
      <TextAreaField label="Close note" optional value={note} onChange={(e) => setNote(e.target.value)} />
      <CheckboxField checked={confirm} onChange={(e) => setConfirm(e.target.checked)} label="I approve closing this period. Unpaid rows are recorded as chosen above, never as paid." />
      {message && <Callout tone="danger">{message}</Callout>}
      <Button size="lg" busy={busy} disabled={!confirm} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/close`, { body: { dispositions: choices, note, confirm: true } }); if (r.ok) router.refresh(); }}>Close period</Button>
    </Card>
  );
}
