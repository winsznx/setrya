import { describe, expect, it } from 'vitest';

import { isPrivateHost, loadWalletConfig, reviewInspection, RpcClient, WalletError, ZALLET_METHODS } from '../src';

const A = 'utest1aaaa';
const B = 'utest1bbbb';
const expected = [
  { payoutId: 'p1', address: A, amountZat: 460_000_000n },
  { payoutId: 'p2', address: B, amountZat: 230_000_000n },
];
const good = {
  privacy_policy: 'FullPrivacy',
  wallet_created: true,
  fee_zat: 15000,
  transparent: { inputs: [], outputs: [] },
  sapling: { spends: 0, outputs: [], value_balance_zat: 0 },
  orchard: { actions: 0, outputs: [], value_balance_zat: 0 },
  ironwood: { actions: 3, outputs: [{ value_zat: 460000000, user_address: A }, { value_zat: 230000000, user_address: B }, { value_zat: 12345 }], value_balance_zat: 15000 },
};

describe('PCZT inspection review', () => {
  it('passes an exact, single-pool, fully shielded proposal (Z06)', () => {
    const r = reviewInspection(good, 'FullPrivacy', expected, 'orchard');
    expect(r.checks.filter((c) => !c.pass)).toEqual([]);
    expect(r.matched).toHaveLength(2);
  });
  it('rejects a recipient mismatch (Z08)', () => {
    const bad = structuredClone(good);
    bad.ironwood.outputs[1]!.user_address = 'utest1evil';
    expect(reviewInspection(bad, 'FullPrivacy', expected, 'orchard').ok).toBe(false);
  });
  it('rejects a one-zatoshi amount mismatch (Z09, M25)', () => {
    const bad = structuredClone(good);
    bad.ironwood.outputs[0]!.value_zat = 459_999_999;
    const r = reviewInspection(bad, 'FullPrivacy', expected, 'orchard');
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'recipients')!.pass).toBe(false);
  });
  it('rejects a weaker policy or transparent output (Z10, Z04)', () => {
    expect(reviewInspection(good, 'AllowRevealedAmounts', expected, 'orchard').ok).toBe(false);
    const t = structuredClone(good) as typeof good & { transparent: { outputs: unknown[] } };
    t.transparent.outputs = [{ value_zat: 1 }];
    expect(reviewInspection(t, 'FullPrivacy', expected, 'orchard').ok).toBe(false);
  });
  it('fails closed when the inspection does not report a policy', () => {
    const { privacy_policy: _omitted, ...missing } = good;
    expect(reviewInspection(missing, 'FullPrivacy', expected, 'orchard').checks.find((c) => c.id === 'policy')!.pass).toBe(false);
  });
  it('rejects a fee that differs from the ZIP 317 conventional fee', () => {
    const low = structuredClone(good);
    low.fee_zat = 10000;
    low.ironwood.value_balance_zat = 10000;
    expect(reviewInspection(low, 'FullPrivacy', expected, 'orchard').checks.find((c) => c.id === 'fee')!.pass).toBe(false);
  });
  it('rejects paying inside the closed Orchard pool', () => {
    const o = structuredClone(good);
    o.orchard = { actions: 3, outputs: o.ironwood.outputs, value_balance_zat: 15000 };
    o.ironwood = { actions: 0, outputs: [], value_balance_zat: 0 };
    const r = reviewInspection(o, 'FullPrivacy', expected, 'orchard');
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'legacy_orchard')!.pass).toBe(false);
  });
  it('rejects a cross-pool turnstile (Z05)', () => {
    const x = structuredClone(good);
    x.orchard.value_balance_zat = 500_000_000;
    x.ironwood.value_balance_zat = -499_985_000;
    expect(reviewInspection(x, 'FullPrivacy', expected, 'orchard').ok).toBe(false);
  });
});

describe('wallet config', () => {
  it('refuses public RPC hosts (P11)', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.1.2.3')).toBe(true);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('example.com')).toBe(false);
    const r = loadWalletConfig({ SETRYA_NETWORK: 'testnet', ZALLET_RPC_URL: 'http://203.0.113.5:28232', ZEBRA_RPC_URL: 'http://127.0.0.1:18232', SETRYA_PAYER_ACCOUNT_UUID: '00000000-0000-0000-0000-000000000000' });
    expect(r.ok).toBe(false);
  });
  it('reports not configured without RPC URLs', () => {
    expect(loadWalletConfig({})).toMatchObject({ ok: false, reason: 'NOT_CONFIGURED' });
  });
});

describe('RPC allowlist (P17)', () => {
  it('refuses methods outside the allowlist before any network call', async () => {
    const client = new RpcClient({ url: new URL('http://127.0.0.1:1') }, ZALLET_METHODS, 'Zallet');
    await expect(client.call('walletpassphrase' as never)).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
  });
  it('reports an unreachable wallet as WALLET_UNAVAILABLE, never success (Z02)', async () => {
    const client = new RpcClient({ url: new URL('http://127.0.0.1:1') }, ZALLET_METHODS, 'Zallet');
    await expect(client.call('getwalletstatus')).rejects.toBeInstanceOf(WalletError);
  });
});
