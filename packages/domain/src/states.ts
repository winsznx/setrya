/** Payment lifecycle from PRD 12.6. Transitions not listed here are refused. */

export const TX_STATES = [
  'PREPARING',
  'PREPARED_INSPECTED',
  'PROVING',
  'SIGNED_EXTRACTED',
  'BROADCAST_SUBMITTED',
  'MEMPOOL_OBSERVED',
  'CONFIRMING',
  'CONFIRMED',
  'CANCELLED_BEFORE_SIGN',
  'FAILED_PRE_BROADCAST',
  'BROADCAST_OUTCOME_UNKNOWN',
  'BROADCAST_REJECTED',
  'STALE_OR_REORGED',
  'INVESTIGATION_REQUIRED',
] as const;
export type TxState = (typeof TX_STATES)[number];

const NEXT: Record<TxState, readonly TxState[]> = {
  PREPARING: ['PREPARED_INSPECTED', 'FAILED_PRE_BROADCAST', 'CANCELLED_BEFORE_SIGN'],
  PREPARED_INSPECTED: ['PROVING', 'CANCELLED_BEFORE_SIGN', 'FAILED_PRE_BROADCAST'],
  PROVING: ['SIGNED_EXTRACTED', 'FAILED_PRE_BROADCAST'],
  SIGNED_EXTRACTED: ['BROADCAST_SUBMITTED', 'BROADCAST_OUTCOME_UNKNOWN', 'BROADCAST_REJECTED'],
  BROADCAST_SUBMITTED: ['MEMPOOL_OBSERVED', 'CONFIRMING', 'CONFIRMED', 'BROADCAST_OUTCOME_UNKNOWN', 'BROADCAST_REJECTED', 'INVESTIGATION_REQUIRED'],
  MEMPOOL_OBSERVED: ['CONFIRMING', 'CONFIRMED', 'INVESTIGATION_REQUIRED'],
  CONFIRMING: ['CONFIRMED', 'STALE_OR_REORGED', 'MEMPOOL_OBSERVED'],
  CONFIRMED: ['STALE_OR_REORGED'],
  STALE_OR_REORGED: ['CONFIRMING', 'MEMPOOL_OBSERVED', 'CONFIRMED', 'INVESTIGATION_REQUIRED'],
  BROADCAST_OUTCOME_UNKNOWN: ['MEMPOOL_OBSERVED', 'CONFIRMING', 'CONFIRMED', 'INVESTIGATION_REQUIRED', 'BROADCAST_SUBMITTED'],
  INVESTIGATION_REQUIRED: ['MEMPOOL_OBSERVED', 'CONFIRMING', 'CONFIRMED', 'BROADCAST_SUBMITTED', 'FAILED_PRE_BROADCAST'],
  BROADCAST_REJECTED: [],
  CANCELLED_BEFORE_SIGN: [],
  FAILED_PRE_BROADCAST: [],
};

export function canTransition(from: TxState, to: TxState): boolean {
  return NEXT[from].includes(to);
}

export class StateTransitionError extends Error {
  constructor(
    readonly from: TxState,
    readonly to: TxState,
  ) {
    super(`Refused transition ${from} → ${to}`);
    this.name = 'StateTransitionError';
  }
}

export function assertTransition(from: TxState, to: TxState): void {
  if (!canTransition(from, to)) throw new StateTransitionError(from, to);
}

/** States in which signed bytes exist, so nothing may build a replacement transaction. */
export const SIGNED_STATES: ReadonlySet<TxState> = new Set([
  'SIGNED_EXTRACTED',
  'BROADCAST_SUBMITTED',
  'MEMPOOL_OBSERVED',
  'CONFIRMING',
  'CONFIRMED',
  'BROADCAST_OUTCOME_UNKNOWN',
  'STALE_OR_REORGED',
  'INVESTIGATION_REQUIRED',
]);

export const TERMINAL_FAILURE: ReadonlySet<TxState> = new Set(['CANCELLED_BEFORE_SIGN', 'FAILED_PRE_BROADCAST', 'BROADCAST_REJECTED']);

