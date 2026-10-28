import { getDb, schema, eq, and, inArray, sql, desc } from '@setrya/db';
import { assertTransition, payoutStateFromTx, SIGNED_STATES, TERMINAL_FAILURE, type TxState } from '@setrya/domain';
import { log, sha256 } from '@setrya/security';
import { WalletError, type InspectionReview, ZalletAdapter } from '@setrya/wallet-adapter';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../../http/route';
import { audit } from '../audit';
import { Cipher } from '../crypto-ctx';
import { consumeStepUp } from '../owner';
import type { UnlockedContext } from '../session';
import { walletAdapter, walletHealth, invalidateWalletHealth } from '../wallet';
import { batchDigest, batchIntents, expectedOutputs, loadBatch, loadTx, type ChainTxRow } from './context';
import { transactionScope } from './scope';

/** States in which a payer account has a transaction under construction; only one may exist per account (Z19). */
const IN_FLIGHT: TxState[] = ['PREPARING', 'PREPARED_INSPECTED', 'PROVING', 'SIGNED_EXTRACTED'];

const WALLET_DIAGNOSIS: Partial<Record<WalletError['code'], string>> = {
  WALLET_UNAVAILABLE: 'Wallet unavailable',
  WALLET_TIMEOUT: 'Wallet did not answer in time',
  WALLET_LOCKED: 'Wallet locked',
  INSUFFICIENT_SHIELDED_FUNDS: 'Insufficient confirmed funds',
  PRIVACY_POLICY_REJECTED: 'Not fully shielded',
  TRANSACTION_MISMATCH: 'Prepared transaction does not match approval',
  CAPABILITY_MISSING: 'Wallet does not support the PCZT path',
  BROADCAST_REJECTED: 'Broadcast rejected',
  BROADCAST_OUTCOME_UNKNOWN: 'Unknown broadcast outcome',
};

function adapterOrThrow(): ZalletAdapter {
  const a = walletAdapter();
  if (!(a instanceof ZalletAdapter)) throw new ApiError('WALLET_UNAVAILABLE', a.problem);
  return a;
}

async function attempt(batchId: string, chainTransactionId: string | null, stage: string, outcome: string, detail?: string, errorCode?: string) {
  await getDb().insert(schema.paymentAttempts).values({ batchId, chainTransactionId, stage, outcome, requestId: randomUUID(), detail: detail?.slice(0, 500) ?? null, errorCode: errorCode ?? null });
}

/** Moves a transaction through the state machine with an optimistic version check, then mirrors payout states. */
async function transition(row: ChainTxRow, to: TxState, patch: Partial<typeof schema.chainTransactions.$inferInsert> = {}): Promise<ChainTxRow> {
  assertTransition(row.state as TxState, to);
  const [next] = await getDb()
    .update(schema.chainTransactions)
    .set({ ...patch, state: to, version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(schema.chainTransactions.id, row.id), eq(schema.chainTransactions.version, row.version)))
    .returning();
  if (!next) throw new ApiError('CONFLICT', 'Another worker changed this transaction. Reload to see its current state.');
  await getDb().update(schema.payoutIntents).set({ state: payoutStateFromTx(to), chainTransactionId: row.id, updatedAt: new Date() }).where(eq(schema.payoutIntents.batchId, row.batchId));
  await syncBatchAndPeriod(row.batchId);
  return next;
}

async function syncBatchAndPeriod(batchId: string) {
  const [batch] = await getDb().select().from(schema.paymentBatches).where(eq(schema.paymentBatches.id, batchId));
  if (!batch) return;
  const [latest] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.batchId, batchId)).orderBy(desc(schema.chainTransactions.lineage)).limit(1);
  const status = latest ? latest.state.toLowerCase() : 'approved';
  await getDb().update(schema.paymentBatches).set({ status, feeZat: latest?.feeZat ?? null, updatedAt: new Date() }).where(eq(schema.paymentBatches.id, batchId));
  const [approval] = await getDb().select().from(schema.approvals).where(eq(schema.approvals.id, batch.approvalId));
  if (!approval || approval.invalidatedAt) return;
  const batches = await getDb().select({ id: schema.paymentBatches.id }).from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approval.id));
  const states: (TxState | null)[] = [];
  for (const b of batches) {
    const [t] = await getDb().select({ state: schema.chainTransactions.state }).from(schema.chainTransactions).where(eq(schema.chainTransactions.batchId, b.id)).orderBy(desc(schema.chainTransactions.lineage)).limit(1);
    states.push((t?.state as TxState | undefined) ?? null);
  }
  const resolved = states.every((s) => s === 'CONFIRMED' || (s !== null && TERMINAL_FAILURE.has(s)));
  const started = states.some((s) => s !== null && !TERMINAL_FAILURE.has(s));
  const periodStatus = resolved && states.some((s) => s === 'CONFIRMED') ? 'settled' : started ? 'in_payment' : 'approved';
  await getDb().update(schema.periods).set({ status: periodStatus, updatedAt: new Date() }).where(and(eq(schema.periods.id, approval.periodId), inArray(schema.periods.status, ['approved', 'in_payment', 'settled'])));
}

