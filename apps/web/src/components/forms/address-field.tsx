'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { TextAreaField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

export interface Assessment {
  ok: boolean;
  network: string | null;
  encoding: string;
  receivers: { kind: string; typecode: number }[];
  shieldedCapable: boolean;
  problem: string | null;
  message: string;
}

/** Validates with the ZIP 316 parser on the server against this install's network. A regex is never the check. */
export function AddressField({ value, onChange, error, network, label = 'Zcash unified address', onAssessment }: { value: string; onChange: (v: string) => void; error?: string; network: string; label?: string; onAssessment?: (a: Assessment | null) => void }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setAssessment(null);
      onAssessment?.(null);
      setQr(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<Assessment>('/api/v1/wallet/validate-recipient', { method: 'POST', body: { address: v } });
      const a = r.ok ? r.data : null;
      setAssessment(a);
      onAssessment?.(a);
      setQr(a?.ok ? await QRCode.toString(v, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null);
    }, 250);
    return () => clearTimeout(t);
  }, [value, onAssessment]);
  return (
    <div className="space-y-3">
      <TextAreaField label={label} value={value} onChange={(e) => onChange(e.target.value)} error={error ?? (assessment && !assessment.ok ? assessment.message : undefined)} spellCheck={false} autoComplete="off" className="font-mono text-[0.8125rem]" rows={3} hint={`Must be a ${network} address with an Orchard receiver so the payment stays in one shielded pool.`} />
      {assessment?.ok && (
        <div className="flex flex-wrap items-start gap-4 rounded-row border border-border bg-surface-muted p-3">
          {qr && <div className="size-24 shrink-0 rounded-xs bg-white p-1" aria-label="QR code of the address" role="img" dangerouslySetInnerHTML={{ __html: qr }} />}
          <div className="min-w-0 space-y-2 text-body-s">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="success">Shielded capable</Badge>
              <Badge tone="neutral" icon={null}>{assessment.network}</Badge>
              {assessment.receivers.map((r) => (
                <Badge key={r.typecode} tone={r.kind === 'orchard' ? 'accent' : 'neutral'} icon={null}>{r.kind}</Badge>
              ))}
            </div>
            <p className="text-ink-secondary">{assessment.message}</p>
            <CopyButton value={value.trim()} label="Copy address" />
          </div>
        </div>
      )}
    </div>
  );
}
