// TEST HARNESS ONLY. NOT A ZCASH NODE OR WALLET. Nothing here touches a real chain.
// Implements the JSON-RPC shapes Setrya's adapter uses (Zallet v0.1.0-beta.3, Zebra v7.0.0) over an in-memory chain so
// the payment state machine can be exercised on a machine that cannot run the Linux-only Zallet zebra backend.
// Faults: POST /_control/fault {"fault": "none|mismatch|transparent|timeout_once|reject"}; mine: POST /_control/mine {"n":1}.
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import { makeUa } from '../../fixtures/make-test-ua.mjs';

const PORT = Number(process.env.STUB_PORT ?? 18990);
const ACCOUNT = process.env.STUB_ACCOUNT ?? '11111111-2222-4333-8444-555555555555';
const state = { tip: 4_200_000, mempool: new Map(), mined: new Map(), fault: 'none', timedOut: false, balance: 5_000_000_000n, receive: makeUa('utest', [[3, 43]]) };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const dec = (s) => JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
const zat = (amount) => { const [w, f = ''] = String(amount).split('.'); return BigInt(w) * 100000000n + BigInt((f + '00000000').slice(0, 8)); };
// ZIP 317 conventional fee: each payee plus the change output is one Ironwood action, with a two-action minimum.
const feeFor = (payees) => 5000n * BigInt(Math.max(2, payees + 1));

const zallet = {
  'rpc.discover': () => ({ methods: ['pczt_create', 'pczt_inspect', 'pczt_prove', 'pczt_sign', 'pczt_extract', 'z_getbalanceforaccount', 'z_viewtransaction', 'getwalletstatus', 'z_listaccounts', 'z_getaddressforaccount', 'z_listtransactions', 'getwalletinfo'].map((name) => ({ name })) }),
  getwalletstatus: () => ({ node_tip: { blockhash: sha(`b${state.tip}`), height: state.tip }, wallet_tip: { blockhash: sha(`b${state.tip}`), height: state.tip }, fully_synced_height: state.tip, locked: false }),
  getwalletinfo: () => ({ walletversion: 1, unlocked_until: undefined }),
  z_listaccounts: () => [{ account_uuid: ACCOUNT, name: 'stub payer (test harness)' }],
  z_getaddressforaccount: () => ({ account_uuid: ACCOUNT, diversifier_index: 0, receiver_types: ['orchard'], address: state.receive }),
  z_getbalanceforaccount: () => ({ pools: { ironwood: { valueZat: Number(state.balance) } }, minimum_confirmations: 1 }),
  pczt_create: ([from, amounts, , policy]) => {
    if (from !== ACCOUNT) throw { code: -8, message: 'unknown account' };
    if (policy !== 'FullPrivacy') throw { code: -8, message: 'stub only accepts FullPrivacy' };
    const total = amounts.reduce((s, a) => s + zat(a.amount), 0n);
    if (total + feeFor(amounts.length) > state.balance) throw { code: -6, message: 'Insufficient funds: not enough shielded value' };
    return { pczt: enc({ id: randomBytes(8).toString('hex'), amounts, expiry: state.tip + 40, stage: 'created' }), privacy_policy: state.fault === 'transparent' ? 'AllowRevealedRecipients' : 'FullPrivacy' };
  },
  pczt_inspect: ([pczt]) => {
    const p = dec(pczt);
    const outputs = p.amounts.map((a, i) => ({ value_zat: Number(zat(a.amount) - (state.fault === 'mismatch' && i === 0 ? 1n : 0n)), user_address: a.address }));
    outputs.push({ value_zat: 123456 });
    return { tx_version: 6, expiry_height: p.expiry, privacy_policy: state.fault === 'transparent' ? 'AllowRevealedRecipients' : 'FullPrivacy', wallet_created: true, fee_zat: Number(feeFor(p.amounts.length)), transparent: { inputs: [], outputs: state.fault === 'transparent' ? [{ value_zat: 1000 }] : [] }, sapling: { spends: 0, outputs: [], value_balance_zat: 0 }, orchard: { actions: 0, outputs: [], value_balance_zat: 0 }, ironwood: { actions: outputs.length, outputs, value_balance_zat: Number(feeFor(p.amounts.length)) } };
  },
  pczt_prove: ([pczt]) => ({ pczt: enc({ ...dec(pczt), stage: 'proven' }), ironwood_proven: true }),
  pczt_sign: ([pczt]) => ({ pczt: enc({ ...dec(pczt), stage: 'signed' }), ironwood_signed: true, unsigned_transparent: [], unsigned_sapling: [], unsigned_orchard: [], unsigned_ironwood: [] }),
  pczt_extract: ([pczt]) => {
    const p = dec(pczt);
    if (p.stage !== 'signed') throw { code: -8, message: 'PCZT is not fully signed' };
    const hex = Buffer.from(JSON.stringify(p)).toString('hex');
    return { hex, txid: sha(hex), stored: true };
  },
  z_viewtransaction: ([txid]) => {
    const m = state.mined.get(txid) ?? (state.mempool.has(txid) ? { height: null, ...state.mempool.get(txid) } : null);
    if (!m) throw { code: -5, message: 'Invalid or non-wallet transaction id' };
    return { txid, status: m.height ? 'mined' : 'waiting', confirmations: m.height ? state.tip - m.height + 1 : 0, fee: Number(m.fee ?? 0n), outputs: [] };
  },
  z_listtransactions: () => [...state.mined.entries()].map(([txid, m]) => ({ txid, mined_height: m.height, confirmations: state.tip - m.height + 1, account_balance_delta: -Number(m.total + m.fee), fee_zat: Number(m.fee) })),
};

