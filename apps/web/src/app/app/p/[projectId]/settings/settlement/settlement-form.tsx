'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Card, DefinitionList } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

interface Values { cadence: string; defaultClassification: string; minConfirmations: number; targetConfirmations: number; rateExpiryHours: number; stepUpWindowSeconds: number; maxRecipientsPerBatch: number; minPayoutZat: string }

export function SettlementForm({ projectId, version, network, initial }: { projectId: string; version: number; network: string; initial: Values }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const { busy, message, fieldErrors, submit } = useSubmit();
  const num = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });
  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" onSubmit={async (e) => { e.preventDefault(); const r = await submit(`/api/v1/projects/${projectId}`, { method: 'PATCH', body: { section: 'settlement', expectedVersion: version, ...v } }); if (r.ok) { toast('success', 'Settlement defaults saved for future periods.'); router.refresh(); } }}>
      <div className="space-y-5">
        {message && <Callout tone="danger">{message}</Callout>}
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Default period cadence" value={v.cadence} onChange={(e) => setV({ ...v, cadence: e.target.value })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="per_launch">Per launch</option></SelectField>
          <SelectField label="Default revenue classification" value={v.defaultClassification} onChange={(e) => setV({ ...v, defaultClassification: e.target.value })}><option value="realised_fee">Realised fee</option><option value="gross_volume">Gross volume</option><option value="other">Other</option></SelectField>
          <TextField label="Minimum input confirmations" type="number" min={1} value={v.minConfirmations} onChange={num('minConfirmations')} error={fieldErrors.minConfirmations} hint="Notes must be this deep before the wallet may spend them." />
          <TextField label="Confirmations to count as paid" type="number" min={1} value={v.targetConfirmations} onChange={num('targetConfirmations')} error={fieldErrors.targetConfirmations} hint="No payout shows Confirmed before this depth." />
          <TextField label="Manual rate expiry (hours)" type="number" min={1} value={v.rateExpiryHours} onChange={num('rateExpiryHours')} />
          <TextField label="Step-up window (seconds)" type="number" min={60} max={900} value={v.stepUpWindowSeconds} onChange={num('stepUpWindowSeconds')} hint="How long a password confirmation stays valid for one action." />
          <TextField label="Maximum recipients per transaction" type="number" min={1} max={50} value={v.maxRecipientsPerBatch} onChange={num('maxRecipientsPerBatch')} hint="Larger approvals split into several transactions. Set from measured wallet behaviour." />
          <TextField label="Minimum payout (zatoshis)" inputMode="numeric" value={v.minPayoutZat} onChange={(e) => setV({ ...v, minPayoutZat: e.target.value.replace(/\D/g, '') })} hint="Smaller payouts are held instead of rounded away." />
        </div>
        <Button type="submit" size="lg" busy={busy}>Save</Button>
      </div>
      <Card muted className="h-fit">
        <h2 className="mb-2 text-h3">Fixed rules</h2>
        <DefinitionList items={[
          { term: 'Privacy policy', detail: <Badge tone="accent" icon="lock">FullPrivacy, read only</Badge> },
          { term: 'Rounding', detail: 'Down to whole zatoshis (8 decimals)' },
          { term: 'Network fee', detail: 'Paid by you, calculated by the wallet' },
          { term: 'Network', detail: network },
        ]} />
        <p className="mt-2 text-label text-ink-muted">There is no setting that weakens privacy inside the normal settlement flow.</p>
      </Card>
    </form>
  );
}
