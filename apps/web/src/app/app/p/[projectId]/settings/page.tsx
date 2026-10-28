import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { LockNowButton } from './lock-now';

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, connectionName, wallet, autoLockMinutes, network } = await loadView('settings.index', { projectId }, `/app/p/${projectId}/settings`);
  const p = (rest: string) => projectPath(project.id, `/settings${rest}`);
  const cards: { href: string; icon: IconName; title: string; status: string }[] = [
    { href: p('/project'), icon: 'overview', title: 'Project', status: `${project.name} · ${project.currency} · ${project.timezone}${project.archived ? ' · archived' : ''}` },
    { href: p('/settlement'), icon: 'periods', title: 'Settlement defaults', status: `${project.targetConfirmations} confirmations to count as paid · up to ${project.maxRecipientsPerBatch} recipients per transaction` },
    { href: p('/privacy'), icon: 'shield', title: 'Privacy and data', status: `Share links expire after ${project.shareExpiryDays} days · analytics off` },
    { href: p('/security'), icon: 'lock', title: 'Security and backups', status: `Auto-lock after ${autoLockMinutes} minutes idle` },
    { href: p('/integrations'), icon: 'wallet', title: 'Wallet integrations', status: wallet.label },
  ];
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Settings' }]} title="Settings" actions={<LockNowButton />} />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link prefetch={false} key={c.href} href={c.href} className="group">
            <Card className="flex h-full items-start gap-4 transition-colors group-hover:border-border-strong">
              <span className="grid size-10 shrink-0 place-items-center rounded-row bg-surface-muted text-ink-secondary"><Icon name={c.icon} /></span>
              <span className="min-w-0 flex-1"><span className="block text-h3">{c.title}</span><span className="mt-0.5 block text-body-s text-ink-secondary">{c.status}</span></span>
              <span className="text-body-s font-medium text-accent-text">Manage</span>
            </Card>
          </Link>
        ))}
        <Card muted>
          <h2 className="text-h3">About and diagnostics</h2>
          <dl className="mt-2 space-y-1 text-body-s">
            <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Version</dt><dd>Setrya {process.env.npm_package_version ?? '0.1.0'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Configured chain</dt><dd>{network}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-secondary">Wallet connection</dt><dd>{connectionName ?? 'not configured'}</dd></div>
          </dl>
          <p className="mt-2 text-label text-ink-muted">No secret material is shown here or anywhere in the app.</p>
        </Card>
      </div>
    </>
  );
}
