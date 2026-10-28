'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';

export function DeactivateButton({ projectId, partnerId, version, values }: { projectId: string; partnerId: string; version: number; values: { displayName: string; shortRef: string | null; contact: string | null; notes: string | null; category: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { busy, message, submit } = useSubmit();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Deactivate</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Deactivate partner" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/partners/${partnerId}`, { method: 'PATCH', body: { ...values, active: false, expectedVersion: version } }); if (r.ok) { setOpen(false); router.refresh(); } }}>Deactivate</Button></>}>
        {message && <Callout tone="danger" className="mb-3">{message}</Callout>}
        <p className="text-body-s text-ink-secondary">New periods will not create entitlements for this partner. Their agreements, payments and statements stay in the record. You can reactivate them from Edit.</p>
      </Dialog>
    </>
  );
}
