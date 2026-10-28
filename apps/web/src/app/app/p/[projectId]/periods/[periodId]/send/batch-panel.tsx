'use client';

import { formatZec, shortFingerprint, TX_STATE_LABEL, type TxState } from '@setrya/domain';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { TxStateBadge } from '@/components/app/status';
import { useSubmit } from '@/components/forms/use-submit';
import { StepUpConfirm } from '@/components/period/step-up';
import { Zec } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Callout, Panel } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/client/api';

export interface BatchView {
  id: string;
  sequence: number;
  of: number;
  totalZat: string;
  recipients: { id: string; name: string; zat: string; fingerprint: string; memo: string }[];
  tx: null | { id: string; state: TxState; txid: string | null; feeZat: string | null; confirmations: number; height: number | null; diagnosis: string | null; lastError: string | null; lastCheckedAt: string | null; broadcastAt: string | null; lineage: number; walletObserved: boolean; pcztHash: string | null };
  review: null | { ok: boolean; feeZat: string | null; pool: string | null; expiryHeight: number | null; checks: { id: string; label: string; pass: boolean; detail: string }[]; matched: number };
  attempts: { id: string; stage: string; outcome: string; at: string; detail: string | null; errorCode: string | null; requestId: string }[];
}

const STAGES = ['Checking wallet', 'Preparing transaction', 'Inspecting privacy', 'Waiting for approval', 'Creating proofs', 'Signing', 'Broadcasting', 'Awaiting network', 'Confirmed'];

function stageIndex(state: TxState | null): number {
  switch (state) {
    case null: return 0;
    case 'PREPARING': return 1;
    case 'PREPARED_INSPECTED': return 3;
    case 'PROVING': return 4;
    case 'SIGNED_EXTRACTED': return 6;
    case 'BROADCAST_SUBMITTED':
    case 'MEMPOOL_OBSERVED':
    case 'CONFIRMING':
    case 'STALE_OR_REORGED': return 7;
    case 'CONFIRMED': return 8;
    default: return -1;
  }
}

const LIVE: TxState[] = ['PREPARING', 'PREPARED_INSPECTED', 'PROVING', 'SIGNED_EXTRACTED', 'BROADCAST_SUBMITTED', 'MEMPOOL_OBSERVED', 'CONFIRMING', 'STALE_OR_REORGED', 'BROADCAST_OUTCOME_UNKNOWN', 'INVESTIGATION_REQUIRED'];
const DIAGNOSES = ['Wallet locked', 'Not fully shielded', 'Insufficient confirmed funds', 'Unable to prove', 'Broadcast rejected', 'Unknown broadcast outcome', 'Chain reorg', 'Recipient confirmation unavailable'];