export interface PrepareResult {
  txId: string;
  state: TxState;
  review: InspectionReview | null;
}

/**
 * Builds a PCZT under FullPrivacy for one approved batch and compares the wallet's inspection with the approval.
 * Returns the existing in-progress transaction instead of building a second one, so retries are idempotent.
 */
export async function prepareBatch(ctx: UnlockedContext, batchId: string): Promise<PrepareResult> {
  const { batch, approval, intents } = await loadBatch(ctx.ownerId, batchId);
  if (approval.invalidatedAt) throw new ApiError('STALE_PERIOD_REVISION', 'This approval was invalidated. Approve the new revision first.');
  const existing = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.batchId, batch.id)).orderBy(desc(schema.chainTransactions.lineage));
  const live = existing.find((t) => !TERMINAL_FAILURE.has(t.state as TxState));
  if (live) return { txId: live.id, state: live.state as TxState, review: live.inspectionEnc ? ctx.cipher.decJson<InspectionReview>('chain_transactions', live.id, 'inspection', live.inspectionEnc) : null };

  const adapter = adapterOrThrow();
  const [project] = await getDb().select({ minConf: schema.projects.minConfirmations }).from(schema.projects).innerJoin(schema.periods, eq(schema.periods.projectId, schema.projects.id)).where(eq(schema.periods.id, approval.periodId));
  const minConf = project?.minConf ?? 1;
  const health = await walletHealth({ maxAgeMs: 0, minConf });
  if (!health.canPay) throw new ApiError(health.zallet.reachable ? 'WALLET_NOT_SYNCED' : 'WALLET_UNAVAILABLE', `The wallet cannot pay right now: ${health.blockers.join('; ')}.`);
  if (health.network.detected !== batch.network) throw new ApiError('CHAIN_MISMATCH', `Approval is for ${batch.network} but the wallet is on ${health.network.detected}.`);
  if (approval.accountId !== adapter.config.accountUuid) throw new ApiError('CHAIN_MISMATCH', 'The configured payer account differs from the approved one.');

  const txId = randomUUID();
  const lineage = (existing[0]?.lineage ?? 0) + 1;
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payer:${batch.payerAccountId}`}))`);
    const busy = await tx.select({ id: schema.chainTransactions.id }).from(schema.chainTransactions).innerJoin(schema.paymentBatches, eq(schema.paymentBatches.id, schema.chainTransactions.batchId)).where(and(eq(schema.paymentBatches.payerAccountId, batch.payerAccountId), inArray(schema.chainTransactions.state, IN_FLIGHT)));
    if (busy.length > 0) throw new ApiError('CONFLICT', 'Another payment from this account is being built or signed. Finish or cancel it first.');
    await tx.insert(schema.chainTransactions).values({ id: txId, batchId: batch.id, lineage, network: batch.network, state: 'PREPARING' });
  });
  let row = (await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId)))[0]!;
  await attempt(batch.id, txId, 'prepare', 'started');

  const outputs = await expectedOutputs(ctx.cipher, intents);
  const memos = new Map(intents.map((i) => [i.id, i.memoRef]));
  try {
    const created = await adapter.createPczt(outputs, memos, minConf);
    const { review } = await adapter.inspect(created.pczt, created.privacy_policy, outputs);
    const patch = { pcztEnc: ctx.cipher.enc('chain_transactions', txId, 'pczt', created.pczt), pcztHash: sha256(created.pczt), inspectionEnc: ctx.cipher.encJson('chain_transactions', txId, 'inspection', review), feeZat: review.feeZat };
    if (!review.ok) {
      row = await transition(row, 'FAILED_PRE_BROADCAST', { ...patch, diagnosis: review.checks.some((c) => !c.pass && (c.id === 'transparent' || c.id === 'single_pool' || c.id === 'no_cross_pool' || c.id === 'policy')) ? 'Not fully shielded' : 'Prepared transaction does not match approval', lastError: review.checks.filter((c) => !c.pass).map((c) => c.label).join('; ') });
      await attempt(batch.id, txId, 'inspect', 'blocked', row.lastError ?? undefined, 'TRANSACTION_MISMATCH');
    } else {
      row = await transition(row, 'PREPARED_INSPECTED', patch);
      await attempt(batch.id, txId, 'inspect', 'passed', `${review.matched.length} outputs matched, fee ${review.feeZat} zat`);
    }
    await audit(ctx.cipher, 'owner', { projectId: null, eventType: review.ok ? 'payment.prepared' : 'payment.blocked', objectType: 'chain_transaction', objectId: txId, diff: { batchId: batch.id, feeZat: review.feeZat?.toString(), ok: review.ok } });
    return { txId, state: row.state as TxState, review };
  } catch (error) {
    const code = error instanceof WalletError ? error.code : 'WALLET_RPC_ERROR';
    row = await transition(row, 'FAILED_PRE_BROADCAST', { diagnosis: error instanceof WalletError ? (WALLET_DIAGNOSIS[error.code] ?? 'Wallet error') : 'Unexpected error', lastError: error instanceof Error ? error.message.slice(0, 400) : 'error' });
    await attempt(batch.id, txId, 'prepare', 'failed', row.lastError ?? undefined, code);
    return { txId, state: row.state as TxState, review: null };
  }
}

