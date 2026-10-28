'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const result = await api('/api/v1/vault/unlock', { method: 'POST', body: { passphrase: new FormData(e.currentTarget).get('passphrase') } });
          setBusy(false);
          if (!result.ok) return setError(result.error.message);
          router.replace(next);
        }}
      >
        {error && <Callout tone="danger">{error}</Callout>}
        <PasswordField label="Vault passphrase" name="passphrase" autoComplete="current-password" required autoFocus />
        <Button type="submit" busy={busy} full size="lg" icon="unlock">Unlock workspace</Button>
      </form>
      <Button
        variant="ghost"
        full
        icon="signOut"
        onClick={async () => {
          await api('/api/v1/auth/session', { method: 'DELETE' });
          router.replace('/sign-in');
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
