'use client';

import type { TxState } from '@setrya/domain';
import { useRouter } from 'next/navigation';

import { useSubmit } from '@/components/forms/use-submit';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';

/** Actions follow state: continue a prepared job, investigate an unknown outcome, refresh a broadcast. Never "send again". */
export function PaymentActions({ projectId, periodId, tx }: { projectId: string; periodId: string; tx: { id: string; state: TxState; hasTxid: boolean } | null }) {
  const router = useRouter();
  const { busy, message, submit } = useSubmit();
  if (!tx) return null;
  const send = `/app/p/${projectId}/periods/${periodId}/send`;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {message && <Callout tone="danger" className="w-full">{message}</Callout>}
      {tx.state === 'PREPARED_INSPECTED' && <ButtonLink href={send}>Continue this exact transaction</ButtonLink>}
      {(tx.state === 'BROADCAST_OUTCOME_UNKNOWN' || tx.state === 'INVESTIGATION_REQUIRED') && <ButtonLink href={send} variant="danger">Investigate chain and wallet</ButtonLink>}
      {tx.state === 'FAILED_PRE_BROADCAST' && <ButtonLink href={send} variant="secondary">Read diagnosis and start a new attempt</ButtonLink>}
      {tx.hasTxid && tx.state !== 'CONFIRMED' && <Button variant="secondary" icon="refresh" busy={busy} onClick={async () => { const r = await submit(`/api/v1/payments/transactions/${tx.id}/reconcile`, {}); if (r.ok) router.refresh(); }}>Refresh</Button>}
    </div>
  );
}
