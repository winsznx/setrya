// Runs the real adapter against tests/integration/stub-rpc (a TEST HARNESS, not Zcash) to check fault handling.
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { makeUa } from '../../../tests/fixtures/make-test-ua.mjs';
import { WalletError, ZalletAdapter } from '../src';

const PORT = 18991;
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
let server: ChildProcess;
const control = (path: string, body: unknown) => fetch(`http://127.0.0.1:${PORT}/_control/${path}`, { method: 'POST', body: JSON.stringify(body) });

const adapter = new ZalletAdapter({
  network: 'testnet',
  connectionName: 'harness',
  zallet: { url: new URL(`http://127.0.0.1:${PORT}/zallet`), user: 'u', password: 'p' },
  zebra: { url: new URL(`http://127.0.0.1:${PORT}/zebra`), user: 'u', password: 'p' },
  accountUuid: ACCOUNT,
  fundSource: 'orchard',
  timeoutMs: 1500,
  proveTimeoutMs: 5000,
});
const outputs = [{ payoutId: 'p1', address: makeUa('utest', [[3, 43]]), amountZat: 460_000_000n }];

beforeAll(async () => {
  server = spawn('node', [fileURLToPath(new URL('../../../tests/integration/stub-rpc/server.mjs', import.meta.url))], { env: { ...process.env, STUB_PORT: String(PORT), STUB_ACCOUNT: ACCOUNT }, stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/_control/state`, { method: 'POST' }); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
});
afterAll(() => server.kill());

async function build(fault: string) {
  await control('fault', { fault });
  const created = await adapter.createPczt(outputs, new Map(), 1);
  return { created, ...(await adapter.inspect(created.pczt, created.privacy_policy, outputs)) };
}

describe('adapter against the RPC harness', () => {
  it('reports a healthy, payable wallet (Z01)', async () => {
    const h = await adapter.health(1);
    expect(h.blockers).toEqual([]);
    expect(h.canPay).toBe(true);
    expect(h.network.detected).toBe('testnet');
  });
  it('passes an exact proposal and extracts without broadcasting (Z06, Z12)', async () => {
    const { created, review } = await build('none');
    expect(review.ok).toBe(true);
    const ex = await adapter.extract(await adapter.sign(await adapter.prove(created.pczt)));
    expect(ex.txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await adapter.lookupTransaction(ex.txid)).known).toBe(false);
  });
  it('blocks a 1-zatoshi mismatch (Z09, M25)', async () => {
    expect((await build('mismatch')).review.ok).toBe(false);
  });
  it('blocks a proposal with a transparent output or weaker policy (Z10)', async () => {
    const { review } = await build('transparent');
    expect(review.checks.find((c) => c.id === 'policy')!.pass).toBe(false);
    expect(review.checks.find((c) => c.id === 'transparent')!.pass).toBe(false);
  });
  it('turns a broadcast timeout into an unknown outcome, then finds the tx (Z17, Z18)', async () => {
    const { created } = await build('none');
    const ex = await adapter.extract(await adapter.sign(await adapter.prove(created.pczt)));
    await control('fault', { fault: 'timeout_once' });
    await expect(adapter.broadcast(ex.hex, ex.txid)).rejects.toMatchObject({ code: 'BROADCAST_OUTCOME_UNKNOWN' });
    expect((await adapter.lookupTransaction(ex.txid)).inMempool).toBe(true);
    await control('mine', { n: 3 });
    expect((await adapter.lookupTransaction(ex.txid)).confirmations).toBe(3);
  });
  it('reports a node rejection as BROADCAST_REJECTED', async () => {
    const { created } = await build('none');
    const ex = await adapter.extract(await adapter.sign(await adapter.prove(created.pczt)));
    await control('fault', { fault: 'reject' });
    await expect(adapter.broadcast(ex.hex, ex.txid)).rejects.toBeInstanceOf(WalletError);
    await expect(adapter.broadcast(ex.hex, ex.txid)).rejects.toMatchObject({ code: 'BROADCAST_REJECTED' });
  });
  it('refuses insufficient funds without falling back (Z04 analogue)', async () => {
    await control('fault', { fault: 'none' });
    await expect(adapter.createPczt([{ ...outputs[0]!, amountZat: 9_000_000_000n }], new Map(), 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_SHIELDED_FUNDS' });
  });
});
