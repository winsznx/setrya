import { encodeWire } from '@setrya/domain';
import { log } from '@setrya/security';
import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { z, type ZodType } from 'zod';

import { readSession, unlockedFrom, type OwnerSession, type UnlockedContext } from '../services/session';

import { clientIp, withRequestState } from './context';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'VAULT_LOCKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'CSRF_REJECTED'
  | 'DUPLICATE_IMPORT'
  | 'SOURCE_AMBIGUOUS'
  | 'AGREEMENT_OVERLAP'
  | 'STALE_PERIOD_REVISION'
  | 'RATE_REQUIRED'
  | 'RATE_EXPIRED'
  | 'ADDRESS_UNSUPPORTED'
  | 'ADDRESS_CHANGED'
  | 'CHAIN_MISMATCH'
  | 'WALLET_UNAVAILABLE'
  | 'WALLET_NOT_SYNCED'
  | 'WALLET_LOCKED'
  | 'INSUFFICIENT_SHIELDED_FUNDS'
  | 'PRIVACY_POLICY_REJECTED'
  | 'TRANSACTION_MISMATCH'
  | 'SIGNATURE_FAILED'
  | 'BROADCAST_OUTCOME_UNKNOWN'
  | 'REORG_DETECTED'
  | 'STATEMENT_REVOKED'
  | 'STATEMENT_EXPIRED'
  | 'RESTORE_FAILED'
  | 'STEP_UP_REQUIRED'
  | 'CONFLICT'
  | 'INTERNAL';

const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  VAULT_LOCKED: 423,
  FORBIDDEN: 403,
  CSRF_REJECTED: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 422,
  RATE_LIMITED: 429,
  STEP_UP_REQUIRED: 401,
  STATEMENT_REVOKED: 410,
  STATEMENT_EXPIRED: 410,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly options: { fieldErrors?: Record<string, string>; canRetry?: boolean; recoveryAction?: string; status?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Ok<T> = { ok: true; data: T; requestId: string };
export type Err = { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string>; canRetry: boolean; recoveryAction?: string }; requestId: string };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * The browser origin is the web app's, which the edge forwards unchanged. SETRYA_PUBLIC_ORIGIN may list several,
 * comma-separated, so a custom domain and the platform domain both work during a cutover.
 */
function allowedOrigins(req: Request): string[] {
  const configured = process.env.SETRYA_PUBLIC_ORIGIN;
  return configured ? configured.split(',').map((o) => o.trim()).filter(Boolean) : [new URL(req.url).origin];
}

/** Mutations must come from our own origin with a JSON (or multipart) body, which a cross-site form cannot forge. */
function checkCsrf(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (origin === null || !allowedOrigins(req).includes(origin)) throw new ApiError('CSRF_REJECTED', 'This request did not come from Setrya.');
  const type = req.headers.get('content-type') ?? '';
  if (!type.startsWith('application/json') && !type.startsWith('multipart/form-data')) throw new ApiError('CSRF_REJECTED', 'Unsupported content type.');
  if (req.headers.get('x-setrya-request') !== '1') throw new ApiError('CSRF_REJECTED', 'Missing request header.');
}

export type Auth = 'none' | 'session' | 'unlocked';
export type Ctx<A extends Auth> = A extends 'unlocked' ? UnlockedContext : A extends 'session' ? OwnerSession : null;
type Handler<A extends Auth, T> = (req: Request, ctx: Ctx<A>, params: Record<string, string>, requestId: string) => Promise<T>;
export type RouteHandler = (c: Context) => Promise<Response>;

export function route<A extends Auth, T>(auth: A, handler: Handler<A, T>): RouteHandler {
  return (c) => withRequestState(c.req.raw, c.get('clientIp'), () => respond(auth, handler, c.req.raw, c.req.param(), 'json'));
}

/** Server-rendered pages read through views, encoded so bigint, Date and Map values survive the trip intact. */
export function view<A extends Auth, T>(auth: A, handler: Handler<A, T>): RouteHandler {
  return (c) => withRequestState(c.req.raw, c.get('clientIp'), () => respond(auth, handler, c.req.raw, c.req.param(), 'wire'));
}

async function respond<A extends Auth, T>(auth: A, handler: Handler<A, T>, req: Request, params: Record<string, string>, encoding: 'json' | 'wire'): Promise<Response> {
  const requestId = randomUUID();
  try {
    checkCsrf(req);
    let ctx: unknown = null;
    if (auth !== 'none') {
      const session = await readSession();
      if (!session) throw new ApiError('UNAUTHENTICATED', 'Sign in to continue.', { recoveryAction: '/sign-in' });
      if (auth === 'unlocked') {
        const unlocked = unlockedFrom(session);
        if (!unlocked) throw new ApiError('VAULT_LOCKED', 'Unlock the workspace to continue.', { recoveryAction: '/unlock' });
        ctx = unlocked;
      } else ctx = session;
    }
    const data = await handler(req, ctx as Ctx<A>, params, requestId);
    if (data instanceof Response) return data;
    if (encoding === 'wire') return new Response(encodeWire({ ok: true, data, requestId }), { status: 200, headers: { 'content-type': 'application/vnd.setrya.wire+json', 'cache-control': 'no-store' } });
    return json({ ok: true, data, requestId } satisfies Ok<T>, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return json(
        { ok: false, error: { code: error.code, message: error.message, fieldErrors: error.options.fieldErrors, canRetry: error.options.canRetry ?? false, recoveryAction: error.options.recoveryAction }, requestId } satisfies Err,
        error.options.status ?? STATUS[error.code] ?? 409,
      );
    }
    log('error', 'api.unhandled', { requestId, path: new URL(req.url).pathname, error });
    return json({ ok: false, error: { code: 'INTERNAL', message: `Something failed on the server. Reference ${requestId.slice(0, 8)}.`, canRetry: true }, requestId } satisfies Err, 500);
  }
}

const MAX_JSON_BYTES = 256 * 1024;

export async function body<S extends ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new ApiError('INVALID_INPUT', 'Request is too large.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError('INVALID_INPUT', 'Request body is not valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.') || '_'] ??= issue.message;
    throw new ApiError('INVALID_INPUT', 'Check the highlighted fields.', { fieldErrors });
  }
  return parsed.data;
}

const buckets: Map<string, number[]> = ((globalThis as { setryaRate?: Map<string, number[]> }).setryaRate ??= new Map());

/** Sliding-window limiter for unauthenticated endpoints. Single-tenant, single process, so memory is enough. */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new ApiError('RATE_LIMITED', 'Too many attempts. Wait a minute and try again.', { canRetry: true });
  hits.push(now);
  buckets.set(key, hits);
}

/** Rate-limit key. The edge reports the browser's address; nothing else in the request is trusted for it. */
export function clientKey(_req: Request): string {
  return clientIp();
}
