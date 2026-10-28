import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/app/auth-card';
import { loadView } from '@/lib/api/views';

import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const status = await loadView('auth.status');
  if (!status.ownerExists) redirect('/setup-owner');
  if (status.signedIn) redirect('/app');
  const { next } = await searchParams;
  const demoLogin = status.demoMode ? await loadView('auth.demoLogin') : null;
  return (
    <AuthCard
      title="Sign in"
      description="Owner access to this Setrya installation."
      aside={
        <>
          <p className="font-medium text-ink">Your project records stay on the host that runs this workspace.</p>
          <p>Signing in opens your session. Business records stay encrypted until you also unlock the workspace vault.</p>
          <p>Moving money needs a third, fresh confirmation each time.</p>
        </>
      }
    >
      {demoLogin && (
        <details className="mb-6 rounded-module bg-sample-soft px-4 py-3 text-body-s text-sample">
          <summary className="cursor-pointer font-semibold">Judges: demo login</summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-ink">
            <dt className="text-ink-secondary">Email</dt><dd className="break-all font-mono">{demoLogin.email}</dd>
            <dt className="text-ink-secondary">Password</dt><dd className="break-all font-mono">{demoLogin.password}</dd>
            <dt className="text-ink-secondary">Vault passphrase</dt><dd className="break-all font-mono">{demoLogin.vaultPassphrase}</dd>
          </dl>
          <p className="mt-3 text-label text-sample">A shared workspace on Zcash testnet. Payments are capped and use test coins only. <a href="/docs/for-judges" className="font-semibold underline">Five-minute guide</a></p>
        </details>
      )}
      <SignInForm next={next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'} />
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-body-s">
        <Link href="/access-help" className="text-accent-text hover:underline">Need access help?</Link>
        <Link href="/privacy" className="text-ink-secondary hover:text-ink">Privacy</Link>
        <Link href="/docs" className="text-ink-secondary hover:text-ink">Docs</Link>
      </nav>
    </AuthCard>
  );
}