const zebra = {
  getblockchaininfo: () => ({ chain: 'test', blocks: state.tip, estimatedheight: state.tip, bestblockhash: sha(`b${state.tip}`) }),
  getinfo: () => ({ build: 'stub-harness (not zebrad)', subversion: '/stub/', testnet: true, connections: 0 }),
  sendrawtransaction: async ([hex]) => {
    if (state.fault === 'reject') throw { code: -26, message: 'transaction rejected by stub (fault injection)' };
    const txid = sha(hex);
    const p = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    state.mempool.set(txid, { total: p.amounts.reduce((s, a) => s + zat(a.amount), 0n), fee: feeFor(p.amounts.length) });
    if (state.fault === 'timeout_once' && !state.timedOut) { state.timedOut = true; await new Promise((r) => setTimeout(r, 60_000)); }
    return txid;
  },
  getrawtransaction: ([txid]) => {
    const m = state.mined.get(txid);
    if (m) return { txid, height: m.height, confirmations: state.tip - m.height + 1, blockhash: sha(`b${m.height}`) };
    if (state.mempool.has(txid)) return { txid };
    throw { code: -5, message: 'No such mempool or main chain transaction' };
  },
  getrawmempool: () => [...state.mempool.keys()],
};

function mine(n) {
  for (let i = 0; i < n; i += 1) {
    state.tip += 1;
    for (const [txid, t] of state.mempool) { state.mined.set(txid, { ...t, height: state.tip }); state.balance -= t.total + t.fee; }
    state.mempool.clear();
  }
}

const read = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
createServer(async (req, res) => {
  const body = await read(req);
  const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))); };
  if (req.url === '/_control/mine') { mine(JSON.parse(body || '{}').n ?? 1); return json(200, { tip: state.tip }); }
  if (req.url === '/_control/fault') { state.fault = JSON.parse(body).fault; state.timedOut = false; return json(200, { fault: state.fault }); }
  if (req.url === '/_control/state') return json(200, { tip: state.tip, mempool: [...state.mempool.keys()], mined: [...state.mined.keys()], fault: state.fault });
  const table = req.url === '/zallet' ? zallet : req.url === '/zebra' ? zebra : null;
  if (!table) return json(404, {});
  const { id, method, params } = JSON.parse(body);
  const fn = table[method];
  if (!fn) return json(200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  try { json(200, { jsonrpc: '2.0', id, result: await fn(params ?? []) }); } catch (e) { json(200, { jsonrpc: '2.0', id, error: { code: e.code ?? -1, message: e.message ?? String(e) } }); }
}).listen(PORT, '127.0.0.1', () => console.log(`stub RPC harness on 127.0.0.1:${PORT} (TEST ONLY, NOT ZCASH)`));
