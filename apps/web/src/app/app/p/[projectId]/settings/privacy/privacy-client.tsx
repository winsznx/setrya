'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function PrivacyForm({ projectId, version, initial }: { projectId: string; version: number; initial: { shareExpiryDays: number; revealTimeoutSeconds: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const { busy, message, submit } = useSubmit();
  return (
    <Card className="space-y-4">
      <h2 className="text-h3">Retention and disclosure</h2>
      {message && <Callout tone="danger">{message}</Callout>}
      <TextField label="Default statement link expiry (days)" type="number" min={1} max={365} value={v.shareExpiryDays} onChange={(e) => setV({ ...v, shareExpiryDays: Number(e.target.value) })} />
      <TextField label="Hide revealed addresses after (seconds)" type="number" min={5} max={600} value={v.revealTimeoutSeconds} onChange={(e) => setV({ ...v, revealTimeoutSeconds: Number(e.target.value) })} />
      <Button busy={busy} onClick={async () => { const r = await submit(`/api/v1/projects/${projectId}`, { method: 'PATCH', body: { section: 'privacy', expectedVersion: version, ...v } }); if (r.ok) { toast('success', 'Saved.'); router.refresh(); } }}>Save</Button>
    </Card>
  );
}

export function DraftCleanup({ projectId, drafts }: { projectId: string; drafts: { id: string; label: string }[] }) {
  const router = useRouter();
  const { busy, message, submit } = useSubmit();
  if (drafts.length === 0) return <p className="mt-3 text-body-s text-ink-muted">No unused drafts to delete.</p>;
  return (
    <div className="mt-3 space-y-2">
      {message && <Callout tone="danger">{message}</Callout>}
      <p className="text-body-s font-medium">Unused drafts</p>
      <ul className="space-y-1.5">
        {drafts.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 text-body-s">
            <span className="truncate">{d.label}</span>
            <Button size="sm" variant="secondary" busy={busy} onClick={async () => { if (!confirm(`Delete draft "${d.label}"? It was never frozen; imported rows are released for other periods.`)) return; const r = await submit(`/api/v1/projects/${projectId}/periods/${d.id}/discard`, { body: { reason: 'Unused draft removed from privacy settings' } }); if (r.ok) router.refresh(); }}>Delete</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
