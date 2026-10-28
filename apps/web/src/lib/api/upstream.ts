import 'server-only';

import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from 'undici';

/**
 * The single way the web tier reaches the API. The API sits on the settlement host behind a certificate this app
 * pins (SETRYA_API_CA), and only answers requests that carry the shared edge key.
 */

const EDGE_KEY_HEADER = 'x-setrya-edge-key';
const CLIENT_IP_HEADER = 'x-setrya-client-ip';

interface UpstreamConfig {
  baseUrl: string;
  edgeKey: string;
  dispatcher: Agent | undefined;
}

/** `main` is the operator's installation. `sandbox` is the separate public testnet sandbox, with its own keys. */
export type UpstreamTarget = 'main' | 'sandbox';

const ENV: Record<UpstreamTarget, { url: string; key: string; ca: string }> = {
  main: { url: 'SETRYA_API_URL', key: 'SETRYA_EDGE_KEY', ca: 'SETRYA_API_CA' },
  sandbox: { url: 'SETRYA_SANDBOX_API_URL', key: 'SETRYA_SANDBOX_EDGE_KEY', ca: 'SETRYA_SANDBOX_API_CA' },
};

const cached = new Map<UpstreamTarget, UpstreamConfig>();

function config(target: UpstreamTarget): UpstreamConfig {
  const hit = cached.get(target);
  if (hit) return hit;
  const names = ENV[target];
  const baseUrl = process.env[names.url];
  const edgeKey = process.env[names.key];
  if (!baseUrl || !edgeKey) throw new Error(`${names.url} and ${names.key} must be set`);
  const ca = process.env[names.ca]?.replace(/\\n/g, '\n');
  const built = { baseUrl: baseUrl.replace(/\/$/, ''), edgeKey, dispatcher: ca ? new Agent({ connect: { ca } }) : undefined };
  cached.set(target, built);
  return built;
}

export interface UpstreamRequest {
  method: string;
  path: string;
  headers: Headers;
  body?: ArrayBuffer | null;
  clientIp: string;
}

export function upstream(request: UpstreamRequest, target: UpstreamTarget = 'main'): Promise<UndiciResponse> {
  const { baseUrl, edgeKey, dispatcher } = config(target);
  const headers = new Headers(request.headers);
  headers.set(EDGE_KEY_HEADER, edgeKey);
  headers.set(CLIENT_IP_HEADER, request.clientIp);
  return undiciFetch(`${baseUrl}${request.path}`, {
    method: request.method,
    headers: Object.fromEntries(headers),
    body: request.body && request.body.byteLength > 0 ? request.body : undefined,
    dispatcher,
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  });
}

/** Vercel sets x-forwarded-for itself, so its first entry is the browser's address. */
export function clientIpFrom(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
