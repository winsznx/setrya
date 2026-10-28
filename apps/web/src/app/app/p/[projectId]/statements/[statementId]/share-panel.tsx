'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StatementDocument } from '@setrya/api/contract';

import { useSubmit } from '@/components/forms/use-submit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { CheckboxField, TextField } from '@/components/ui/field';
import { newShareId, sealStatement } from '@/lib/client/share-crypto';

interface ShareRow { shareId: string; expiresAt: string; revokedAt: string | null; accessCount: number; documentVersion: number; acknowledged: boolean }

export function SharePanel({ projectId, doc, shares, defaultExpiryDays }: { projectId: string; doc: StatementDocument; shares: ShareRow[]; defaultExpiryDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(String(defaultExpiryDays));
  const [ack, setAck] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const create = useSubmit<{ shareId: string }>();
  const revoke = useSubmit();
  return (
    <Card className="space-y-4">
      <h2 className="text-h3">Share privately</h2>
      <p className="text-body-s text-ink-secondary">Setrya encrypts this one statement in your browser. The key goes into the link after the #, which browsers never send to a server. This host stores only ciphertext.</p>
      {link ? (
        <div className="space-y-2">
          <Callout tone="success" title="Link created">Copy it now. Setrya cannot show the key again, and anyone holding this link can open the statement until it expires or you revoke it.</Callout>
          <code className="block break-all rounded-row bg-surface-muted p-2 font-mono text-[0.75rem]">{link}</code>
          <CopyButton value={link} label="Copy link" />
          <Button variant="ghost" size="sm" onClick={() => setLink(null)}>Done</Button>
        </div>
      ) : (
        <>
          <TextField label="Expires after (days)" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
          <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="I understand links can be forwarded, the host can see that a link was opened, and downloaded copies cannot be recalled" />
          {create.message && <Callout tone="danger">{create.message}</Callout>}
          <Button full icon="share" busy={create.busy} disabled={!ack} onClick={async () => {
            const shareId = newShareId();
            const expiresAt = new Date(Date.now() + Math.max(1, Math.min(365, Number(days) || defaultExpiryDays)) * 86_400_000).toISOString();
            const { envelope, key } = await sealStatement(doc, { shareId, documentVersion: doc.documentVersion, expiresAt, issuerRef: doc.reference });
            const r = await create.submit(`/api/v1/projects/${projectId}/statements/${doc.id}/shares`, { body: { shareId, ciphertext: envelope, expiresAt, documentVersion: doc.documentVersion } });
            if (r.ok) { setLink(`${window.location.origin}/r/${shareId}#k=${key}`); router.refresh(); }
          }}>Create encrypted link</Button>
        </>
      )}
      {shares.length > 0 && (
        <ul className="divide-y divide-border border-t border-border pt-1 text-body-s">
          {shares.map((s) => {
            const expired = new Date(s.expiresAt).getTime() < Date.now();
            return (
              <li key={s.shareId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-mono text-[0.75rem]">…{s.shareId.slice(-6)}</span>{' '}
                  {s.revokedAt ? <Badge tone="neutral" icon="x">Revoked</Badge> : expired ? <Badge tone="neutral" icon="clock">Expired</Badge> : <Badge tone="accent" icon={null}>Active</Badge>}
                  {s.acknowledged && <Badge tone="neutral" icon="check" className="ml-1">Self-attested</Badge>}
                  <span className="block text-label text-ink-muted">Opened {s.accessCount}× · v{s.documentVersion} · until {s.expiresAt.slice(0, 10)}</span>
                </span>
                {!s.revokedAt && !expired && <Button size="sm" variant="secondary" busy={revoke.busy} onClick={async () => { const r = await revoke.submit(`/api/v1/projects/${projectId}/statements/${doc.id}/shares/${s.shareId}/revoke`, {}); if (r.ok) router.refresh(); }}>Revoke link</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {doc.documentVersion > 1 && <p className="text-label text-ink-muted">Links made for an earlier version keep showing that version. Share again to send the current one.</p>}
    </Card>
  );
}
