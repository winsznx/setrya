import { PAYOUT_STATE_LABEL, PERIOD_STATUS_LABEL, type PayoutState, type PeriodStatus, TX_STATE_LABEL, type TxState } from '@setrya/domain';

import { Badge, type Tone } from '@/components/ui/badge';
import type { IconName } from '@/components/ui/icons';

const PERIOD_TONE: Record<PeriodStatus, Tone> = { draft: 'neutral', review: 'accent', approved: 'accent', in_payment: 'warning', settled: 'success', closed: 'neutral' };
const PERIOD_ICON: Record<PeriodStatus, IconName> = { draft: 'file', review: 'lock', approved: 'check', in_payment: 'clock', settled: 'check', closed: 'lock' };

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  return <Badge tone={PERIOD_TONE[status]} icon={PERIOD_ICON[status]}>{PERIOD_STATUS_LABEL[status]}</Badge>;
}

const PAYOUT_TONE: Record<PayoutState, Tone> = { approved: 'accent', prepared: 'accent', signed: 'warning', broadcast: 'warning', unknown: 'danger', mempool: 'warning', confirming: 'warning', confirmed: 'success', failed: 'danger', cancelled: 'neutral', superseded: 'neutral' };
const PAYOUT_ICON: Partial<Record<PayoutState, IconName>> = { approved: 'check', prepared: 'file', signed: 'lock', broadcast: 'clock', mempool: 'clock', confirming: 'clock', cancelled: 'x', superseded: 'x' };

export function PayoutStateBadge({ state }: { state: PayoutState }) {
  return <Badge tone={PAYOUT_TONE[state]} icon={PAYOUT_ICON[state]}>{PAYOUT_STATE_LABEL[state]}</Badge>;
}

const TX_TONE: Record<TxState, Tone> = {
  PREPARING: 'neutral',
  PREPARED_INSPECTED: 'accent',
  PROVING: 'warning',
  SIGNED_EXTRACTED: 'warning',
  BROADCAST_SUBMITTED: 'warning',
  MEMPOOL_OBSERVED: 'warning',
  CONFIRMING: 'warning',
  CONFIRMED: 'success',
  CANCELLED_BEFORE_SIGN: 'neutral',
  FAILED_PRE_BROADCAST: 'danger',
  BROADCAST_OUTCOME_UNKNOWN: 'danger',
  BROADCAST_REJECTED: 'danger',
  STALE_OR_REORGED: 'danger',
  INVESTIGATION_REQUIRED: 'danger',
};

export function TxStateBadge({ state }: { state: TxState }) {
  return <Badge tone={TX_TONE[state]} icon={state === 'CONFIRMED' ? 'check' : TX_TONE[state] === 'warning' ? 'clock' : undefined}>{TX_STATE_LABEL[state]}</Badge>;
}

export function RowStatusBadge({ status }: { status: 'payable' | 'held' | 'credit' | 'nothing_owed' }) {
  if (status === 'payable') return <Badge tone="accent" icon="check">Payable</Badge>;
  if (status === 'held') return <Badge tone="warning">Held</Badge>;
  if (status === 'credit') return <Badge tone="warning">Credit</Badge>;
  return <Badge tone="neutral" icon={null}>Nothing owed</Badge>;
}

export function PayabilityBadge({ payability }: { payability: string }) {
  if (payability === 'ok') return <Badge tone="success">Verified format</Badge>;
  if (payability === 'ADDRESS_MISSING') return <Badge tone="neutral" icon="info">Missing</Badge>;
  if (payability === 'ADDRESS_UNCONFIRMED') return <Badge tone="warning">Requires confirmation</Badge>;
  return <Badge tone="danger">Unsupported</Badge>;
}
