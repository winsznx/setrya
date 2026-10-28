'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/field';

export function VoidImport({ projectId, importId }: { projectId: string; importId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <>
      <p className="mt-1 text-body-s text-ink-secondary">Voiding keeps every row and its history, and removes them from future periods. It cannot be undone; import the corrected file afterwards.</p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>Void import</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Void this import" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/imports/${importId}/void`, { body: { reason } }); if (r.ok) { setOpen(false); router.refresh(); } }}>Void import</Button></>}>
        {message && <Callout tone="danger" className="mb-3">{message}</Callout>}
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} required />
      </Dialog>
    </>
  );
}
