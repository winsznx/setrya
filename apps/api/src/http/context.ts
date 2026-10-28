import { AsyncLocalStorage } from 'node:async_hooks';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax';
  path?: string;
  expires?: Date;
}

interface RequestState {
  cookies: Map<string, string>;
  setCookies: string[];
  clientIp: string;
}

const storage = new AsyncLocalStorage<RequestState>();

function parseCookies(header: string | null): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try {
      jar.set(name, decodeURIComponent(value));
    } catch {
      jar.set(name, value);
    }
  }
  return jar;
}

function serialize(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`];
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite === 'strict' ? 'Strict' : 'Lax'}`);
  return parts.join('; ');
}

/** Runs a handler with request-scoped cookies, then copies any cookie changes onto its response. */
export async function withRequestState(req: Request, clientIp: string, run: () => Promise<Response>): Promise<Response> {
  const state: RequestState = { cookies: parseCookies(req.headers.get('cookie')), setCookies: [], clientIp };
  const res = await storage.run(state, run);
  if (state.setCookies.length === 0) return res;
  const headers = new Headers(res.headers);
  for (const cookie of state.setCookies) headers.append('set-cookie', cookie);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function current(): RequestState {
  const state = storage.getStore();
  if (!state) throw new Error('Request state is only available inside a request handler.');
  return state;
}

export function requestCookies() {
  return {
    get(name: string): string | undefined {
      return current().cookies.get(name);
    },
    set(name: string, value: string, options: CookieOptions): void {
      const state = current();
      state.cookies.set(name, value);
      state.setCookies.push(serialize(name, value, options));
    },
    delete(name: string): void {
      const state = current();
      state.cookies.delete(name);
      state.setCookies.push(serialize(name, '', { path: '/', expires: new Date(0) }));
    },
  };
}

export function clientIp(): string {
  return current().clientIp;
}
