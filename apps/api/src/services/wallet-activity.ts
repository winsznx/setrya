import { getDb, schema, isNotNull } from '@setrya/db';
import { ZalletAdapter } from '@setrya/wallet-adapter';

import { walletAdapter } from './wallet';

export interface WalletTxRow {
  txid: string;
  status: string | null;
  confirmations: number | null;
  blocktime: number | null;
  height: number | null;
  feeZat: string | null;
  netZat: string | null;
  matchedPayout: boolean;
}

function zat(v: unknown): string | null {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return String(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return v;
  return null;
}

/**
 * Wallet-scoped history from z_listtransactions (experimental in Zallet). Shapes are read defensively; anything the
 * pinned version does not report is shown as unknown rather than guessed.
 */
export async function walletTransactions(limit: number): Promise<{ rows: WalletTxRow[]; error: string | null }> {
  const adapter = walletAdapter();
  if (!(adapter instanceof ZalletAdapter)) return { rows: [], error: adapter.problem };
  let raw: unknown[];
  try {
    raw = await adapter.listTransactions(limit);
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Wallet history unavailable' };
  }
  const ours = new Set((await getDb().select({ txid: schema.chainTransactions.txid }).from(schema.chainTransactions).where(isNotNull(schema.chainTransactions.txid))).map((r) => r.txid));
  const rows = raw.slice(0, limit).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const txid = typeof o.txid === 'string' ? o.txid : '';
    return {
      txid,
      status: typeof o.status === 'string' ? o.status : null,
      confirmations: typeof o.confirmations === 'number' ? o.confirmations : null,
      blocktime: typeof o.blocktime === 'number' ? o.blocktime : typeof o.block_time === 'number' ? o.block_time : null,
      height: typeof o.mined_height === 'number' ? o.mined_height : typeof o.height === 'number' ? o.height : null,
      feeZat: zat(o.fee_zat ?? o.feeZat),
      netZat: zat(o.account_balance_delta ?? o.valueZat ?? o.value_zat),
      matchedPayout: ours.has(txid),
    };
  });
  return { rows: rows.filter((r) => r.txid), error: null };
}

