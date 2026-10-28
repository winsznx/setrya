import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import type { RpcEndpoint } from './config';

export type WalletErrorCode =
  | 'WALLET_UNAVAILABLE'
  | 'WALLET_TIMEOUT'
  | 'WALLET_RPC_ERROR'
  | 'WALLET_AUTH'
  | 'METHOD_NOT_ALLOWED'
  | 'CAPABILITY_MISSING'
  | 'WALLET_NOT_SYNCED'
  | 'WALLET_LOCKED'
  | 'INSUFFICIENT_SHIELDED_FUNDS'
  | 'PRIVACY_POLICY_REJECTED'
  | 'TRANSACTION_MISMATCH'
  | 'CHAIN_MISMATCH'
  | 'BROADCAST_REJECTED'
  | 'BROADCAST_OUTCOME_UNKNOWN';

export class WalletError extends Error {
  constructor(
    readonly code: WalletErrorCode,
    message: string,
    readonly rpcCode?: number,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

/** The only methods Setrya will ever send. Nothing from the browser is forwarded as a method name. */
export const ZALLET_METHODS = [
  'rpc.discover',
  'getwalletstatus',
  'getwalletinfo',
  'z_listaccounts',
  'z_getaddressforaccount',
  'z_getbalanceforaccount',
  'pczt_create',
  'pczt_inspect',
  'pczt_prove',
  'pczt_sign',
  'pczt_extract',
  'z_viewtransaction',
  'z_listtransactions',
] as const;
export const ZEBRA_METHODS = ['getinfo', 'getblockchaininfo', 'sendrawtransaction', 'getrawtransaction', 'getrawmempool'] as const;

export type ZalletMethod = (typeof ZALLET_METHODS)[number];
export type ZebraMethod = (typeof ZEBRA_METHODS)[number];

async function authHeader(endpoint: RpcEndpoint): Promise<string | undefined> {
  let pair: string | undefined;
  if (endpoint.user !== undefined && endpoint.password !== undefined) pair = `${endpoint.user}:${endpoint.password}`;
  else if (endpoint.cookieFile !== undefined) {
    try {
      pair = (await readFile(endpoint.cookieFile, 'utf8')).trim();
    } catch {
      throw new WalletError('WALLET_AUTH', 'The RPC cookie file could not be read. Is the service running?');
    }
  }
  return pair === undefined ? undefined : `Basic ${Buffer.from(pair).toString('base64')}`;
}

export class RpcClient<M extends string> {
  constructor(
    private readonly endpoint: RpcEndpoint,
    private readonly allowed: readonly M[],
    private readonly label: string,
  ) {}

  async call<T>(method: M, params: unknown[] = [], timeoutMs = 30_000): Promise<T> {
    if (!this.allowed.includes(method)) throw new WalletError('METHOD_NOT_ALLOWED', `${method} is not on the ${this.label} allowlist`);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const auth = await authHeader(this.endpoint);
    if (auth) headers.authorization = auth;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(this.endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
        signal: controller.signal,
        redirect: 'error',
      });
    } catch (error) {
      if (controller.signal.aborted) throw new WalletError('WALLET_TIMEOUT', `${this.label} did not answer ${method} within ${Math.round(timeoutMs / 1000)}s`);
      throw new WalletError('WALLET_UNAVAILABLE', `${this.label} is not reachable (${error instanceof Error ? error.message : 'network error'})`);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401 || response.status === 403) throw new WalletError('WALLET_AUTH', `${this.label} rejected the RPC credentials`);
    let body: { result?: T; error?: { code: number; message: string } | null };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new WalletError('WALLET_RPC_ERROR', `${this.label} returned a non-JSON response (HTTP ${response.status})`);
    }
    if (body.error) {
      if (body.error.code === -32601) throw new WalletError('CAPABILITY_MISSING', `${this.label} does not support ${method}`, body.error.code);
      throw new WalletError('WALLET_RPC_ERROR', `${method}: ${body.error.message}`, body.error.code);
    }
    return body.result as T;
  }
}
