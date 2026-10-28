import { decodeWire } from '@setrya/domain';
import type { Hono } from 'hono';

import type { AppEnv } from '../http/app-env';
import { CLIENT_IP_HEADER, EDGE_KEY_HEADER } from '../http/edge';

/**
 * The sandbox operator drives its own API in-process, with a real session cookie and step-up tokens, so every
 * validation, check and audit entry is exactly the one a human operator would go through.
 */
export class SandboxOperator {
  private cookie = '';

  constructor(
    private readonly app: Hono<AppEnv>,
    private readonly edgeKey: string,
    private readonly origin: string,
  ) {}

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers = new Headers({ [EDGE_KEY_HEADER]: this.edgeKey, [CLIENT_IP_HEADER]: 'sandbox-operator', origin: this.origin, 'x-setrya-request': '1' });
    if (this.cookie) headers.set('cookie', this.cookie);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const res = await this.app.request(`http://sandbox.internal${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.getSetCookie().find((c) => c.startsWith('setrya_session='));
    if (set) this.cookie = set.split(';')[0]!;
    return res;
  }

  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.send(method, path, body);
    const json = (await res.json()) as { ok: boolean; data?: T; error?: { code: string; message: string; fieldErrors?: Record<string, string> } };
    if (!json.ok) {
      const fields = json.error?.fieldErrors ? ` (${Object.entries(json.error.fieldErrors).map(([k, v]) => `${k}: ${v}`).join('; ')})` : '';
      throw new SandboxStepError(json.error?.code ?? 'INTERNAL', `${json.error?.message ?? `${method} ${path} failed`}${fields}`);
    }
    return json.data as T;
  }

  async view<T>(name: string, query: Record<string, string>): Promise<T> {
    const res = await this.send('GET', `/api/v1/views/${name}?${new URLSearchParams(query)}`);
    const text = await res.text();
    if (!res.ok) throw new SandboxStepError('VIEW_FAILED', `${name}: ${text.slice(0, 200)}`);
    return decodeWire<{ data: T }>(text).data;
  }

  async signIn(email: string, password: string, vaultPassphrase: string): Promise<void> {
    this.cookie = '';
    await this.call('POST', '/api/v1/auth/session', { email, password, remember: false });
    await this.call('POST', '/api/v1/vault/unlock', { passphrase: vaultPassphrase });
  }

  async stepUp(password: string, action: 'approve_period' | 'sign_transaction', targetId: string): Promise<string> {
    return (await this.call<{ token: string }>('POST', '/api/v1/auth/step-up', { password, action, targetId })).token;
  }
}

export class SandboxStepError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SandboxStepError';
  }
}
