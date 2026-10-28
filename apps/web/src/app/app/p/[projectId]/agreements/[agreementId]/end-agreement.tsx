'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField, TextField } from '@/components/ui/field';

export function EndAgreement({ projectId, agreementId }: { projectId: string; agreementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>End agreement</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="End agreement" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/agreements/${agreementId}/end`, { body: { endDate, reason } }); if (r.ok) { setOpen(false); router.refresh(); } }}>End agreement</Button></>}>
        <div className="space-y-4">
          {message && <Callout tone="danger">{message}</Callout>}
          <p className="text-body-s text-ink-secondary">Fees from the end date onward no longer count. Nothing is deleted, and periods that already used this agreement keep their version.</p>
          <TextField label="End date (exclusive)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} error={fieldErrors.endDate} />
          <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} required />
        </div>
      </Dialog>
    </>
  );
}
