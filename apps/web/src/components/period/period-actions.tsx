'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function RecalculateButton({ projectId, periodId, revision }: { projectId: string; periodId: string; revision: number }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, submit } = useSubmit();
  return (
    <Button variant="secondary" icon="refresh" busy={busy} onClick={async () => {
      const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/recalculate`, { body: { expectedRevision: revision } });
      if (r.ok) { toast('success', 'Recalculated from current imports, agreements and rates.'); router.refresh(); } else toast('danger', r.error.message);
    }}>Recalculate</Button>
  );
}

export function FreezeButton({ projectId, periodId, revision, disabledReason }: { projectId: string; periodId: string; revision: number; disabledReason: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { busy, message, submit } = useSubmit();
  return (
    <>
      <Button icon="lock" disabled={disabledReason !== null} title={disabledReason ?? undefined} onClick={() => setOpen(true)}>Freeze for approval</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Freeze this revision" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/freeze`, { body: { expectedRevision: revision } }); if (r.ok) router.push(`/app/p/${projectId}/periods/${periodId}/review`); }}>Freeze snapshot</Button></>}>
        {message && <Callout tone="danger" className="mb-3">{message}</Callout>}
        <p className="text-body-s text-ink-secondary">Setrya recalculates once more, then records a hashed snapshot of every source row, agreement version, rate, address version and amount. After freezing, changes need a new revision. Nothing is approved or sent at this step.</p>
      </Dialog>
    </>
  );
}

export function ReviseButton({ projectId, periodId, label = 'Create new revision' }: { projectId: string; periodId: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Start a new revision" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}/periods/${periodId}/revise`, { body: { reason } }); if (r.ok) { setOpen(false); router.refresh(); } }}>Start revision</Button></>}>
        <div className="space-y-3">
          {message && <Callout tone="danger">{message}</Callout>}
          <p className="text-body-s text-ink-secondary">The current snapshot and any approval stay in the record but stop being usable. Your exception decisions carry over. Revisions are refused once a transaction is signed.</p>
          <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldErrors.reason} required />
        </div>
      </Dialog>
    </>
  );
}