export async function cancelPrepared(ctx: UnlockedContext, txId: string, reason: string): Promise<void> {
  const { tx, projectId } = await loadTx(ctx.ownerId, txId);
  if (SIGNED_STATES.has(tx.state as TxState)) throw new ApiError('FORBIDDEN', 'This transaction is already signed. It cannot be cancelled, only investigated.');
  await transition(tx, 'CANCELLED_BEFORE_SIGN', { diagnosis: reason });
  await attempt(tx.batchId, tx.id, 'cancel', 'cancelled', reason);
  await audit(ctx.cipher, 'owner', { projectId, eventType: 'payment.cancelled_before_sign', objectType: 'chain_transaction', objectId: tx.id, reason });
}

/**
 * Consumes a step-up bound to this exact PCZT, re-checks that recipients still match their frozen address versions,
 * and queues the durable prove/sign/broadcast job. The HTTP request returns at once; the job survives restarts.
 */
export async function authoriseTransaction(ctx: UnlockedContext, txId: string, stepUpToken: string | undefined): Promise<void> {
  const { tx, batch, approval, intents, projectId } = await loadTx(ctx.ownerId, txId);
  if (tx.state !== 'PREPARED_INSPECTED') throw new ApiError('CONFLICT', `This transaction is ${tx.state.toLowerCase().replaceAll('_', ' ')}, so it cannot be authorised.`);
  if (approval.invalidatedAt) throw new ApiError('STALE_PERIOD_REVISION', 'The approval behind this transaction was invalidated.');
  const { scope } = await transactionScope(ctx, txId);
  await consumeStepUp(ctx.sessionId, stepUpToken, 'sign_transaction', { action: 'sign_transaction', ...scope });
  const current = await getDb().select({ id: schema.partnerAddresses.id }).from(schema.partnerAddresses).where(and(inArray(schema.partnerAddresses.id, intents.map((i) => i.addressVersionId)), sql`${schema.partnerAddresses.retiredAt} is null`));
  if (current.length !== new Set(intents.map((i) => i.addressVersionId)).size) {
    await transition(tx, 'CANCELLED_BEFORE_SIGN', { diagnosis: 'A payee address changed after approval' });
    throw new ApiError('ADDRESS_CHANGED', 'A payee address changed after approval. The prepared transaction was cancelled; approve a new revision.');
  }
  if (batchDigest(intents) !== scope.recipientsDigest) throw new ApiError('TRANSACTION_MISMATCH', 'Recipients changed. Nothing was signed.');
  await getDb().insert(schema.backgroundJobs).values({ type: 'prove_sign_broadcast', key: `psb:${tx.id}`, payload: { txId: tx.id }, state: 'queued' }).onConflictDoNothing();
  await attempt(batch.id, tx.id, 'authorise', 'accepted', 'Owner authorised with step-up');
  await audit(ctx.cipher, 'owner', { projectId, eventType: 'payment.authorised', objectType: 'chain_transaction', objectId: tx.id, diff: { pcztHash: tx.pcztHash, feeZat: tx.feeZat?.toString() } });
  void import('./runner').then((m) => m.kick());
}

