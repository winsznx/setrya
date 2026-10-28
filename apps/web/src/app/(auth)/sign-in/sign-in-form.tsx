'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { CheckboxField, PasswordField, TextField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const result = await api('/api/v1/auth/session', { method: 'POST', body: { email: form.get('email'), password: form.get('password'), remember: form.get('remember') === 'on' } });
        setBusy(false);
        if (!result.ok) return setError(result.error.message);
        router.replace(`/unlock?next=${encodeURIComponent(next)}`);
      }}
    >
      {error && <Callout tone="danger">{error}</Callout>}
      <TextField label="Email" name="email" type="email" autoComplete="username" required />
      <PasswordField label="Password" name="password" autoComplete="current-password" required />
      <CheckboxField name="remember" label="Keep me signed in on this device for 7 days" hint="Only the session lasts longer. The vault still locks when idle." />
      <Button type="submit" busy={busy} full size="lg">Sign in</Button>
    </form>
  );
}
