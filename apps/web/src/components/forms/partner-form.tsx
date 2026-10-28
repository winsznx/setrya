'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { NetworkBadge, type NetworkLabel } from '@/components/shell/status-pills';

import { AddressField, type Assessment } from './address-field';
import { useSubmit } from './use-submit';

export interface PartnerValues {
  displayName: string;
  shortRef: string;
  contact: string;
  notes: string;
  category: 'promoter' | 'creator' | 'contributor' | 'other';
  active: boolean;
}

export function PartnerCreateForm({ projectId, network, onSaved, secondaryLabel }: { projectId: string; network: NetworkLabel; onSaved: (id: string, intent: 'primary' | 'secondary') => void; secondaryLabel?: string }) {
  const [v, setV] = useState<PartnerValues>({ displayName: '', shortRef: '', contact: '', notes: '', category: 'promoter', active: true });
  const [address, setAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const onAssessment = useCallback((a: Assessment | null) => setAssessment(a), []);
  const { busy, message, fieldErrors, submit } = useSubmit<{ id: string }>();
  const set = <K extends keyof PartnerValues>(k: K, value: PartnerValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const blockedAddress = address.trim() !== '' && assessment !== null && !assessment.ok;

  const save = async (intent: 'primary' | 'secondary') => {
    const r = await submit(`/api/v1/projects/${projectId}/partners`, { body: { ...v, address: address.trim() || null, addressConfirmed: confirmed } });
    if (r.ok) onSaved(r.data.id, intent);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save('primary');
      }}
      className="space-y-6"
    >
      {message && <Callout tone="danger">{message}</Callout>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <TextField label="Display name" value={v.displayName} onChange={(e) => set('displayName', e.target.value)} error={fieldErrors.displayName} required />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Category" value={v.category} onChange={(e) => set('category', e.target.value as PartnerValues['category'])}>
              <option value="promoter">Promoter</option>
              <option value="creator">Creator</option>
              <option value="contributor">Contributor</option>
              <option value="other">Other</option>
            </SelectField>
            <TextField label="Short reference" optional value={v.shortRef} onChange={(e) => set('shortRef', e.target.value)} error={fieldErrors.shortRef} />
          </div>
          <TextField label="Contact or email" optional value={v.contact} onChange={(e) => set('contact', e.target.value)} error={fieldErrors.contact} hint="Stored encrypted. Setrya never contacts partners." />
          <TextAreaField label="Internal notes" optional value={v.notes} onChange={(e) => set('notes', e.target.value)} hint="Private. Never appears on a statement." />
          <CheckboxField label="Active" checked={v.active} onChange={(e) => set('active', e.target.checked)} hint="Inactive partners keep their history but get no new entitlements." />
        </div>
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h3">Payout address</h2>
            <NetworkBadge network={network} />
          </div>
          <p className="text-body-s text-ink-secondary">Optional for now. A partner without a verified address can be added and calculated, but every payout to them is held.</p>
          <AddressField value={address} onChange={setAddress} error={fieldErrors.address} network={network.toLowerCase()} onAssessment={onAssessment} />
          {address.trim() && (
            <CheckboxField checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="I confirmed this address with the intended recipient" hint={`Checked ${new Date().toLocaleDateString()}. Verify through a channel other than the one the address arrived on.`} />
          )}
          <Callout tone="warning">Check the address with the recipient yourself. A wrong shielded address cannot be traced or reversed.</Callout>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" busy={busy} disabled={blockedAddress}>Save partner</Button>
        {secondaryLabel && (
          <Button variant="secondary" size="lg" disabled={busy || blockedAddress} onClick={() => void save('secondary')}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
