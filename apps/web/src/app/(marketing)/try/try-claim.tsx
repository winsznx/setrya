'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { ZecMark } from '@/components/brand/zec-mark';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/client/api';

const BASE = '/api/sandbox/v1/sandbox';

interface Claim {
  state: string;
  position: number | null;
  error: string | null;
  txid: string | null;
  confirmations: number;
  statementPath: string | null;
}

const STEPS: { state: string; title: string; detail: string }[] = [
  { state: 'queued', title: 'In line', detail: 'One payment is built at a time, so your claim waits for the one before it.' },
  { state: 'setting_up', title: 'You become a partner', detail: 'A sample project gives you a 20% share of 0.05 TAZ in fees, next to a second partner on 10%.' },
  { state: 'approved', title: 'Snapshot frozen and approved', detail: 'Every payout line is committed to one Merkle root, which goes into each payment memo.' },
  { state: 'inspected', title: 'Checked before signing', detail: 'Fully shielded, Ironwood only, each payee matched to the zatoshi, fee per ZIP 317.' },
  { state: 'authorised', title: 'Signed and broadcast', detail: 'One private transaction pays both partners.' },
  { state: 'confirmed', title: 'Confirmed on chain', detail: 'Testnet blocks arrive about every 25 seconds.' },
  { state: 'ready', title: 'Your statement is ready', detail: 'Open it and verify your payout.' },
];
const ORDER = STEPS.map((s) => s.state);
const POLL_MS = 4_000;

export function TryClaim({ initialClaimId }: { initialClaimId: string | null }) {
  const router = useRouter();
  const [claimId, setClaimId] = useState(initialClaimId);
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);

  useEffect(() => {
    if (!claimId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const r = await api<Claim>(`${BASE}/claims/${claimId}`);
      if (cancelled) return;
      if (r.ok) setClaim(r.data);
      const finished = r.ok && (r.data.state === 'ready' || r.data.state === 'failed');
      if (!finished) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [claimId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const r = await api<{ claimId: string }>(`${BASE}/claims`, { method: 'POST', body: { address } });
    setSubmitting(false);
    if (!r.ok) return setFormError(r.error.fieldErrors?.address ?? r.error.message);
    setClaimId(r.data.claimId);
    router.replace(`/try?claim=${r.data.claimId}`, { scroll: false });
  }

  if (!claimId) {
    return (
      <form onSubmit={submit} className="mt-10 max-w-[46rem] rounded-workspace border border-border bg-surface p-card shadow-raised md:p-6">
        <label htmlFor="address" className="text-h3 text-ink">Your Zcash testnet address</label>
        <p className="mt-1 text-body-s text-ink-secondary">A unified address starting with <code className="font-mono">utest1</code> that has an Orchard receiver. Zingo and Zkool can make one on testnet.</p>
        <textarea id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} spellCheck={false} autoComplete="off" required className="mt-4 w-full rounded-control border border-border-control bg-canvas p-3 font-mono text-[0.875rem] text-ink" placeholder="utest1…" />
        {formError && <p className="mt-2 text-body-s text-danger-text" role="alert">{formError}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={submitting || address.trim().length < 10}>{submitting ? 'Sending your claim' : 'Pay me 0.01 TAZ'}</Button>
          <span className="inline-flex items-center gap-1.5 text-body-s text-ink-muted"><ZecMark size={12} />Testnet coins only. Nothing here has real value.</span>
        </div>
      </form>
    );
  }

  const current = claim ? ORDER.indexOf(claim.state) : 0;
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6">
      <ol className="rounded-workspace border border-border bg-surface p-card shadow-raised md:p-6" aria-live="polite">
        {STEPS.map((step, i) => {
          const done = claim?.state === 'ready' || (current > i && claim?.state !== 'failed');
          const active = current === i && claim?.state !== 'failed' && claim?.state !== 'ready';
          return (
            <li key={step.state} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-pill text-label font-semibold', done ? 'bg-success-soft text-success-text' : active ? 'bg-accent text-white' : 'bg-surface-strong text-ink-muted')}>
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cx('block text-body font-medium', done || active ? 'text-ink' : 'text-ink-muted')}>{step.title}{active && step.state === 'queued' && claim?.position ? `, position ${claim.position}` : ''}</span>
                <span className="block text-body-s text-ink-secondary">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <aside className="space-y-4">
        {claim?.state === 'failed' && <Callout tone="danger" title="This payout stopped">{claim.error}</Callout>}
        {claim?.txid && (
          <div className="rounded-workspace bg-panel-soft p-card md:p-5">
            <p className="text-label font-medium text-ink-muted">Transaction</p>
            <p className="mt-1 break-all font-mono text-[0.8125rem] text-ink">{claim.txid}</p>
            <p className="mt-2 text-body-s text-ink-secondary">{claim.confirmations > 0 ? `${claim.confirmations} confirmation${claim.confirmations === 1 ? '' : 's'}` : 'Waiting for the first block'}. A block explorer can see this transaction exists, but not who it paid or how much.</p>
          </div>
        )}
        {claim?.statementPath && (
          <div className="rounded-workspace bg-band p-card text-white md:p-6">
            <p className="text-h3">Your private statement</p>
            <p className="mt-1 text-body-s text-white/75">Open it to see how your payout was worked out and to verify it against the memo your wallet received.</p>
            <a href={claim.statementPath} className="mt-4 inline-flex min-h-control items-center rounded-pill bg-white px-5 font-medium text-ink">Open my statement</a>
          </div>
        )}
        <p className="text-body-s text-ink-secondary">This sandbox is a separate Setrya installation with its own wallet. <Link href="/docs/for-judges" className="font-medium text-accent-text hover:underline">See the operator side</Link>.</p>
      </aside>
    </div>
  );
}
