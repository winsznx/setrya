'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, PasswordField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client/api';
import { download } from '@/lib/client/archive-crypto';

export function PasswordForm() {
  const router = useRouter();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <Card className="space-y-3">
      <h2 className="text-h3">Owner password</h2>
      <p className="text-body-s text-ink-secondary">Changing it signs out every session, including this one, and locks the vault.</p>
      {message && <Callout tone="danger">{message}</Callout>}
      <PasswordField label="Current password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} error={fieldErrors.current} autoComplete="current-password" />
      <PasswordField label="New password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} error={fieldErrors.next} autoComplete="new-password" />
      <PasswordField label="Confirm new password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} error={fieldErrors.confirm} autoComplete="new-password" />
      <Button busy={busy} onClick={async () => { const r = await submit('/api/v1/auth/password', { body: v }); if (r.ok) router.replace('/unlock'); }}>Change password</Button>
    </Card>
  );
}

export function VaultPassphraseForm() {
  const toast = useToast();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [ack, setAck] = useState(false);
  const { busy, message, fieldErrors, submit } = useSubmit();
  return (
    <Card className="space-y-3">
      <h2 className="text-h3">Vault passphrase</h2>
      <p className="text-body-s text-ink-secondary">Re-wraps the data key; no records are re-encrypted. Older backups still need the passphrase they were made with.</p>
      {message && <Callout tone="danger">{message}</Callout>}
      <PasswordField label="Current passphrase" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} error={fieldErrors.current} />
      <PasswordField label="New passphrase" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} error={fieldErrors.next} autoComplete="new-password" />
      <PasswordField label="Confirm new passphrase" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} error={fieldErrors.confirm} autoComplete="new-password" />
      <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="I made a fresh encrypted backup and recorded the new passphrase safely" />
      <Button busy={busy} disabled={!ack} onClick={async () => { const r = await submit('/api/v1/vault/passphrase', { body: { ...v, backupAcknowledged: true } }); if (r.ok) { toast('success', 'Vault passphrase changed.'); setV({ current: '', next: '', confirm: '' }); } }}>Change passphrase</Button>
    </Card>
  );
}

export function RevokeSessions({ count }: { count: number }) {
  const router = useRouter();
  const { busy, submit } = useSubmit<{ revoked: number }>();
  return <Button size="sm" variant="secondary" disabled={count <= 0} busy={busy} onClick={async () => { const r = await submit('/api/v1/auth/sessions', { method: 'DELETE' }); if (r.ok) router.refresh(); }}>Sign out other sessions</Button>;
}

export function AutoLockForm({ initial }: { initial: number }) {
  const toast = useToast();
  const [m, setM] = useState(initial);
  const { busy, submit } = useSubmit();
  return (
    <Card className="space-y-3">
      <h2 className="text-h3">Auto-lock</h2>
      <TextField label="Lock after inactivity (minutes)" type="number" min={1} max={240} value={m} onChange={(e) => setM(Number(e.target.value))} hint="Applies on next unlock. The server drops the data key when the session is idle this long." />
      <Button busy={busy} onClick={async () => { const r = await submit('/api/v1/settings/auto-lock', { body: { minutes: m } }); if (r.ok) toast('success', 'Saved.'); }}>Save</Button>
    </Card>
  );
}

export function BackupForm() {
  const [v, setV] = useState({ ownerPassword: '', backupPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-3">
      <h2 className="text-h3">Encrypted backup</h2>
      <p className="text-body-s text-ink-secondary">Every Setrya table, sealed with a backup password. Restoring also needs the host master key and the vault passphrase. Wallet keys are never included.</p>
      {error && <Callout tone="danger">{error}</Callout>}
      <PasswordField label="Your password" value={v.ownerPassword} onChange={(e) => setV({ ...v, ownerPassword: e.target.value })} autoComplete="current-password" />
      <PasswordField label="Backup password" value={v.backupPassword} onChange={(e) => setV({ ...v, backupPassword: e.target.value })} autoComplete="new-password" hint="Store it apart from the file." />
      <Button icon="download" busy={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        const res = await fetch('/api/v1/backup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-setrya-request': '1' }, body: JSON.stringify(v) });
        setBusy(false);
        if (!res.ok) return setError(((await res.json()) as { error?: { message?: string } }).error?.message ?? 'Backup failed.');
        download(await res.blob(), `setrya-backup-${new Date().toISOString().slice(0, 10)}.json`);
        setV({ ownerPassword: '', backupPassword: '' });
      }}>Download encrypted backup</Button>
    </Card>
  );
}

export function VerifyBackup() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ createdAt: string; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="space-y-3">
      <h2 className="text-h3">Test a backup</h2>
      <p className="text-body-s text-ink-secondary">Decrypts the file in server memory and reports what it holds. Nothing is written.</p>
      <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-body-s" aria-label="Backup file" />
      <PasswordField label="Backup password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <Callout tone="danger">{error}</Callout>}
      {result && <Callout tone="success" title={`Readable backup from ${result.createdAt}`}>{Object.entries(result.counts).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join(', ')}</Callout>}
      <Button variant="secondary" busy={busy} disabled={!file || !password} onClick={async () => {
        const form = new FormData();
        form.set('file', file!);
        form.set('password', password);
        setBusy(true);
        const r = await api<{ createdAt: string; counts: Record<string, number> }>('/api/v1/backup/verify', { method: 'POST', form });
        setBusy(false);
        if (r.ok) { setResult(r.data); setError(null); } else { setError(r.error.message); setResult(null); }
      }}>Verify backup</Button>
    </Card>
  );
}
