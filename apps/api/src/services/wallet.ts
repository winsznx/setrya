import { getDb, schema } from '@setrya/db';
import { log } from '@setrya/security';
import { unconfiguredHealth, ZalletAdapter, type WalletHealth } from '@setrya/wallet-adapter';

let cached: { at: number; health: WalletHealth } | null = null;

export function walletAdapter(): ZalletAdapter | { problem: string; configured: boolean } {
  return ZalletAdapter.fromEnv();
}

export function requireAdapter(): ZalletAdapter {
  const a = walletAdapter();
  if (!(a instanceof ZalletAdapter)) throw Object.assign(new Error(a.problem), { walletProblem: a.problem });
  return a;
}

/**
 * Live read-only health query, cached briefly so page renders do not hammer the node. The result is persisted with its
 * timestamp, so a stale observation is always shown as stale rather than as current.
 */
export async function walletHealth({ maxAgeMs = 15_000, minConf = 1 }: { maxAgeMs?: number; minConf?: number } = {}): Promise<WalletHealth> {
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.health;
  const adapter = walletAdapter();
  let health: WalletHealth;
  if (!(adapter instanceof ZalletAdapter)) health = unconfiguredHealth(adapter.problem, adapter.configured);
  else {
    try {
      health = await adapter.health(minConf);
    } catch (error) {
      log('warn', 'wallet.health_failed', { error });
      health = unconfiguredHealth('Wallet health check failed unexpectedly', true);
    }
  }
  cached = { at: Date.now(), health };
  await getDb()
    .insert(schema.walletObservations)
    .values({ id: 1, healthJson: health, observedAt: new Date() })
    .onConflictDoUpdate({ target: schema.walletObservations.id, set: { healthJson: health, observedAt: new Date() } })
    .catch((error: unknown) => log('warn', 'wallet.observation_store_failed', { error }));
  return health;
}

export function invalidateWalletHealth(): void {
  cached = null;
}

export type { WalletHealth };
