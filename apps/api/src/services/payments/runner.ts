import { getDb, schema, eq, and, inArray, isNull, lt, or, sql } from '@setrya/db';
import { DecryptError, log } from '@setrya/security';

import { Cipher } from '../crypto-ctx';

import { unlockedKeys } from '../vault-store';
import { reconcileTransaction, runProveSignBroadcast } from './pipeline';

/**
 * Postgres-backed durable job loop, running inside the Next.js server process (started from instrumentation.ts).
 * Jobs are claimed with SKIP LOCKED and a lease, so a crashed run is picked up again once the lease lapses.
 */

const TICK_MS = 5_000;
const LEASE_MS = 15 * 60_000;
const state = ((globalThis as { setryaRunner?: { timer: NodeJS.Timeout | null; running: boolean; started: boolean } }).setryaRunner ??= { timer: null, running: false, started: false });

type Job = typeof schema.backgroundJobs.$inferSelect;

async function claim(limit: number): Promise<Job[]> {
  const rows = await getDb().execute<Job>(sql`
    update background_jobs set state = 'running', lease_until = now() + ${`${LEASE_MS} milliseconds`}::interval, attempt_counter = attempt_counter + 1, updated_at = now()
    where id in (
      select id from background_jobs
      where (state = 'queued' and run_after <= now()) or (state = 'running' and lease_until < now())
      order by created_at
      for update skip locked
      limit ${limit}
    )
    returning id, type, key, payload, state, attempt_counter as "attemptCounter"`);
  return rows as unknown as Job[];
}

async function finish(id: string, outcome: 'done' | 'retry', delayMs: number, note?: string) {
  await getDb()
    .update(schema.backgroundJobs)
    .set(outcome === 'done' ? { state: 'done', leaseUntil: null, updatedAt: new Date() } : { state: 'queued', leaseUntil: null, runAfter: new Date(Date.now() + delayMs), lastErrorRedacted: note ?? null, updatedAt: new Date() })
    .where(eq(schema.backgroundJobs.id, id));
}

/** The unlocked key that authenticates this transaction's stored PCZT, or null if none does yet. */
async function keyForTransaction(txId: string): Promise<Buffer | null> {
  const [row] = await getDb().select({ pcztEnc: schema.chainTransactions.pcztEnc }).from(schema.chainTransactions).where(eq(schema.chainTransactions.id, txId));
  if (!row?.pcztEnc) return null;
  for (const key of unlockedKeys()) {
    try {
      new Cipher(key).dec('chain_transactions', txId, 'pczt', row.pcztEnc);
      return key;
    } catch (error) {
      if (!(error instanceof DecryptError)) throw error;
    }
  }
  return null;
}

async function runJob(job: Job) {
  const payload = job.payload as { txId?: string };
  try {
    if (job.type === 'prove_sign_broadcast') {
      const key = await keyForTransaction(payload.txId!);
      if (!key) return finish(job.id, 'retry', 30_000, 'Waiting for the owner to unlock the workspace');
      return finish(job.id, await runProveSignBroadcast(key, payload.txId!), 30_000);
    }
    if (job.type === 'reconcile_tx') return finish(job.id, await reconcileTransaction(payload.txId!), 20_000);
    if (job.type === 'revoke_expired_shares') {
      await getDb().update(schema.statementShares).set({ ciphertext: null, purgedAt: new Date() }).where(and(isNull(schema.statementShares.purgedAt), or(lt(schema.statementShares.expiresAt, new Date()), sql`${schema.statementShares.revokedAt} is not null`)));
      return finish(job.id, 'retry', 60 * 60_000);
    }
    return finish(job.id, 'done', 0);
  } catch (error) {
    log('error', 'jobs.failed', { type: job.type, jobId: job.id, error });
    await finish(job.id, 'retry', 60_000, error instanceof Error ? error.name : 'error');
  }
}

async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    for (const job of await claim(5)) await runJob(job);
  } catch (error) {
    log('warn', 'jobs.tick_failed', { error });
  } finally {
    state.running = false;
  }
}

export function kick(): void {
  void tick();
}

/** After a restart or wallet outage, every transaction whose outcome is not final gets reconciled before anything new. */
export async function resumePaymentJobs(): Promise<void> {
  const open = await getDb().select({ id: schema.chainTransactions.id }).from(schema.chainTransactions).where(inArray(schema.chainTransactions.state, ['BROADCAST_SUBMITTED', 'MEMPOOL_OBSERVED', 'CONFIRMING', 'BROADCAST_OUTCOME_UNKNOWN', 'STALE_OR_REORGED', 'INVESTIGATION_REQUIRED']));
  for (const t of open) {
    await getDb().insert(schema.backgroundJobs).values({ type: 'reconcile_tx', key: `reconcile:${t.id}`, payload: { txId: t.id }, state: 'queued' }).onConflictDoUpdate({ target: schema.backgroundJobs.key, set: { state: 'queued', runAfter: new Date() } });
  }
  kick();
}

export function startRunner(): void {
  if (state.started) return;
  state.started = true;
  void getDb()
    .insert(schema.backgroundJobs)
    .values({ type: 'revoke_expired_shares', key: 'periodic:revoke_expired_shares', payload: {}, state: 'queued' })
    .onConflictDoNothing()
    .then(() => resumePaymentJobs())
    .catch((error: unknown) => log('warn', 'jobs.start_failed', { error }));
  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.();
}
