'use client';

import { useState } from 'react';

import { cx } from '@/components/ui/cx';

type Role = 'operator' | 'partner' | 'public';
const ROWS: [string, Record<Role, string>][] = [
  ['Project revenue and fee sources', { operator: 'Yes', partner: 'Only the fee base on their statement', public: 'No' }],
  ['Other partners', { operator: 'Yes', partner: 'No', public: 'No' }],
  ['Agreement terms', { operator: 'Yes', partner: 'Their own terms only', public: 'No' }],
  ['Wallet spending key', { operator: 'Held by the wallet service on your host, never in Setrya’s database', partner: 'No', public: 'No' }],
  ['That a payment happened, and when', { operator: 'Yes', partner: 'Yes, if you share the txid', public: 'Yes' }],
  ['Who was paid and how much', { operator: 'Through your own wallet view', partner: 'Their own payment, in their wallet', public: 'Not from a fully shielded transaction' }],
  ['Statement link key', { operator: 'Only when creating the link', partner: 'Whoever holds the link', public: 'No' }],
];
const LABEL: Record<Role, string> = { operator: 'Operator', partner: 'Partner', public: 'Public observer' };

export function VisibilityMatrix() {
  const [role, setRole] = useState<Role>('operator');
  return (
    <section aria-labelledby="matrix-title">
      <h2 id="matrix-title" className="text-display-l text-ink">What each party can see</h2>
      <div role="tablist" aria-label="Choose a viewpoint" className="mt-6 inline-flex max-w-full flex-wrap rounded-pill bg-surface-muted p-1">
        {(Object.keys(LABEL) as Role[]).map((r) => (
          <button key={r} role="tab" aria-selected={role === r} onClick={() => setRole(r)} className={cx('rounded-pill px-4 py-2 text-body-s font-medium', role === r ? 'bg-brand text-on-brand' : 'text-ink-secondary hover:text-ink')}>{LABEL[r]}</button>
        ))}
      </div>
      <dl role="tabpanel" className="mt-6 divide-y divide-border overflow-hidden rounded-workspace border border-border bg-surface shadow-raised">
        {ROWS.map(([field, v]) => (
          <div key={field} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 md:px-5">
            <dt className="text-body-s font-medium">{field}</dt>
            <dd className={cx('text-body-s', v[role] === 'No' ? 'text-ink-muted' : 'text-ink')}>{v[role]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-body-s text-ink-secondary">The administrator of your server can potentially see anything Setrya decrypts while you are unlocked. Setrya does not claim to protect data from the machine it runs on.</p>
    </section>
  );
}