/**
 * The job body. Every step reads persisted state first, so a crash at any point resumes without building a different
 * payment: signed bytes are stored encrypted before broadcast, and a broadcast that may have happened is never
 * blindly repeated with new bytes.
 */
export async function runProveSignBroadcast(key: Buffer, txId: string): Promise<'done' | 'retry'> {
  const cipher = new Cipher(key);
  const adapter = walletAdapter();
  let [row] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
  if (!row) return 'done';
  if (!(adapter instanceof ZalletAdapter)) {
    await attempt(row.batchId, row.id, 'prove', 'waiting', adapter.problem, 'WALLET_UNAVAILABLE');
    return 'retry';
  }
  const intents = await batchIntents((await getDb().select().from(schema.paymentBatches).where(eq(schema.paymentBatches.id, row.batchId)))[0]!);

  try {
    if (row.state === 'PREPARED_INSPECTED' || row.state === 'PROVING') {
      const pczt = cipher.dec('chain_transactions', row.id, 'pczt', row.pcztEnc!);
      if (sha256(pczt) !== row.pcztHash) throw new WalletError('TRANSACTION_MISMATCH', 'Stored PCZT does not match its recorded hash');
      const outputs = await expectedOutputs(cipher, intents);
      const recheck = await adapter.inspect(pczt, 'FullPrivacy', outputs);
      if (!recheck.review.ok) throw new WalletError('TRANSACTION_MISMATCH', `Re-inspection failed: ${recheck.review.checks.filter((c) => !c.pass).map((c) => c.label).join('; ')}`);
      if (row.state === 'PREPARED_INSPECTED') row = await transition(row, 'PROVING');
      await attempt(row.batchId, row.id, 'prove', 'started', 'Creating proofs; the first run can take several minutes while proving keys load');
      const proven = await adapter.prove(pczt);
      const signed = await adapter.sign(proven);
      const extracted = await adapter.extract(signed);
      row = await transition(row, 'SIGNED_EXTRACTED', { txid: extracted.txid.toLowerCase(), signedHexEnc: cipher.enc('chain_transactions', row.id, 'signed_hex', extracted.hex) });
      await getDb().insert(schema.paymentOutputs).values(
        (cipher.decJson<InspectionReview>('chain_transactions', row.id, 'inspection', row.inspectionEnc!).matched).map((m) => ({ chainTransactionId: row!.id, payoutIntentId: m.payoutId, outputRef: m.outputRef, amountZat: BigInt(m.amountZat), recipientCommitment: intents.find((i) => i.id === m.payoutId)!.addressFingerprint })),
      ).onConflictDoNothing();
      await attempt(row.batchId, row.id, 'extract', 'signed', `txid ${extracted.txid}`);
    }

    if (row.state === 'SIGNED_EXTRACTED') {
      const hex = cipher.dec('chain_transactions', row.id, 'signed_hex', row.signedHexEnc!);
      await getDb().update(schema.chainTransactions).set({ attempts: row.attempts + 1 }).where(eq(schema.chainTransactions.id, row.id));
      row = { ...row, attempts: row.attempts + 1 };
      await attempt(row.batchId, row.id, 'broadcast', 'submitting');
      try {
        await adapter.broadcast(hex, row.txid!);
        row = await transition({ ...row, version: (await currentVersion(row.id)) }, 'BROADCAST_SUBMITTED', { broadcastAt: new Date() });
        await attempt(row.batchId, row.id, 'broadcast', 'accepted');
      } catch (error) {
        if (error instanceof WalletError && error.code === 'BROADCAST_REJECTED') {
          row = await transition({ ...row, version: await currentVersion(row.id) }, 'BROADCAST_REJECTED', { diagnosis: 'Broadcast rejected', lastError: error.message.slice(0, 400) });
          await attempt(row.batchId, row.id, 'broadcast', 'rejected', error.message, 'BROADCAST_REJECTED');
          return 'done';
        }
        row = await transition({ ...row, version: await currentVersion(row.id) }, 'BROADCAST_OUTCOME_UNKNOWN', { diagnosis: 'Unknown broadcast outcome', lastError: error instanceof Error ? error.message.slice(0, 400) : 'error' });
        await attempt(row.batchId, row.id, 'broadcast', 'unknown', row.lastError ?? undefined, 'BROADCAST_OUTCOME_UNKNOWN');
      }
    }
    await getDb().insert(schema.backgroundJobs).values({ type: 'reconcile_tx', key: `reconcile:${row.id}`, payload: { txId: row.id }, state: 'queued' }).onConflictDoUpdate({ target: schema.backgroundJobs.key, set: { state: 'queued', runAfter: new Date() } });
    invalidateWalletHealth();
    return 'done';
  } catch (error) {
    [row] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
    const walletError = error instanceof WalletError ? error : null;
    if (walletError && (walletError.code === 'WALLET_TIMEOUT' || walletError.code === 'WALLET_UNAVAILABLE') && row && !SIGNED_STATES.has(row.state as TxState)) {
      await attempt(row.batchId, row.id, 'prove', 'waiting', walletError.message, walletError.code);
      return 'retry';
    }
    if (row && !SIGNED_STATES.has(row.state as TxState)) {
      await transition(row, 'FAILED_PRE_BROADCAST', { diagnosis: walletError ? (WALLET_DIAGNOSIS[walletError.code] ?? 'Unable to prove') : 'Unable to prove', lastError: error instanceof Error ? error.message.slice(0, 400) : 'error' });
      await attempt(row.batchId, row.id, 'prove', 'failed', error instanceof Error ? error.message : undefined, walletError?.code ?? 'SIGNATURE_FAILED');
    } else log('error', 'payment.job_failed_after_sign', { txId, error });
    return 'done';
  }
}