export function BatchPanel({ batch, projectId, periodId, canPay, payBlockers, targetConfirmations, timezone, network }: { batch: BatchView; projectId: string; periodId: string; canPay: boolean; payBlockers: string[]; targetConfirmations: number; timezone: string; network: string }) {
  const router = useRouter();
  const tx = batch.tx;
  const state = tx?.state ?? null;
  const prep = useSubmit<{ txId: string; state: TxState }>();
  const action = useSubmit();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [showIds, setShowIds] = useState(false);
  const lastState = useRef(state);

  useEffect(() => {
    if (!tx || !LIVE.includes(tx.state)) return;
    const poll = setInterval(async () => {
      const r = await api<{ state: TxState; confirmations: number }>(`/api/v1/payments/transactions/${tx.id}`);
      if (r.ok && (r.data.state !== lastState.current || r.data.confirmations !== tx.confirmations)) {
        lastState.current = r.data.state;
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [tx, router]);

  const current = stageIndex(state);
  const failed = state !== null && current === -1;
  const terminalRetry = state === null || state === 'FAILED_PRE_BROADCAST' || state === 'CANCELLED_BEFORE_SIGN' || state === 'BROADCAST_REJECTED';

  return (
    <Panel title={`Transaction ${batch.sequence} of ${batch.of}`} action={state ? <TxStateBadge state={state} /> : <span className="text-body-s text-ink-secondary">Approved, not prepared</span>}>
      <div className="grid gap-6 p-4 md:p-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <ol aria-label="Payment stages" className="space-y-1.5">
          {STAGES.map((s, i) => {
            const done = !failed && current > i;
            const now = !failed && current === i;
            return (
              <li key={s} className={cx('flex items-center gap-2.5 text-body-s', done ? 'text-ink' : now ? 'font-semibold text-ink' : 'text-ink-muted')}>
                <span className={cx('grid size-5 place-items-center rounded-pill', done ? 'bg-success text-white' : now ? 'bg-brand text-on-brand' : 'border border-border-strong')}>{done ? <Icon name="check" size={11} strokeWidth={2.6} /> : now ? <span className="size-1.5 rounded-pill bg-current" /> : null}</span>
                {s}
                <span className="sr-only">{done ? ' done' : now ? ' current' : ''}</span>
              </li>
            );
          })}
        </ol>

        <div className="min-w-0 space-y-4" aria-live="polite">
          <ul className="divide-y divide-border rounded-row border border-border">
            {batch.recipients.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-body-s">
                <span className="min-w-0"><span className="font-medium">{r.name}</span> <span className="font-mono text-label text-ink-muted">{shortFingerprint(r.fingerprint)}</span> <span className="text-label text-ink-muted">memo {r.memo}</span></span>
                <Zec zat={r.zat} trim={false} />
              </li>
            ))}
            <li className="flex justify-between px-3 py-2 text-body-s font-semibold"><span>Total to recipients</span><Zec zat={batch.totalZat} trim={false} /></li>
          </ul>

          {terminalRetry && (
            <>
              {state === 'FAILED_PRE_BROADCAST' || state === 'BROADCAST_REJECTED' ? (
                <Callout tone="danger" title={`Diagnosis: ${tx?.diagnosis ?? 'Failed'}`}>{tx?.lastError}<span className="mt-1 block">Nothing was broadcast{state === 'BROADCAST_REJECTED' ? ' successfully; the node refused it' : ''}. You can prepare a fresh transaction after reading this. It will need its own inspection and authorisation.</span></Callout>
              ) : state === 'CANCELLED_BEFORE_SIGN' ? <Callout tone="info" title="Cancelled before signing">{tx?.diagnosis}</Callout> : null}
              {prep.message && <Callout tone="danger">{prep.message}</Callout>}
              {canPay ? (
                <Button size="lg" icon="payments" busy={prep.busy} onClick={async () => { const r = await prep.submit('/api/v1/payments/prepare', { body: { batchId: batch.id } }); if (r.ok) router.refresh(); }}>{state ? 'Prepare a new transaction' : 'Prepare transaction'}</Button>
              ) : (
                <div className="space-y-1.5"><Button size="lg" icon="lock" disabled>Prepare transaction</Button><p className="text-body-s text-ink-secondary">Blocked: {payBlockers.join('; ')}.</p></div>
              )}
              <p className="text-body-s text-ink-muted">Preparing asks the wallet service for a FullPrivacy proposal from one shielded pool and inspects it. Nothing is signed.</p>
            </>
          )}

          {state === 'PREPARING' && <Callout tone="info" title="Preparing transaction">Asking the wallet for a fully shielded proposal.</Callout>}

          {state === 'PREPARED_INSPECTED' && batch.review && tx && (
            <div className="space-y-4">
              <div className="rounded-row border border-border">
                <div className="border-b border-border px-3 py-2 text-body-s font-semibold">Wallet inspection of the prepared transaction</div>
                <ul className="divide-y divide-border">
                  {batch.review.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5 px-3 py-2 text-body-s">
                      <Icon name={c.pass ? 'check' : 'x'} size={15} className={c.pass ? 'mt-0.5 text-success' : 'mt-0.5 text-danger'} />
                      <span><span className="font-medium">{c.label}</span><span className="block text-ink-secondary">{c.detail}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-body-s sm:grid-cols-4">
                <div><dt className="text-ink-secondary">Recipients</dt><dd><Zec zat={batch.totalZat} /></dd></div>
                <div><dt className="text-ink-secondary">Network fee</dt><dd>{batch.review.feeZat ? <Zec zat={batch.review.feeZat} trim={false} /> : '—'}</dd></div>
                <div><dt className="text-ink-secondary">Total leaving account</dt><dd className="font-semibold">{batch.review.feeZat ? <Zec zat={(BigInt(batch.totalZat) + BigInt(batch.review.feeZat)).toString()} /> : '—'}</dd></div>
                <div><dt className="text-ink-secondary">Pool</dt><dd className="capitalize">{batch.review.pool ?? '—'}</dd></div>
              </dl>
              <p className="text-label text-ink-muted">Inspection is the wallet&apos;s constructor metadata. Proofs and signatures are verified cryptographically when the transaction is extracted, before anything is broadcast.</p>
              <StepUpConfirm
                action="sign_transaction"
                targetId={tx.id}
                label={`Authorise ${formatZec(BigInt(batch.totalZat) + BigInt(batch.review.feeZat ?? '0'), { trim: true })} ZEC transaction`}
                disabled={!canPay}
                onConfirmed={async (token) => {
                  const r = await api(`/api/v1/payments/transactions/${tx.id}/sign`, { method: 'POST', body: { stepUpToken: token } });
                  if (!r.ok) return r.error.message;
                  router.refresh();
                  return null;
                }}
              />
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>Cancel this preparation</Button>
            </div>
          )}

          {state === 'PROVING' && <Callout tone="info" title="Preparing privacy proofs">This can take longer on first use while the wallet loads its proving keys. There is no progress percentage because the wallet does not report one. You can leave this page; the job is recorded and cannot be started twice.</Callout>}
          {state === 'SIGNED_EXTRACTED' && <Callout tone="warning" title="Transaction prepared, not yet broadcast">The signed bytes are stored encrypted. Submission to the network is next. If this page reloads, the same bytes are used.</Callout>}

          {tx?.txid && (
            <div className="space-y-2 rounded-row border border-border p-3 text-body-s">
              <div className="flex flex-wrap items-center gap-2"><span className="text-ink-secondary">txid</span><code className="break-all font-mono text-[0.75rem]">{tx.txid}</code><CopyButton value={tx.txid} label="Copy txid" /></div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span>Confirmations <strong className="tnum">{tx.confirmations}</strong> of {targetConfirmations}</span>
                {tx.height !== null && <span>Block {tx.height}</span>}
                {tx.broadcastAt && <span>Broadcast {new Date(tx.broadcastAt).toLocaleString('en-GB', { timeZone: timezone })}</span>}
                {tx.lastCheckedAt && <span className="text-ink-muted">Last checked {new Date(tx.lastCheckedAt).toLocaleTimeString('en-GB', { timeZone: timezone })}</span>}
                <span>{tx.walletObserved ? 'Wallet-visible: yes' : 'Wallet-visible: not yet'}</span>
              </div>
              <p className="text-label text-ink-muted">A public explorer shows only that a {network.toLowerCase()} transaction exists. It cannot prove a shielded recipient or amount. No status says paid until {targetConfirmations} confirmations.</p>
              {state !== 'CONFIRMED' && <Button size="sm" variant="secondary" icon="refresh" busy={action.busy} onClick={async () => { await action.submit(`/api/v1/payments/transactions/${tx.id}/reconcile`, {}); router.refresh(); }}>Refresh from node</Button>}
            </div>
          )}

          {(state === 'BROADCAST_OUTCOME_UNKNOWN' || state === 'INVESTIGATION_REQUIRED' || state === 'STALE_OR_REORGED') && tx && (
            <Callout tone="danger" title={state === 'STALE_OR_REORGED' ? 'Chain reorg: confirmation was lost' : 'Outcome unknown, investigation required'}>
              {state === 'STALE_OR_REORGED' ? 'The block holding this transaction is no longer on the best chain. Setrya keeps watching; it usually reconfirms. Statements show the demoted state.' : 'The node may or may not have accepted this transaction. Sending again is disabled. Investigate first: Setrya asks the node and wallet about this exact txid.'}
              <span className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="search" busy={action.busy} onClick={async () => { await action.submit(`/api/v1/payments/transactions/${tx.id}/reconcile`, {}); router.refresh(); }}>Investigate chain and wallet</Button>
                {state !== 'STALE_OR_REORGED' && <Button size="sm" variant="secondary" busy={action.busy} onClick={async () => { const r = await action.submit(`/api/v1/payments/transactions/${tx.id}/resubmit`, {}); if (r.ok) router.refresh(); }}>Resubmit the same signed transaction</Button>}
                {state === 'INVESTIGATION_REQUIRED' && <Button size="sm" variant="ghost" onClick={() => setDeclareOpen(true)}>Declare not broadcast</Button>}
              </span>
              {action.message && <span className="mt-2 block text-danger-text">{action.message}</span>}
            </Callout>
          )}

          {state === 'CONFIRMED' && <Callout tone="success" title="Confirmed on chain">{targetConfirmations}+ confirmations observed by the node. This is chain evidence, not proof that the recipient saw the funds in their own wallet.</Callout>}

          <details className="rounded-row border border-border">
            <summary className="cursor-pointer px-3 py-2 text-body-s font-medium">Event log ({batch.attempts.length})</summary>
            <div className="border-t border-border px-3 py-2">
              <label className="mb-2 flex items-center gap-2 text-label text-ink-secondary"><input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} /> Show correlation IDs</label>
              <ol className="space-y-1.5 text-body-s">
                {batch.attempts.map((a) => (
                  <li key={a.id} className="grid gap-x-3 sm:grid-cols-[8.5rem_7rem_1fr]">
                    <time className="tnum text-ink-muted" dateTime={a.at}>{new Date(a.at).toLocaleTimeString('en-GB', { timeZone: timezone })}</time>
                    <span className="font-medium">{a.stage} · {a.outcome}</span>
                    <span className="min-w-0 break-words text-ink-secondary">{a.detail}{a.errorCode ? ` (${a.errorCode})` : ''}{showIds ? ` · ${a.requestId}` : ''}</span>
                  </li>
                ))}
                {batch.attempts.length === 0 && <li className="text-ink-muted">No events yet.</li>}
              </ol>
              {tx && <p className="mt-2 text-label text-ink-muted">Attempt lineage {tx.lineage}{tx.pcztHash ? ` · PCZT ${tx.pcztHash.slice(0, 12)}…` : ''} · {tx.state ? TX_STATE_LABEL[tx.state] : ''}</p>}
            </div>
          </details>
          <p className="text-label text-ink-muted">Possible diagnoses: {DIAGNOSES.join(', ')}.</p>
        </div>
      </div>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel preparation" footer={<><Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep it</Button><Button variant="danger" busy={action.busy} onClick={async () => { const r = await action.submit(`/api/v1/payments/transactions/${tx!.id}/cancel`, { body: { reason } }); if (r.ok) { setCancelOpen(false); router.refresh(); } }}>Cancel preparation</Button></>}>
        <p className="mb-3 text-body-s text-ink-secondary">Nothing has been signed. Cancelling discards this proposal; you can prepare again.</p>
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
      <Dialog open={declareOpen} onClose={() => setDeclareOpen(false)} title="Declare not broadcast" footer={<><Button variant="ghost" onClick={() => setDeclareOpen(false)}>Back</Button><Button variant="danger" busy={action.busy} onClick={async () => { const r = await action.submit(`/api/v1/payments/transactions/${tx!.id}/declare-not-broadcast`, { body: { reason } }); if (r.ok) { setDeclareOpen(false); router.refresh(); } }}>Declare and allow a new attempt</Button></>}>
        {action.message && <Callout tone="danger" className="mb-3">{action.message}</Callout>}
        <p className="mb-3 text-body-s text-ink-secondary">Allowed only when the node has never seen this txid and the signed transaction has passed its expiry height{batch.review?.expiryHeight ? ` (block ${batch.review.expiryHeight})` : ''}, so it can no longer be mined. A new attempt needs fresh preparation and authorisation.</p>
        <TextAreaField label="What you checked" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </Panel>
  );
}
