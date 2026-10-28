'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { CheckboxField, PasswordField, SelectField, TextField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

import { StrengthMeter } from './strength-meter';
import { timeZones } from '@/lib/client/time-zones';

export function SetupOwnerForm({ defaultTimezone }: { defaultTimezone: string }) {
  const router = useRouter();
  const zones = useMemo(timeZones, []);
  const browserZone = typeof window === 'undefined' ? defaultTimezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [password, setPassword] = useState('');
  const [vault, setVault] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setErrors({});
        setMessage(null);
        const result = await api('/api/v1/bootstrap/owner', {
          method: 'POST',
          body: {
            displayName: f.get('displayName'),
            email: f.get('email'),
            password: f.get('password'),
            confirmPassword: f.get('confirmPassword'),
            vaultPassphrase: f.get('vaultPassphrase'),
            confirmVaultPassphrase: f.get('confirmVaultPassphrase'),
            setupToken: f.get('setupToken'),
            timezone: f.get('timezone'),
            acknowledge: f.get('acknowledge') === 'on',
          },
        });
        setBusy(false);
        if (!result.ok) {
          setErrors(result.error.fieldErrors ?? {});
          return setMessage(result.error.message);
        }
        router.replace('/onboarding');
      }}
    >
      {message && <Callout tone="danger">{message}</Callout>}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-h3">Owner account</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Display name" name="displayName" autoComplete="name" required error={errors.displayName} />
          <TextField label="Email" name="email" type="email" autoComplete="username" required error={errors.email} hint="Only identifies this local account. Setrya never emails it." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <PasswordField label="Sign-in password" name="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
            <StrengthMeter value={password} />
          </div>
          <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" required error={errors.confirmPassword} />
        </div>
        <SelectField label="Time zone" name="timezone" defaultValue={zones.includes(browserZone) ? browserZone : 'UTC'} error={errors.timezone}>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </SelectField>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-h3">Workspace vault</legend>
        <p className="text-body-s text-ink-secondary">The vault passphrase, combined with this host's master key, encrypts partner names, addresses, agreements, revenue rows and statements. Use a different secret from your password.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <PasswordField label="Vault passphrase" name="vaultPassphrase" autoComplete="new-password" required value={vault} onChange={(e) => setVault(e.target.value)} error={errors.vaultPassphrase} />
            <StrengthMeter value={vault} />
          </div>
          <PasswordField label="Confirm vault passphrase" name="confirmVaultPassphrase" autoComplete="new-password" required error={errors.confirmVaultPassphrase} />
        </div>
        <Callout tone="warning" title="Workspace recovery and Zcash wallet recovery are different">
          This passphrase cannot recover ZEC. Your Zcash spending keys live in the wallet service on the settlement host and are backed up as its 24-word seed. If you lose this passphrase and have no Setrya backup, encrypted records cannot be read.
        </Callout>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-h3">Installation</legend>
        <PasswordField label="Setup token" name="setupToken" autoComplete="off" required error={errors.setupToken} hint="The SETRYA_SETUP_TOKEN value set when this host was deployed." />
        <CheckboxField name="acknowledge" label="I understand that only I can recover this workspace, and that wallet keys are backed up separately." error={errors.acknowledge} />
      </fieldset>

      <Button type="submit" busy={busy} size="lg" full>Create owner</Button>
    </form>
  );
}
