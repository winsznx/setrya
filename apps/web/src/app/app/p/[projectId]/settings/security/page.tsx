import { DemoLocked } from '@/components/app/demo-notice';
import { Callout, Card, Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { AutoLockForm, BackupForm, PasswordForm, RevokeSessions, VaultPassphraseForm, VerifyBackup } from './security-forms';

export default async function SecuritySettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, sessions, currentSessionId, autoLockMinutes, demoMode } = await loadView('settings.security', { projectId }, `/app/p/${projectId}/settings/security`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Settings', href: p('/settings') }, { label: 'Security' }]} title="Security and backups" />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Callout tone="warning" title="Setrya data backup is not the Zcash wallet backup">Your ZEC is controlled by the wallet service on the settlement host. Back up its 24-word seed offline. Setrya backups never contain it.</Callout>
        <Callout tone="warning" title="Do not store recovery phrases inside the application">No field in Setrya is meant for a seed or viewing key. Keep them offline.</Callout>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {demoMode ? <DemoLocked title="Sign-in password" reason="Turned off in the shared demo workspace, so no one can lock the others out." /> : <PasswordForm />}
        {demoMode ? <DemoLocked title="Vault passphrase" reason="Turned off in the shared demo workspace, so no one can lock the others out." /> : <VaultPassphraseForm />}
        <Panel title="Active sessions" action={demoMode ? <span className="text-label text-ink-muted">Signing others out is turned off in the demo</span> : <RevokeSessions count={sessions.length - 1} />}>
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="px-5 py-3 text-body-s">
                <div className="flex justify-between gap-2"><span className="truncate">{s.userAgent ?? 'Unknown browser'}</span>{s.id === currentSessionId && <span className="text-success-text">This session</span>}</div>
                <div className="text-label text-ink-muted">Started {formatDateTime(s.createdAt, project.timezone)} · expires {formatDateTime(s.expiresAt, project.timezone)}</div>
              </li>
            ))}
          </ul>
        </Panel>
        <AutoLockForm initial={autoLockMinutes} />
        <div id="backup" className="space-y-6 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          {demoMode ? <DemoLocked title="Encrypted backup" reason="Turned off in the shared demo workspace, so no one can take its data off the host." /> : <BackupForm />}
          {demoMode ? <DemoLocked title="Check a backup" reason="Turned off in the shared demo workspace." /> : <VerifyBackup />}
        </div>
        <Card className="lg:col-span-2">
          <h2 className="text-h3">Restoring</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-s text-ink-secondary">
            <li>Install Setrya on a fresh host, run migrations, and put the same master key file in place.</li>
            <li>Run <code className="rounded-xs bg-surface-muted px-1 font-mono text-[0.8125rem]">pnpm --filter @setrya/api restore-backup &lt;file&gt;</code> and enter the backup password. It refuses to overwrite an installation that already has an owner.</li>
            <li>Sign in with the original owner password and unlock with the vault passphrase from backup time.</li>
            <li>Restore the wallet from its seed separately, wait for it to sync, and let Setrya reconcile every submitted or unknown transaction before preparing anything new.</li>
          </ol>
          <p className="mt-2 text-body-s text-ink-secondary">Two-factor authentication and passkeys are not built yet. Every money-moving action already needs a fresh password confirmation bound to that exact action.</p>
        </Card>
      </div>
    </>
  );
}
