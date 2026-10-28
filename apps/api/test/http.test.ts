import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

const EDGE_KEY = 'test-edge-key-0123456789abcdef0123456789abcdef';
const app = createApp(EDGE_KEY);

function call(path: string, init: RequestInit & { edge?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.edge !== false) headers.set('x-setrya-edge-key', EDGE_KEY);
  return Promise.resolve(app.request(path, { ...init, headers }));
}

describe('edge boundary', () => {
  it('answers health checks without the edge key', async () => {
    expect((await call('/healthz', { edge: false })).status).toBe(200);
  });

  it('refuses API calls without the edge key', async () => {
    const res = await call('/api/v1/bootstrap/status', { edge: false });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('refuses API calls with a wrong edge key', async () => {
    const res = await call('/api/v1/bootstrap/status', { edge: false, headers: { 'x-setrya-edge-key': `${EDGE_KEY}x` } });
    expect(res.status).toBe(403);
  });
});

describe('CSRF', () => {
  const previous = process.env.SETRYA_PUBLIC_ORIGIN;
  beforeEach(() => {
    process.env.SETRYA_PUBLIC_ORIGIN = 'https://setrya.example, https://setrya.vercel.example';
  });
  afterEach(() => {
    process.env.SETRYA_PUBLIC_ORIGIN = previous;
  });

  const post = (origin: string | null, extra: Record<string, string> = {}) =>
    call('/api/v1/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setrya-request': '1', ...(origin ? { origin } : {}), ...extra },
      body: '{}',
    });

  it('rejects a mutation from another origin', async () => {
    const res = await post('https://evil.example');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_REJECTED');
  });

  it('rejects a mutation with no origin', async () => {
    expect((await (await post(null)).json()).error.code).toBe('CSRF_REJECTED');
  });

  it('rejects a mutation without the request header', async () => {
    expect((await (await post('https://setrya.example', { 'x-setrya-request': '0' })).json()).error.code).toBe('CSRF_REJECTED');
  });

  it('accepts every configured origin past the CSRF check', async () => {
    for (const origin of ['https://setrya.example', 'https://setrya.vercel.example']) {
      const body = await (await post(origin)).json();
      expect(body.error.code).not.toBe('CSRF_REJECTED');
    }
  });
});

describe('views', () => {
  it('returns 404 for an unknown view without touching data', async () => {
    const res = await call('/api/v1/views/not.a.view');
    expect(res.status).toBe(404);
  });

  it('returns 404 for prototype keys rather than a loader', async () => {
    expect((await call('/api/v1/views/constructor')).status).toBe(404);
  });
});
