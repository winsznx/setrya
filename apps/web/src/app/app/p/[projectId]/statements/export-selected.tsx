'use client';

import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { CheckboxField, PasswordField } from '@/components/ui/field';
import { download, sealArchive } from '@/lib/client/archive-crypto';

export function ExportSelected({ projectId, statements }: { projectId: string; statements: { id: string; reference: string }[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(statements.map((s) => s.id)));
  const [password, setPassword] = useState('');
  const [ack, setAck] = useState(false);
  const { busy, message, submit } = useSubmit<{ docs: unknown[] }>();
  if (statements.length === 0) return null;
  return (
    <>
      <Button icon="download" onClick={() => setOpen(true)}>Export selected</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Export statements" wide footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button busy={busy} disabled={!ack || password.length < 12 || selected.size === 0} onClick={async () => {
        const r = await submit(`/api/v1/projects/${projectId}/statements/export`, { body: { ids: [...selected], acknowledgePrivate: true } });
        if (!r.ok) return;
        download(await sealArchive(r.data.docs, password, 'statements'), `setrya-statements-${new Date().toISOString().slice(0, 10)}.setrya.json`);
        setPassword('');
        setOpen(false);
      }}>Encrypt and download</Button></>}>
        <div className="space-y-4">
          {message && <Callout tone="danger">{message}</Callout>}
          <Callout tone="warning" title="Contains private financial information">The archive includes every selected partner&apos;s figures. It is for you, not for partners; share individual statements with private links instead.</Callout>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-row border border-border p-3">
            {statements.map((s) => <li key={s.id}><CheckboxField label={s.reference} checked={selected.has(s.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSelected(n); }} /></li>)}
          </ul>
          <PasswordField label="Archive password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 12 characters. Encryption happens in this browser. Decrypt with scripts/decrypt-export.mjs." autoComplete="new-password" />
          <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="I understand this file contains private financial information" />
        </div>
      </Dialog>
    </>
  );
}
