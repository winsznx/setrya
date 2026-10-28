import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/app/auth-card';
import { Icon } from '@/components/ui/icons';
import { loadView } from '@/lib/api/views';

import { UnlockForm } from './unlock-form';

export const metadata: Metadata = { title: 'Unlock workspace', robots: { index: false } };

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await loadView('auth.unlock');
  const { next } = await searchParams;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  if (session.unlocked) redirect(target);
  const demoLogin = (await loadView('auth.status')).demoMode ? await loadView('auth.demoLogin') : null;
  return (
    <AuthCard
      title="Unlock workspace"
      description={
        <span className="flex items-center gap-2">
          <Icon name="lock" className="text-ink-muted" /> Signed in as {session.ownerName}
        </span>
      }
      aside={
        <>
          <p>Locking hides decrypted records in this browser and drops the key from server memory. It does not stop the Zcash wallet service, which keeps following the chain on the settlement host.</p>
          <p>The workspace locks itself after a period without activity.</p>
          <p>
            Lost the passphrase? Restore from an encrypted Setrya backup, described in <Link href="/docs/recovery" className="text-accent-text hover:underline">Backups and recovery</Link>. Without a backup and the passphrase, encrypted records are lost for good.
          </p>
        </>
      }
    >
      {demoLogin && (
        <p className="mb-6 rounded-module bg-sample-soft px-4 py-3 text-body-s text-sample">
          Demo vault passphrase: <span className="break-all font-mono text-ink">{demoLogin.vaultPassphrase}</span>
        </p>
      )}
      <UnlockForm next={target} />
    </AuthCard>
  );
}
