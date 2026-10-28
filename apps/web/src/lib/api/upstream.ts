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

let cached: UpstreamConfig | null = null;

function config(): UpstreamConfig {
  if (cached) return cached;
  const baseUrl = process.env.SETRYA_API_URL;
  const edgeKey = process.env.SETRYA_EDGE_KEY;
  if (!baseUrl || !edgeKey) throw new Error('SETRYA_API_URL and SETRYA_EDGE_KEY must be set');
  const ca = process.env.SETRYA_API_CA?.replace(/\\n/g, '\n');
  cached = { baseUrl: baseUrl.replace(/\/$/, ''), edgeKey, dispatcher: ca ? new Agent({ connect: { ca } }) : undefined };
  return cached;
}

export interface UpstreamRequest {
  method: string;
  path: string;
  headers: Headers;
  body?: ArrayBuffer | null;
  clientIp: string;
}

export function upstream(request: UpstreamRequest): Promise<UndiciResponse> {
  const { baseUrl, edgeKey, dispatcher } = config();
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
