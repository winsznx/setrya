import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { ApiError } from '../src/http/route';
import { assertDemoNetwork, checkDemoApprovalCap, DEFAULT_DEMO_MAX_ZAT, readDemoConfig, setDemoConfigForTests, type DemoConfig } from '../src/services/demo-mode';

const EDGE_KEY = 'test-edge-key-0123456789abcdef0123456789abcdef';
const ORIGIN = 'https://setrya.example';
const app = createApp(EDGE_KEY);
const ON: DemoConfig = { enabled: true, maxZat: 5_000_000n, login: null };
const OFF: DemoConfig = { enabled: false, maxZat: 5_000_000n, login: null };

function mutate(path: string, method: string): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method,
      headers: { 'x-setrya-edge-key': EDGE_KEY, origin: ORIGIN, 'content-type': 'application/json', 'x-setrya-request': '1' },
      body: method === 'DELETE' ? undefined : '{}',
    }),
  );
}

describe('demo mode refuses owner actions before any session or database work', () => {
  const previous = process.env.SETRYA_PUBLIC_ORIGIN;
  beforeEach(() => {
    process.env.SETRYA_PUBLIC_ORIGIN = ORIGIN;
    setDemoConfigForTests(ON);
  });
  afterEach(() => {
    process.env.SETRYA_PUBLIC_ORIGIN = previous;
    setDemoConfigForTests(OFF);
  });

  for (const [method, path] of [
    ['POST', '/api/v1/auth/password'],
    ['POST', '/api/v1/vault/passphrase'],
    ['DELETE', '/api/v1/auth/sessions'],
    ['POST', '/api/v1/backup'],
    ['POST', '/api/v1/backup/verify'],
  ] as const) {
    it(`${method} ${path} returns DEMO_MODE`, async () => {
      const res = await mutate(path, method);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('DEMO_MODE');
      expect(body.error.message).toBe('This is a shared demo workspace, so this action is turned off.');
    });
  }

  it('still applies the CSRF check to a blocked route', async () => {
    const res = await Promise.resolve(app.request('/api/v1/backup', { method: 'POST', headers: { 'x-setrya-edge-key': EDGE_KEY, origin: 'https://evil.example', 'content-type': 'application/json', 'x-setrya-request': '1' }, body: '{}' }));
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CSRF_REJECTED');
  });
});

describe('demo approval cap', () => {
  const rejects = (total: string, cfg: DemoConfig) => {
    try {
      checkDemoApprovalCap(total, cfg);
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.code : 'other';
    }
  };

  it('allows totals up to the cap', () => {
    expect(rejects('5000000', ON)).toBeNull();
    expect(rejects('1', ON)).toBeNull();
  });
  it('refuses a total over the cap', () => {
    expect(rejects('5000001', ON)).toBe('DEMO_MODE');
  });
  it('refuses a total that is not whole zatoshis', () => {
    expect(rejects('0.05', ON)).toBe('INVALID_INPUT');
  });
  it('does nothing outside demo mode', () => {
    expect(rejects('999999999999', OFF)).toBeNull();
  });
});

describe('demo configuration', () => {
  it('defaults the cap to 0.05 TAZ and hides the login unless all three values are set', () => {
    const cfg = readDemoConfig({ SETRYA_DEMO_MODE: '1', SETRYA_DEMO_LOGIN_EMAIL: 'judge@example.test' });
    expect(cfg.maxZat).toBe(DEFAULT_DEMO_MAX_ZAT);
    expect(cfg.login).toBeNull();
  });
  it('never exposes a login outside demo mode', () => {
    expect(readDemoConfig({ SETRYA_DEMO_LOGIN_EMAIL: 'a', SETRYA_DEMO_LOGIN_PASSWORD: 'b', SETRYA_DEMO_VAULT_PASSPHRASE: 'c' }).login).toBeNull();
  });
  it('rejects a malformed cap', () => {
    expect(() => readDemoConfig({ SETRYA_DEMO_MODE: '1', SETRYA_DEMO_MAX_ZAT: '0.05' })).toThrow();
  });
  it('refuses to start on mainnet', () => {
    expect(() => assertDemoNetwork({ SETRYA_DEMO_MODE: '1', SETRYA_NETWORK: 'mainnet' })).toThrow(/mainnet/);
    expect(() => assertDemoNetwork({ SETRYA_DEMO_MODE: '1', SETRYA_NETWORK: 'testnet' })).not.toThrow();
    expect(() => assertDemoNetwork({ SETRYA_NETWORK: 'mainnet' })).not.toThrow();
  });
});
