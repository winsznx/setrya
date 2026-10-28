'use client';

import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { CheckboxField, DecimalField, SelectField, TextField } from '@/components/ui/field';

/** Operator-supplied quote. Setrya never fetches a price; saving records who approved which rate and when. */
export function RateQuoteForm({ projectId, currency, rateExpiryHours, onSaved, onCancel }: { projectId: string; currency: string; rateExpiryHours: number; onSaved: (id: string) => void | Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({ orientation: 'unit_per_zec' as 'unit_per_zec' | 'zec_per_unit', value: '', source: '', quotedAt: new Date().toISOString().slice(0, 16), approve: false });
  const { busy, message, fieldErrors, submit } = useSubmit<{ id: string }>();
  return (
    <div className="space-y-3 rounded-row bg-surface-muted p-3">
      {message && <Callout tone="danger">{message}</Callout>}
      <SelectField label="I am entering" value={v.orientation} onChange={(e) => setV({ ...v, orientation: e.target.value as typeof v.orientation })}>
        <option value="unit_per_zec">The ZEC price: 1 ZEC = X {currency}</option>
        <option value="zec_per_unit">ZEC per unit: 1 {currency} = X ZEC</option>
      </SelectField>
      <div className="grid gap-3 sm:grid-cols-2">
        <DecimalField maxDecimals={18} label="Rate value X" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} error={fieldErrors.value} />
        <TextField label="Quote time (UTC)" type="datetime-local" value={v.quotedAt} onChange={(e) => setV({ ...v, quotedAt: e.target.value })} error={fieldErrors.quotedAt} />
      </div>
      <TextField label="Quote source" placeholder="Exchange name and pair, or OTC desk" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} error={fieldErrors.source} hint={`Expires ${rateExpiryHours} hours after the quote time. A rate is never refreshed after a period is frozen.`} />
      <CheckboxField checked={v.approve} onChange={(e) => setV({ ...v, approve: e.target.checked })} label="I approve this rate for converting amounts owed into ZEC" />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button busy={busy} disabled={!v.approve} onClick={async () => {
          const quoted = new Date(`${v.quotedAt}:00Z`);
          const r = await submit(`/api/v1/projects/${projectId}/rates`, { body: { currency, orientation: v.orientation, value: v.value, source: v.source, quotedAt: quoted.toISOString(), expiresAt: new Date(quoted.getTime() + rateExpiryHours * 3_600_000).toISOString(), intendedConversionAt: null, approve: true } });
          if (r.ok) await onSaved(r.data.id);
        }}>Save approved rate</Button>
      </div>
    </div>
  );
}
