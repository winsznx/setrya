'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/field';
import { api } from '@/lib/client/api';

/**
 * Fresh password confirmation that mints a one-time token bound server-side to this exact action and target.
 * The token is handed straight to `onConfirmed` and never stored.
 */
export function StepUpConfirm({ action, targetId, label, children, onConfirmed, disabled, danger }: { action: 'approve_period' | 'sign_transaction'; targetId: string; label: string; children?: ReactNode; onConfirmed: (token: string) => Promise<string | null>; disabled?: boolean; danger?: boolean }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await api<{ token: string }>('/api/v1/auth/step-up', { method: 'POST', body: { password, action, targetId } });
        if (!r.ok) {
          setBusy(false);
          return setError(r.error.message);
        }
        setPassword('');
        const failure = await onConfirmed(r.data.token);
        setBusy(false);
        if (failure) setError(failure);
      }}
    >
      {children}
      <PasswordField label="Confirm with your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      {error && <Callout tone="danger">{error}</Callout>}
      <Button type="submit" size="lg" full busy={busy} disabled={disabled || !password} variant={danger ? 'danger' : 'primary'}>{label}</Button>
    </form>
  );
}
