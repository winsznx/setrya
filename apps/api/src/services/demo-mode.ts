import { ApiError, route, type RouteHandler } from '../http/route';

/**
 * A shared demo workspace: several people sign in with one owner login, so any action that could lock the others
 * out, or take data off the host, is refused. Payments still work, under a per-approval cap, and never on mainnet.
 */

export const DEMO_MESSAGE = 'This is a shared demo workspace, so this action is turned off.';
export const DEFAULT_DEMO_MAX_ZAT = 5_000_000n;
/** No unlocked demo vault outlives this, however active the session, so a shared login cannot hold a key forever. */
export const DEMO_MAX_UNLOCK_MS = 60 * 60_000;

export interface DemoConfig {
  enabled: boolean;
  maxZat: bigint;
  login: { email: string; password: string; vaultPassphrase: string } | null;
}

export function readDemoConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const enabled = env.SETRYA_DEMO_MODE === '1';
  const rawMax = env.SETRYA_DEMO_MAX_ZAT;
  if (rawMax !== undefined && !/^\d{1,16}$/.test(rawMax)) throw new Error('SETRYA_DEMO_MAX_ZAT must be a whole number of zatoshis');
  const maxZat = rawMax === undefined ? DEFAULT_DEMO_MAX_ZAT : BigInt(rawMax);
  const { SETRYA_DEMO_LOGIN_EMAIL: email, SETRYA_DEMO_LOGIN_PASSWORD: password, SETRYA_DEMO_VAULT_PASSPHRASE: vaultPassphrase } = env;
  const login = enabled && email && password && vaultPassphrase ? { email, password, vaultPassphrase } : null;
  return { enabled, maxZat, login };
}

let config: DemoConfig = readDemoConfig();

export function demoConfig(): DemoConfig {
  return config;
}

/** For tests only: the API reads its configuration once at startup. */
export function setDemoConfigForTests(next: DemoConfig): void {
  config = next;
}

/** Fails startup when demo mode would expose real money. */
export function assertDemoNetwork(env: NodeJS.ProcessEnv = process.env): void {
  if (readDemoConfig(env).enabled && env.SETRYA_NETWORK === 'mainnet') {
    throw new Error('SETRYA_DEMO_MODE cannot run on mainnet: the shared demo login could move real funds');
  }
}

export function assertNotDemo(): void {
  if (config.enabled) throw new ApiError('DEMO_MODE', DEMO_MESSAGE);
}

/** Wraps a route so demo mode refuses it before any session or database work. */
export function blockedInDemo(handler: RouteHandler): RouteHandler {
  const refuse = route('none', async () => {
    throw new ApiError('DEMO_MODE', DEMO_MESSAGE);
  });
  return (c) => (config.enabled ? refuse(c) : handler(c));
}

/** The approval cap: compares the approved total, which approvePeriod then checks against the frozen snapshot. */
export function checkDemoApprovalCap(confirmTotalZat: string, cfg: DemoConfig): void {
  if (!cfg.enabled) return;
  if (!/^\d+$/.test(confirmTotalZat)) throw new ApiError('INVALID_INPUT', 'The approved total must be a whole number of zatoshis.');
  if (BigInt(confirmTotalZat) > cfg.maxZat) {
    throw new ApiError('DEMO_MODE', `The demo workspace pays at most ${cfg.maxZat} zatoshis per approval. Lower the payouts and approve again.`);
  }
}

export function assertDemoApprovalCap(confirmTotalZat: string): void {
  checkDemoApprovalCap(confirmTotalZat, config);
}
