'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/field';

import { RateQuoteForm } from './rate-quote';

interface RateOption { id: string; base: string; label: string }

export function PeriodRates({ projectId, periodId, revision, currencies, attached, options, rateExpiryHours, editable }: { projectId: string; periodId: string; revision: number; currencies: string[]; attached: Record<string, string>; options: RateOption[]; rateExpiryHours: number; editable: boolean }) {
  const router = useRouter();
  const [quoting, setQuoting] = useState<string | null>(null);
  const { busy, message, submit } = useSubmit();
  const attach = async (currency: string, rateSnapshotId: string | null) => {
    const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/rates`, { body: { currency, rateSnapshotId, expectedRevision: revision } });
    if (r.ok) router.refresh();
  };
  if (currencies.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-1 text-h3">Conversion rates</h2>
      <p className="mb-3 text-label text-ink-secondary">Manual rates, not onchain conversions. Rows without an approved rate stay held.</p>
      {message && <Callout tone="danger" className="mb-3">{message}</Callout>}
      <div className="space-y-4">
        {currencies.map((c) => (
          <div key={c} className="space-y-2">
            <SelectField label={`${c} → ZEC`} value={attached[c] ?? ''} disabled={!editable || busy} onChange={(e) => void attach(c, e.target.value || null)}>
              <option value="">No rate (rows held)</option>
              {options.filter((o) => o.base === c).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </SelectField>
            {editable && (quoting === c ? (
              <RateQuoteForm projectId={projectId} currency={c} rateExpiryHours={rateExpiryHours} onCancel={() => setQuoting(null)} onSaved={async (id) => { setQuoting(null); await attach(c, id); }} />
            ) : <Button size="sm" variant="secondary" icon="plus" onClick={() => setQuoting(c)}>Enter a quote</Button>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
