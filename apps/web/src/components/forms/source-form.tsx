'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { ChoiceCards, SelectField, TextAreaField, TextField } from '@/components/ui/field';

import { useSubmit } from './use-submit';
import { timeZones } from '@/lib/client/time-zones';

export interface SourceValues {
  name: string;
  platform: string;
  note: string;
  referenceUrl: string;
  defaultCurrency: string;
  feeType: 'realised_fee' | 'gross_volume' | 'other';
  timezone: string;
  kind: 'csv' | 'manual';
  enabled?: boolean;
}

export function SourceForm({ initial, endpoint, method, submitLabel, onSaved, expectedVersion, secondary }: { initial: SourceValues; endpoint: string; method: 'POST' | 'PATCH'; submitLabel: string; onSaved: (id: string) => void; expectedVersion?: number; secondary?: React.ReactNode }) {
  const [v, setV] = useState(initial);
  const { busy, message, fieldErrors, submit } = useSubmit<{ id?: string }>();
  const tz = useMemo(timeZones, []);
  const set = <K extends keyof SourceValues>(k: K, value: SourceValues[K]) => setV((s) => ({ ...s, [k]: value }));
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await submit(endpoint, { method, body: { ...v, expectedVersion } });
        if (r.ok) onSaved(r.data.id ?? '');
      }}
    >
      {message && <Callout tone="danger">{message}</Callout>}
      {method === 'POST' && (
        <ChoiceCards<'csv' | 'manual' | 'api'>
          legend="How fees arrive"
          name="kind"
          value={v.kind}
          onChange={(k) => k !== 'api' && set('kind', k)}
          options={[
            { value: 'csv', label: 'CSV import', description: 'Upload statements exported from the platform that pays you.' },
            { value: 'manual', label: 'Manual entry', description: 'Type individual fee records with a note on where each came from.' },
            { value: 'api', label: 'API connector', description: 'No provider integration is built yet, so this cannot be selected.', disabled: true, badge: 'Not connected' },
          ]}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Source name" placeholder="Creator fees" value={v.name} onChange={(e) => set('name', e.target.value)} error={fieldErrors.name} required />
        <TextField label="Platform label" optional placeholder="Launchpad dashboard" value={v.platform} onChange={(e) => set('platform', e.target.value)} error={fieldErrors.platform} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Default import currency" value={v.defaultCurrency} onChange={(e) => set('defaultCurrency', e.target.value.toUpperCase())} error={fieldErrors.defaultCurrency} maxLength={5} required />
        <SelectField label="Time zone for periods" value={v.timezone} onChange={(e) => set('timezone', e.target.value)} error={fieldErrors.timezone}>
          {tz.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </SelectField>
      </div>
      <ChoiceCards
        legend="What the amount column means"
        name="feeType"
        value={v.feeType}
        onChange={(t) => set('feeType', t)}
        options={[
          { value: 'realised_fee', label: 'Realised net fees', description: 'Money you actually earned after the platform took its cut. Commissions are calculated from this.' },
          { value: 'gross_volume', label: 'Gross volume', description: 'Total traded or processed value. Not revenue, so rows are excluded by default.' },
          { value: 'other', label: 'Other', description: 'Each row is held until you classify it.' },
        ]}
      />
      <Callout tone="info" title="Volume is not fees">
        A $20,000 trading volume might have earned you $200 in fees. Setrya never calculates commissions from volume unless you explicitly reclassify a row and record why.
      </Callout>
      <TextField label="Reference URL" optional type="url" value={v.referenceUrl} onChange={(e) => set('referenceUrl', e.target.value)} error={fieldErrors.referenceUrl} />
      <TextAreaField label="Note" optional value={v.note} onChange={(e) => set('note', e.target.value)} error={fieldErrors.note} />
      {v.enabled !== undefined && (
        <label className="flex items-center gap-3 text-body-s">
          <input type="checkbox" checked={v.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Source enabled. Disabling stops new imports and keeps every existing record.
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} size="lg">{submitLabel}</Button>
        {secondary}
      </div>
    </form>
  );
}
