'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';

import { useSubmit } from './use-submit';
import { timeZones } from '@/lib/client/time-zones';

export interface ProjectFormValues {
  orgName: string;
  name: string;
  issuerLabel: string;
  currency: 'USD' | 'ZEC';
  timezone: string;
  description: string;
  contact: string;
  logo: string | null;
  cadence?: string;
}

export function ProjectForm({ initial, submitLabel, onSaved, endpoint, method, extra }: { initial: ProjectFormValues; submitLabel: string; onSaved: (id: string) => void; endpoint: string; method: 'POST' | 'PATCH'; extra?: Record<string, unknown> }) {
  const [v, setV] = useState(initial);
  const { busy, message, fieldErrors, submit } = useSubmit<{ id?: string }>();
  const tz = useMemo(timeZones, []);
  const set = <K extends keyof ProjectFormValues>(k: K, value: ProjectFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(endpoint, { method, body: { ...v, ...extra } });
          if (r.ok) onSaved(r.data.id ?? '');
        }}
      >
        {message && <Callout tone="danger">{message}</Callout>}
        <TextField label="Organisation display name" value={v.orgName} onChange={(e) => set('orgName', e.target.value)} error={fieldErrors.orgName} required />
        <TextField label="Project or brand name" value={v.name} onChange={(e) => set('name', e.target.value)} error={fieldErrors.name} required hint="A project groups fee sources, partner agreements, settlement periods and the payer wallet." />
        <TextField label="Issuer label on statements" value={v.issuerLabel} onChange={(e) => set('issuerLabel', e.target.value)} error={fieldErrors.issuerLabel} required />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Accounting currency" value={v.currency} onChange={(e) => set('currency', e.target.value as 'USD' | 'ZEC')} hint="For statements and summaries. Never converted automatically.">
            <option value="USD">USD</option>
            <option value="ZEC">ZEC</option>
          </SelectField>
          <SelectField label="Time zone" value={v.timezone} onChange={(e) => set('timezone', e.target.value)} error={fieldErrors.timezone}>
            {tz.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </SelectField>
        </div>
        {v.cadence !== undefined && (
          <SelectField label="Settlement schedule" value={v.cadence} onChange={(e) => set('cadence', e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="per_launch">Per launch</option>
          </SelectField>
        )}
        <TextAreaField label="Description" optional value={v.description} onChange={(e) => set('description', e.target.value)} error={fieldErrors.description} />
        <TextField label="Private contact" optional value={v.contact} onChange={(e) => set('contact', e.target.value)} error={fieldErrors.contact} hint="Shown only to you. Never added to statements." />
        <div>
          <label className="mb-1.5 block text-body-s font-medium">Logo <span className="font-normal text-ink-muted">optional</span></label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block text-body-s file:mr-3 file:rounded-pill file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-body-s"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 140_000) return alert('Use an image under 140 KB.');
              const reader = new FileReader();
              reader.onload = () => set('logo', String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          <p className="mt-1.5 text-body-s text-ink-secondary">Stored encrypted on this host and used only on your statements.</p>
          {fieldErrors.logo && <p className="mt-1 text-body-s text-danger-text">{fieldErrors.logo}</p>}
          {v.logo && <button type="button" className="mt-2 text-body-s text-accent-text hover:underline" onClick={() => set('logo', null)}>Remove logo</button>}
        </div>
        <Button type="submit" busy={busy} size="lg">{submitLabel}</Button>
      </form>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-body-s font-medium text-ink-secondary">Statement header preview</p>
        <div className="rounded-panel bg-paper p-5 text-[#15171c] shadow-paper">
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.logo && <img src={v.logo} alt="" className="mb-2 h-8 w-auto" />}
              <div className="font-serif text-[1.35rem] leading-tight">{v.issuerLabel || 'Issuer name'}</div>
              <div className="text-[0.75rem] text-[#545a66]">{v.orgName || 'Organisation'} · {v.name || 'Project'}</div>
            </div>
            <div className="text-right text-[0.6875rem] text-[#545a66]">Settlement statement<br />ST-XXXXXXXXXX</div>
          </div>
          <div className="mt-4 border-t border-[#e4e6eb] pt-3 text-[0.75rem] text-[#545a66]">Amounts in {v.currency}. Times shown in {v.timezone}.</div>
        </div>
      </aside>
    </div>
  );
}
