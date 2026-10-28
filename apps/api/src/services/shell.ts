import { getDb, schema, eq, and, sql } from '@setrya/db';

import { configuredNetwork } from './network';
import type { WalletHealth } from './wallet';

export type NetworkLabel = 'MAINNET' | 'TESTNET' | 'REGTEST' | 'SAMPLE';
export type WalletState = 'ready' | 'degraded' | 'offline' | 'unconfigured';

export function networkLabel(): NetworkLabel {
  return configuredNetwork().toUpperCase() as NetworkLabel;
}

export function walletSummary(h: WalletHealth): { state: WalletState; label: string } {
  if (!h.configured) return { state: 'unconfigured', label: 'Wallet not connected' };
  if (h.canPay) return { state: 'ready', label: 'Ready to pay' };
  if (!h.zebra.reachable || !h.zallet.reachable) return { state: 'offline', label: 'Wallet offline' };
  return { state: 'degraded', label: 'Not ready to pay' };
}

export async function openExceptionCount(projectId: string): Promise<number> {
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.periodExceptions)
    .innerJoin(schema.periods, and(eq(schema.periods.id, schema.periodExceptions.periodId), eq(schema.periods.revision, schema.periodExceptions.revision)))
    .where(and(eq(schema.periods.projectId, projectId), eq(schema.periodExceptions.status, 'open'), eq(schema.periodExceptions.severity, 'blocking'), eq(schema.periods.status, 'draft')));
  return r?.n ?? 0;
}

export async function autoLockMinutes(): Promise<number> {
  const [s] = await getDb().select({ m: schema.systemSettings.autoLockMinutes }).from(schema.systemSettings).where(eq(schema.systemSettings.id, 1));
  return s?.m ?? 15;
}