async function currentVersion(id: string): Promise<number> {
  const [r] = await getDb().select({ v: schema.chainTransactions.version }).from(schema.chainTransactions).where(eq(schema.chainTransactions.id, id));
  return r!.v;
}

/** Reads node and wallet state and moves the transaction only on observed facts. Never needs plaintext data. */
export async function reconcileTransaction(txId: string): Promise<'done' | 'retry'> {
  const [row] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
  if (!row || !row.txid) return 'done';
  const adapter = walletAdapter();
  if (!(adapter instanceof ZalletAdapter)) return 'retry';
  const [proj] = await getDb().select({ target: schema.projects.targetConfirmations }).from(schema.projects).innerJoin(schema.periods, eq(schema.periods.projectId, schema.projects.id)).innerJoin(schema.approvals, eq(schema.approvals.periodId, schema.periods.id)).innerJoin(schema.paymentBatches, eq(schema.paymentBatches.approvalId, schema.approvals.id)).where(eq(schema.paymentBatches.id, row.batchId));
  const target = proj?.target ?? 3;
  let obs;
  try {
    obs = await adapter.lookupTransaction(row.txid);
  } catch (error) {
    await getDb().update(schema.chainTransactions).set({ lastCheckedAt: new Date(), lastError: error instanceof Error ? error.message.slice(0, 400) : 'error' }).where(eq(schema.chainTransactions.id, row.id));
    return 'retry';
  }
  const view = await adapter.viewTransaction(row.txid).catch(() => null);
  const base = { lastCheckedAt: new Date(), confirmations: obs.confirmations, height: obs.height, blockhash: obs.blockhash, walletObservedAt: view ? (row.walletObservedAt ?? new Date()) : row.walletObservedAt };
  const state = row.state as TxState;
  let to: TxState | null = null;
  if (obs.known && !obs.inMempool) to = obs.confirmations >= target ? 'CONFIRMED' : 'CONFIRMING';
  else if (obs.known && obs.inMempool) to = state === 'CONFIRMED' || state === 'CONFIRMING' ? 'STALE_OR_REORGED' : 'MEMPOOL_OBSERVED';
  else if (state === 'CONFIRMED' || state === 'CONFIRMING') to = 'STALE_OR_REORGED';
  else if (state === 'BROADCAST_OUTCOME_UNKNOWN' || state === 'BROADCAST_SUBMITTED') to = 'INVESTIGATION_REQUIRED';

  if (to && to !== state && (to !== 'INVESTIGATION_REQUIRED' || row.attempts > 0)) {
    try {
      await transition(row, to, { ...base, minedAt: to === 'CONFIRMED' || to === 'CONFIRMING' ? (row.minedAt ?? new Date()) : row.minedAt });
      await attempt(row.batchId, row.id, 'reconcile', to.toLowerCase(), `${obs.confirmations} confirmation(s)${obs.height ? ` at height ${obs.height}` : ''}`);
      if (to === 'STALE_OR_REORGED') log('warn', 'payment.reorg_detected', { txId: row.id });
    } catch (error) {
      log('warn', 'payment.reconcile_transition_refused', { txId: row.id, error });
    }
  } else {
    await getDb().update(schema.chainTransactions).set(base).where(eq(schema.chainTransactions.id, row.id));
    await syncBatchAndPeriod(row.batchId);
  }
  const [after] = await getDb().select({ state: schema.chainTransactions.state, c: schema.chainTransactions.confirmations }).from(schema.chainTransactions).where(eq(schema.chainTransactions.id, row.id));
  // Keep watching confirmed transactions for a while, since a reorg can still demote them.
  return after?.state === 'CONFIRMED' && (after.c ?? 0) >= target + 10 ? 'done' : 'retry';
}

