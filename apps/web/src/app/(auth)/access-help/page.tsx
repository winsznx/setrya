import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/app/auth-card';
import { Callout } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Access help' };

export default function AccessHelpPage() {
  return (
    <AuthCard wide title="Access help" description="Two different things can be locked. Pick the one you are stuck on.">
      <div className="space-y-8">
        <section aria-labelledby="signin">
          <h2 id="signin" className="text-h2">Cannot sign in to Setrya</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-body-s text-ink-secondary">
            <li>Setrya has no email reset. There is one owner, and no mail server is wired into this installation.</li>
            <li>Whoever administers the host can reset the owner password from a shell with <code className="rounded-xs bg-surface-muted px-1 font-mono text-[0.8125rem]">pnpm --filter @setrya/web owner:reset-password</code>. This revokes every session. It does not touch the vault, so records stay encrypted until the vault passphrase is entered.</li>
            <li>If the vault passphrase is lost too, restore an encrypted Setrya backup together with its passphrase. Without both, encrypted records cannot be recovered.</li>
          </ol>
        </section>
        <section aria-labelledby="wallet">
          <h2 id="wallet" className="text-h2">Cannot access the Zcash wallet</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-body-s text-ink-secondary">
            <li>ZEC is controlled by the wallet service on your settlement host. Your Setrya password cannot recover funds.</li>
            <li>Restore the wallet from its 24-word seed backup, which is kept separately from Setrya backups.</li>
            <li>Once the wallet service and its chain connection are healthy again, Setrya reconciles every submitted or unknown transaction before it allows a new payment.</li>
          </ol>
          <Callout tone="warning" className="mt-4">Setrya never asks for, emails or displays a recovery phrase. Anyone who asks you for one through this application is not Setrya.</Callout>
        </section>
        <p className="text-body-s">
          <Link href="/sign-in" className="text-accent-text hover:underline">Back to sign in</Link> · <Link href="/docs#backup" className="text-accent-text hover:underline">Backup &amp; recovery guide</Link>
        </p>
      </div>
    </AuthCard>
  );
}
