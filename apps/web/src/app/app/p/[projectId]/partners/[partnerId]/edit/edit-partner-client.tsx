'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AddressField, type Assessment } from '@/components/forms/address-field';
import type { PartnerValues } from '@/components/forms/partner-form';
import { useSubmit } from '@/components/forms/use-submit';
import { NetworkBadge, type NetworkLabel } from '@/components/shell/status-pills';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function EditPartnerClient({ projectId, partnerId, version, network, initial, currentAddress, unsettledPeriods }: { projectId: string; partnerId: string; version: number; network: NetworkLabel; initial: PartnerValues; currentAddress: { masked: string; value: string } | null; unsettledPeriods: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [address, setAddress] = useState('');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const onAssessment = useCallback((a: Assessment | null) => setAssessment(a), []);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const details = useSubmit();
  const addr = useSubmit<{ invalidatedApprovals: number }>();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial) || address.trim() !== '';
  const set = <K extends keyof PartnerValues>(k: K, value: PartnerValues[K]) => setV((s) => ({ ...s, [k]: value }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await details.submit(`/api/v1/projects/${projectId}/partners/${partnerId}`, { method: 'PATCH', body: { ...v, expectedVersion: version } });
          if (r.ok) { toast('success', 'Partner saved.'); router.push(`/app/p/${projectId}/partners/${partnerId}`); }
        }}
      >
        {details.message && <Callout tone="danger">{details.message}</Callout>}
        <TextField label="Display name" value={v.displayName} onChange={(e) => set('displayName', e.target.value)} error={details.fieldErrors.displayName} required />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Category" value={v.category} onChange={(e) => set('category', e.target.value as PartnerValues['category'])}>
            <option value="promoter">Promoter</option><option value="creator">Creator</option><option value="contributor">Contributor</option><option value="other">Other</option>
          </SelectField>
          <TextField label="Short reference" optional value={v.shortRef} onChange={(e) => set('shortRef', e.target.value)} />
        </div>
        <TextField label="Contact or email" optional value={v.contact} onChange={(e) => set('contact', e.target.value)} />
        <TextAreaField label="Internal notes" optional value={v.notes} onChange={(e) => set('notes', e.target.value)} />
        <CheckboxField label="Active" checked={v.active} onChange={(e) => set('active', e.target.checked)} hint="Inactive partners get no new entitlements. History is never edited." />
        <Button type="submit" size="lg" busy={details.busy}>Save</Button>
      </form>

      <Card className="space-y-4 border-danger/40">
        <div className="flex items-center justify-between"><h2 className="text-h3">Change wallet address</h2><NetworkBadge network={network} /></div>
        <p className="text-body-s text-ink-secondary">Current: <code className="font-mono text-[0.8125rem]">{currentAddress?.masked ?? 'none'}</code>. A new address creates a new version effective now. Unsigned prepared payments to this partner are invalidated and need approval again. Signed or broadcast payments are never edited.</p>
        {unsettledPeriods.length > 0 && <Callout tone="warning" title="Unsettled periods affected">{unsettledPeriods.join(', ')}</Callout>}
        <AddressField label="New unified address" value={address} onChange={setAddress} network={network.toLowerCase()} onAssessment={onAssessment} error={addr.fieldErrors.address} />
        {address.trim() && assessment?.ok && (
          <div className="grid grid-cols-2 gap-3 rounded-row bg-surface-muted p-3 text-body-s">
            <div><div className="text-micro text-ink-muted">Old</div><code className="font-mono">{currentAddress?.masked ?? 'none'}</code></div>
            <div><div className="text-micro text-ink-muted">New</div><code className="font-mono">{`${address.trim().slice(0, 10)}…${address.trim().slice(-6)}`}</code></div>
          </div>
        )}
        <TextAreaField label="Reason for the change" value={reason} onChange={(e) => setReason(e.target.value)} error={addr.fieldErrors.reason} />
        <CheckboxField checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="I reconfirmed the new address with the recipient through a separate channel" error={addr.fieldErrors.confirmed} />
        {addr.message && <Callout tone="danger">{addr.message}</Callout>}
        <Button variant="danger" busy={addr.busy} disabled={!assessment?.ok || !confirmed || reason.trim().length < 3} onClick={async () => {
          const r = await addr.submit(`/api/v1/projects/${projectId}/partners/${partnerId}/address`, { body: { address: address.trim(), confirmed, reason } });
          if (r.ok) { toast('success', r.data.invalidatedApprovals ? `Address changed. ${r.data.invalidatedApprovals} approval(s) invalidated.` : 'Address changed.'); setAddress(''); router.refresh(); }
        }}>Change address</Button>
      </Card>
    </div>
  );
}