/** For an unknown outcome: check first, then allow resubmitting the identical signed bytes (same txid, no new payment). */
export async function resubmitSame(ctx: UnlockedContext, txId: string): Promise<void> {
  const { tx, projectId } = await loadTx(ctx.ownerId, txId);
  if (tx.state !== 'INVESTIGATION_REQUIRED' && tx.state !== 'BROADCAST_OUTCOME_UNKNOWN') throw new ApiError('CONFLICT', 'Resubmission is only for transactions whose broadcast outcome is unknown.');
  await reconcileTransaction(tx.id);
  const [fresh] = await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, tx.id));
  if (fresh && (fresh.state === 'MEMPOOL_OBSERVED' || fresh.state === 'CONFIRMING' || fresh.state === 'CONFIRMED')) return;
  const adapter = adapterOrThrow();
  const hex = ctx.cipher.dec('chain_transactions', tx.id, 'signed_hex', fresh!.signedHexEnc!);
  await attempt(tx.batchId, tx.id, 'rebroadcast', 'submitting', 'Same signed bytes, same txid');
  try {
    await adapter.broadcast(hex, fresh!.txid!);
    await transition(fresh!, 'BROADCAST_SUBMITTED', { broadcastAt: new Date(), attempts: fresh!.attempts + 1 });
    await attempt(tx.batchId, tx.id, 'rebroadcast', 'accepted');
  } catch (error) {
    await attempt(tx.batchId, tx.id, 'rebroadcast', 'failed', error instanceof Error ? error.message : undefined, error instanceof WalletError ? error.code : undefined);
    throw new ApiError(error instanceof WalletError && error.code === 'BROADCAST_REJECTED' ? 'TRANSACTION_MISMATCH' : 'BROADCAST_OUTCOME_UNKNOWN', error instanceof Error ? error.message : 'Rebroadcast failed');
  }
  await audit(ctx.cipher, 'owner', { projectId, eventType: 'payment.rebroadcast_same', objectType: 'chain_transaction', objectId: tx.id });
}

/**
 * Marks an investigated transaction as failed before broadcast. Allowed only when the node has never seen the txid
 * and the operator records why; the batch can then be prepared again under a new lineage with fresh authorisation.
 */
export async function declareNotBroadcast(ctx: UnlockedContext, txId: string, reason: string): Promise<void> {
  const { tx, projectId } = await loadTx(ctx.ownerId, txId);
  if (tx.state !== 'INVESTIGATION_REQUIRED') throw new ApiError('CONFLICT', 'Only a transaction under investigation can be declared not broadcast.');
  const adapter = adapterOrThrow();
  const obs = await adapter.lookupTransaction(tx.txid!);
  if (obs.known) throw new ApiError('CONFLICT', 'The node knows this transaction. It was broadcast; keep reconciling instead.');
  // Signed bytes stay valid until their expiry height. Before then they could still be mined, so a replacement
  // payment could pay twice. After it, the network rejects them for good.
  const expiry = ctx.cipher.decJson<InspectionReview>('chain_transactions', tx.id, 'inspection', tx.inspectionEnc!).expiryHeight;
  const health = await walletHealth({ maxAgeMs: 0 });
  if (expiry === null || health.zebra.blocks === null || health.zebra.blocks <= expiry) {
    throw new ApiError('CONFLICT', `The signed transaction can still be mined until block ${expiry ?? 'unknown'}${health.zebra.blocks !== null ? ` (chain is at ${health.zebra.blocks})` : ''}. Wait until it expires before declaring it not broadcast.`);
  }
  await transition(tx, 'FAILED_PRE_BROADCAST', { diagnosis: 'Determined not broadcast after investigation', lastError: reason });
  await attempt(tx.batchId, tx.id, 'investigate', 'not_broadcast', reason);
  await audit(ctx.cipher, 'owner', { projectId, eventType: 'payment.declared_not_broadcast', objectType: 'chain_transaction', objectId: tx.id, reason });
}