export const TX_STATE_LABEL: Record<TxState, string> = {
  PREPARING: 'Preparing',
  PREPARED_INSPECTED: 'Prepared, awaiting authorisation',
  PROVING: 'Creating proofs and signing',
  SIGNED_EXTRACTED: 'Signed, not yet broadcast',
  BROADCAST_SUBMITTED: 'Broadcast',
  MEMPOOL_OBSERVED: 'In mempool',
  CONFIRMING: 'Confirming',
  CONFIRMED: 'Confirmed',
  CANCELLED_BEFORE_SIGN: 'Cancelled before signing',
  FAILED_PRE_BROADCAST: 'Failed before broadcast',
  BROADCAST_OUTCOME_UNKNOWN: 'Outcome unknown, investigate',
  BROADCAST_REJECTED: 'Broadcast rejected',
  STALE_OR_REORGED: 'Reorged, re-confirming',
  INVESTIGATION_REQUIRED: 'Investigation required',
};

export const PERIOD_STATUSES = ['draft', 'review', 'approved', 'in_payment', 'settled', 'closed'] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const LOCKED_STATUSES: readonly PeriodStatus[] = ['review', 'approved', 'in_payment', 'settled', 'closed'];

export const PERIOD_STATUS_LABEL: Record<PeriodStatus, string> = {
  draft: 'Draft',
  review: 'Frozen for review',
  approved: 'Approved',
  in_payment: 'In payment',
  settled: 'Payments resolved',
  closed: 'Closed',
};

export const PAYOUT_STATES = ['approved', 'prepared', 'signed', 'broadcast', 'unknown', 'mempool', 'confirming', 'confirmed', 'failed', 'cancelled', 'superseded'] as const;
export type PayoutState = (typeof PAYOUT_STATES)[number];

/** Payout stage shown in ledgers, derived from its transaction. A payout is paid only when its tx is CONFIRMED. */
export function payoutStateFromTx(tx: TxState | null): PayoutState {
  switch (tx) {
    case null:
      return 'approved';
    case 'PREPARING':
    case 'PREPARED_INSPECTED':
    case 'PROVING':
      return 'prepared';
    case 'SIGNED_EXTRACTED':
      return 'signed';
    case 'BROADCAST_SUBMITTED':
      return 'broadcast';
    case 'MEMPOOL_OBSERVED':
      return 'mempool';
    case 'CONFIRMING':
    case 'STALE_OR_REORGED':
      return 'confirming';
    case 'CONFIRMED':
      return 'confirmed';
    case 'BROADCAST_OUTCOME_UNKNOWN':
    case 'INVESTIGATION_REQUIRED':
      return 'unknown';
    case 'CANCELLED_BEFORE_SIGN':
      return 'cancelled';
    case 'FAILED_PRE_BROADCAST':
    case 'BROADCAST_REJECTED':
      return 'failed';
  }
}

export const PAYOUT_STATE_LABEL: Record<PayoutState, string> = {
  approved: 'Approved',
  prepared: 'Prepared',
  signed: 'Signed',
  broadcast: 'Broadcast',
  unknown: 'Broadcast unknown',
  mempool: 'In mempool',
  confirming: 'Confirming',
  confirmed: 'Confirmed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};

export type EvidenceLevel = 'created' | 'signed' | 'broadcast' | 'confirmed' | 'wallet_visible' | 'self_acknowledged';

/** How a statement describes the payment behind it. */
export type PaymentStatus = 'approved_not_paid' | 'pending' | 'confirmed' | 'failed' | 'held';

export const WATERMARK: Record<PaymentStatus, string> = {
  approved_not_paid: 'APPROVED — NOT PAID',
  pending: 'PAYMENT PENDING',
  confirmed: 'CONFIRMED ON CHAIN',
  failed: 'PAYMENT NOT COMPLETED',
  held: 'HELD — NOT PAID',
};
