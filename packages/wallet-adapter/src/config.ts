import { isIP } from 'node:net';

import type { FundPool, ZcashNetwork } from '@setrya/domain';

export interface RpcEndpoint {
  url: URL;
  user?: string;
  password?: string;
  cookieFile?: string;
}

export interface WalletConfig {
  network: ZcashNetwork;
  connectionName: string;
  zallet: RpcEndpoint;
  zebra: RpcEndpoint;
  accountUuid: string;
  fundSource: FundPool;
  timeoutMs: number;
  proveTimeoutMs: number;
}

export type WalletConfigResult = { ok: true; config: WalletConfig } | { ok: false; reason: 'NOT_CONFIGURED' | 'INVALID'; message: string };

/** Loopback or RFC 1918 / ULA only. Zallet's RPC is plaintext HTTP and must never cross a public network. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost') return true;
  const kind = isIP(host);
  if (kind === 4) {
    const [a, b] = host.split('.').map(Number) as [number, number];
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (kind === 6) return host === '::1' || /^f[cd]/i.test(host);
  return false;
}

function endpoint(prefix: string, env: NodeJS.ProcessEnv): RpcEndpoint | string {
  const raw = env[`${prefix}_RPC_URL`];
  if (!raw) return `${prefix}_RPC_URL is not set`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `${prefix}_RPC_URL is not a URL`;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${prefix}_RPC_URL must be http(s)`;
  if (!isPrivateHost(url.hostname)) return `${prefix}_RPC_URL must point at loopback or a private network address`;
  if (url.username || url.password) return `${prefix}_RPC_URL must not embed credentials; use ${prefix}_RPC_USER/_PASSWORD or ${prefix}_RPC_COOKIE_FILE`;
  const e: RpcEndpoint = { url };
  if (env[`${prefix}_RPC_COOKIE_FILE`]) e.cookieFile = env[`${prefix}_RPC_COOKIE_FILE`];
  if (env[`${prefix}_RPC_USER`]) e.user = env[`${prefix}_RPC_USER`];
  if (env[`${prefix}_RPC_PASSWORD`]) e.password = env[`${prefix}_RPC_PASSWORD`];
  return e;
}

export function loadWalletConfig(env: NodeJS.ProcessEnv = process.env): WalletConfigResult {
  const network = env.SETRYA_NETWORK;
  if (!env.ZALLET_RPC_URL && !env.ZEBRA_RPC_URL) {
    return { ok: false, reason: 'NOT_CONFIGURED', message: 'No wallet connection is configured on this host.' };
  }
  if (network !== 'mainnet' && network !== 'testnet' && network !== 'regtest') {
    return { ok: false, reason: 'INVALID', message: 'SETRYA_NETWORK must be mainnet, testnet or regtest.' };
  }
  const zallet = endpoint('ZALLET', env);
  const zebra = endpoint('ZEBRA', env);
  if (typeof zallet === 'string') return { ok: false, reason: 'INVALID', message: zallet };
  if (typeof zebra === 'string') return { ok: false, reason: 'INVALID', message: zebra };
  const accountUuid = env.SETRYA_PAYER_ACCOUNT_UUID ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(accountUuid)) return { ok: false, reason: 'INVALID', message: 'SETRYA_PAYER_ACCOUNT_UUID must be the Zallet account UUID.' };
  const fundSource = (env.SETRYA_FUND_SOURCE ?? 'orchard') as FundPool;
  if (fundSource !== 'orchard' && fundSource !== 'sapling') return { ok: false, reason: 'INVALID', message: 'SETRYA_FUND_SOURCE must be orchard or sapling.' };
  return {
    ok: true,
    config: {
      network,
      connectionName: env.SETRYA_WALLET_CONNECTION_NAME ?? 'settlement-host',
      zallet,
      zebra,
      accountUuid: accountUuid.toLowerCase(),
      fundSource,
      timeoutMs: Number(env.SETRYA_RPC_TIMEOUT_MS ?? 30_000),
      proveTimeoutMs: Number(env.SETRYA_PROVE_TIMEOUT_MS ?? 600_000),
    },
  };
}
