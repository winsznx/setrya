import { assessAddress, type AddressAssessment, type FundPool, zatToZecString, type ZcashNetwork } from '@setrya/domain';

import { loadWalletConfig, type WalletConfig } from './config';
import { reviewInspection, type ExpectedOutput, type InspectionReview } from './inspect';
import { RpcClient, WalletError, ZALLET_METHODS, ZEBRA_METHODS, type ZalletMethod, type ZebraMethod } from './rpc';
import type {
  PcztCreateResult,
  PcztExtractResult,
  PcztInspection,
  PcztProveResult,
  PcztSignResult,
  ZalletAccount,
  ZalletAddress,
  ZalletBalance,
  ZalletViewTransaction,
  ZalletWalletInfo,
  ZalletWalletStatus,
  ZebraBlockchainInfo,
  ZebraInfo,
  ZebraRawTransaction,
} from './types';

/** Methods the pinned Zallet must advertise for the PCZT settlement path. */
export const REQUIRED_ZALLET_METHODS: readonly ZalletMethod[] = ['pczt_create', 'pczt_inspect', 'pczt_prove', 'pczt_sign', 'pczt_extract', 'z_getbalanceforaccount', 'z_viewtransaction', 'getwalletstatus'];

export interface WalletHealth {
  configured: boolean;
  configProblem: string | null;
  connectionName: string | null;
  checkedAt: string;
  network: { configured: ZcashNetwork | null; detected: ZcashNetwork | 'unknown'; match: boolean };
  zebra: { reachable: boolean; build: string | null; chain: string | null; blocks: number | null; estimatedHeight: number | null; synced: boolean; error: string | null };
  zallet: { reachable: boolean; synced: boolean; syncProgress: string | null; encryptionLocked: boolean | null; missingMethods: string[]; error: string | null };
  account: { found: boolean; uuid: string | null; name: string | null };
  balance: { minConf: number; orchardZat: string; ironwoodZat: string; saplingZat: string; transparentZat: string; spendableZat: string; error: string | null } | null;
  fundSource: FundPool | null;
  rpcPrivate: boolean;
  canPay: boolean;
  blockers: string[];
}

export interface ChainObservation {
  txid: string;
  inMempool: boolean;
  known: boolean;
  height: number | null;
  blockhash: string | null;
  confirmations: number;
  observedAt: string;
}

const probeAddresses = new Map<string, string>();

function zatString(v: number | string | undefined): string {
  if (v === undefined) return '0';
  if (typeof v === 'string') return /^\d+$/.test(v) ? v : '0';
  return Number.isSafeInteger(v) ? String(v) : '0';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export class ZalletAdapter {
  readonly zallet: RpcClient<ZalletMethod>;
  readonly zebra: RpcClient<ZebraMethod>;

  constructor(readonly config: WalletConfig) {
    this.zallet = new RpcClient(config.zallet, ZALLET_METHODS, 'Zallet');
    this.zebra = new RpcClient(config.zebra, ZEBRA_METHODS, 'Zebra');
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ZalletAdapter | { problem: string; configured: boolean } {
    const result = loadWalletConfig(env);
    if (!result.ok) return { problem: result.message, configured: result.reason !== 'NOT_CONFIGURED' };
    return new ZalletAdapter(result.config);
  }

  async health(minConf: number): Promise<WalletHealth> {
    const c = this.config;
    const blockers: string[] = [];
    const health: WalletHealth = {
      configured: true,
      configProblem: null,
      connectionName: c.connectionName,
      checkedAt: new Date().toISOString(),
      network: { configured: c.network, detected: 'unknown', match: false },
      zebra: { reachable: false, build: null, chain: null, blocks: null, estimatedHeight: null, synced: false, error: null },
      zallet: { reachable: false, synced: false, syncProgress: null, encryptionLocked: null, missingMethods: [], error: null },
      account: { found: false, uuid: null, name: null },
      balance: null,
      fundSource: c.fundSource,
      rpcPrivate: true,
      canPay: false,
      blockers,
    };

    try {
      const [chain, info] = await Promise.all([this.zebra.call<ZebraBlockchainInfo>('getblockchaininfo'), this.zebra.call<ZebraInfo>('getinfo')]);
      health.zebra = {
        reachable: true,
        build: info.build ?? info.subversion ?? null,
        chain: chain.chain,
        blocks: chain.blocks,
        estimatedHeight: chain.estimatedheight ?? null,
        synced: chain.estimatedheight === undefined ? false : chain.blocks >= chain.estimatedheight - 2,
        error: null,
      };
      if (!health.zebra.synced) blockers.push('Zebra is still syncing the chain');
      // Zebra reports regtest as "test", so the receiving address HRP below decides between testnet and regtest.
      if (chain.chain === 'main') health.network.detected = 'mainnet';
    } catch (error) {
      health.zebra.error = errorText(error);
      blockers.push('Zebra node is not reachable');
    }

    try {
      const methods = await this.discoverMethods();
      health.zallet.missingMethods = REQUIRED_ZALLET_METHODS.filter((m) => !methods.has(m));
      const [status, info] = await Promise.all([this.zallet.call<ZalletWalletStatus>('getwalletstatus'), this.zallet.call<ZalletWalletInfo>('getwalletinfo').catch(() => null)]);
      health.zallet.reachable = true;
      health.zallet.synced = !status.locked;
      if (status.sync_work_remaining) {
        const { numerator, denominator } = status.sync_work_remaining.progress;
        health.zallet.syncProgress = `${numerator} of ${denominator}`;
      }
      health.zallet.encryptionLocked = info?.unlocked_until === undefined ? null : info.unlocked_until === 0;
      if (health.zallet.missingMethods.length > 0) blockers.push(`Zallet is missing ${health.zallet.missingMethods.join(', ')}`);
      if (!health.zallet.synced) blockers.push('Zallet has not finished scanning the chain');
      if (health.zallet.encryptionLocked) blockers.push('Zallet wallet is locked; unlock it on the settlement host');
    } catch (error) {
      health.zallet.error = errorText(error);
      blockers.push('Zallet wallet service is not reachable');
    }

    if (health.zallet.reachable) {
      try {
        const accounts = await this.zallet.call<ZalletAccount[]>('z_listaccounts', [false]);
        const account = accounts.find((a) => a.account_uuid.toLowerCase() === c.accountUuid);
        health.account = { found: account !== undefined, uuid: c.accountUuid, name: account?.name ?? null };
        if (!account) blockers.push('The configured payer account does not exist in Zallet');
      } catch (error) {
        blockers.push(`Account list failed: ${errorText(error)}`);
      }
    }

    if (health.account.found) {
      try {
        const address = await this.networkProbeAddress();
        const hrp = address.slice(0, address.lastIndexOf('1'));
        health.network.detected = hrp === 'u' ? 'mainnet' : hrp === 'utest' ? 'testnet' : hrp === 'uregtest' ? 'regtest' : 'unknown';
      } catch (error) {
        blockers.push(`Could not derive a receiving address: ${errorText(error)}`);
      }
      try {
        const balance = await this.zallet.call<ZalletBalance>('z_getbalanceforaccount', [c.accountUuid, minConf]);
        const orchard = zatString(balance.pools.orchard?.valueZat);
        const ironwood = zatString(balance.pools.ironwood?.valueZat);
        const sapling = zatString(balance.pools.sapling?.valueZat);
        // FullPrivacy spends from one pool, so the spendable figure is the largest single eligible pool, never their sum.
        const spendable = c.fundSource === 'orchard' ? (BigInt(orchard) > BigInt(ironwood) ? orchard : ironwood) : sapling;
        health.balance = { minConf, orchardZat: orchard, ironwoodZat: ironwood, saplingZat: sapling, transparentZat: zatString(balance.pools.transparent?.valueZat), spendableZat: spendable, error: null };
        if (BigInt(spendable) === 0n) blockers.push('No confirmed shielded funds are spendable under FullPrivacy');
      } catch (error) {
        health.balance = { minConf, orchardZat: '0', ironwoodZat: '0', saplingZat: '0', transparentZat: '0', spendableZat: '0', error: errorText(error) };
        blockers.push('Balance could not be read');
      }
    }

    health.network.match = health.network.detected === c.network;
    if (health.network.detected !== 'unknown' && !health.network.match) blockers.push(`Wallet is on ${health.network.detected} but Setrya is configured for ${c.network}`);
    health.canPay = blockers.length === 0;
    return health;
  }

  private async discoverMethods(): Promise<Set<string>> {
    const doc = await this.zallet.call<{ methods?: { name: string }[] }>('rpc.discover');
    return new Set((doc.methods ?? []).map((m) => m.name));
  }

  /**
   * Health checks only need an address to read its network prefix. Deriving one per check would mint a new
   * diversified address every time, and Zallet refuses that until its seed backup is confirmed.
   */
  private async networkProbeAddress(): Promise<string> {
    const cached = probeAddresses.get(this.config.accountUuid);
    if (cached) return cached;
    const address = await this.deriveReceiveAddress();
    probeAddresses.set(this.config.accountUuid, address);
    return address;
  }

  async deriveReceiveAddress(): Promise<string> {
    const receivers = this.config.fundSource === 'orchard' ? ['orchard'] : ['sapling'];
    const result = await this.zallet.call<ZalletAddress>('z_getaddressforaccount', [this.config.accountUuid, receivers]);
    return result.address;
  }

  validateRecipient(address: string): AddressAssessment {
    return assessAddress(address, this.config.network, this.config.fundSource);
  }

  async spendableZat(minConf: number): Promise<bigint> {
    const balance = await this.zallet.call<ZalletBalance>('z_getbalanceforaccount', [this.config.accountUuid, minConf]);
    const pick = (k: 'orchard' | 'ironwood' | 'sapling') => BigInt(zatString(balance.pools[k]?.valueZat));
    return this.config.fundSource === 'orchard' ? (pick('orchard') > pick('ironwood') ? pick('orchard') : pick('ironwood')) : pick('sapling');
  }

  /** pczt_create under FullPrivacy from one isolating fund source. Memos carry only an opaque reference. */
  async createPczt(outputs: readonly ExpectedOutput[], memos: ReadonlyMap<string, string>, minConf: number): Promise<PcztCreateResult> {
    for (const o of outputs) {
      const a = this.validateRecipient(o.address);
      if (!a.ok) throw new WalletError('PRIVACY_POLICY_REJECTED', `Recipient for payout ${o.payoutId} rejected: ${a.message}`);
      if (o.amountZat <= 0n) throw new WalletError('TRANSACTION_MISMATCH', 'Payout amounts must be positive');
    }
    const amounts = outputs.map((o) => {
      const memo = memos.get(o.payoutId);
      return { address: o.address, amount: zatToZecString(o.amountZat), ...(memo ? { memo: Buffer.from(memo, 'utf8').toString('hex') } : {}) };
    });
    try {
      return await this.zallet.call<PcztCreateResult>('pczt_create', [this.config.accountUuid, amounts, minConf, 'FullPrivacy', this.config.fundSource], this.config.timeoutMs);
    } catch (error) {
      if (error instanceof WalletError && /insufficient/i.test(error.message)) throw new WalletError('INSUFFICIENT_SHIELDED_FUNDS', error.message, error.rpcCode);
      if (error instanceof WalletError && /privacy|policy|reveal/i.test(error.message)) throw new WalletError('PRIVACY_POLICY_REJECTED', error.message, error.rpcCode);
      throw error;
    }
  }

  async inspect(pczt: string, createdPolicy: string, expected: readonly ExpectedOutput[]): Promise<{ raw: PcztInspection; review: InspectionReview }> {
    const raw = await this.zallet.call<PcztInspection>('pczt_inspect', [pczt]);
    return { raw, review: reviewInspection(raw, createdPolicy, expected, this.config.fundSource) };
  }

  /**
   * The first proof per circuit builds the proving key and can outlast even the long timeout. The wallet caches the
   * key, so one retry after a timeout is the documented recovery. Proving is deterministic input to signing, so a
   * retry cannot change what gets paid.
   */
  async prove(pczt: string): Promise<string> {
    try {
      return (await this.zallet.call<PcztProveResult>('pczt_prove', [pczt], this.config.proveTimeoutMs)).pczt;
    } catch (error) {
      if (!(error instanceof WalletError && error.code === 'WALLET_TIMEOUT')) throw error;
      return (await this.zallet.call<PcztProveResult>('pczt_prove', [pczt], this.config.proveTimeoutMs)).pczt;
    }
  }

  async sign(pczt: string): Promise<string> {
    const result = await this.zallet.call<PcztSignResult>('pczt_sign', [pczt, 'FullPrivacy', true], this.config.timeoutMs);
    const unsigned = [result.unsigned_transparent, result.unsigned_sapling, result.unsigned_orchard, result.unsigned_ironwood].reduce((n, l) => n + (l?.length ?? 0), 0);
    if (unsigned > 0) throw new WalletError('TRANSACTION_MISMATCH', `${unsigned} input(s) were left unsigned`);
    return result.pczt;
  }

  async extract(pczt: string): Promise<PcztExtractResult> {
    const result = await this.zallet.call<PcztExtractResult>('pczt_extract', [pczt], this.config.timeoutMs);
    if (!/^[0-9a-f]{64}$/i.test(result.txid) || !/^[0-9a-f]+$/i.test(result.hex)) throw new WalletError('TRANSACTION_MISMATCH', 'Extract returned a malformed transaction');
    return result;
  }

  /**
   * Submits the exact persisted bytes. A timeout or transport failure here is BROADCAST_OUTCOME_UNKNOWN: the node may
   * have accepted it, so the caller must investigate before any further attempt.
   */
  async broadcast(hex: string, expectedTxid: string): Promise<string> {
    try {
      const txid = await this.zebra.call<string>('sendrawtransaction', [hex], this.config.timeoutMs);
      if (txid.toLowerCase() !== expectedTxid.toLowerCase()) throw new WalletError('TRANSACTION_MISMATCH', 'Node returned a different txid than extract');
      return txid;
    } catch (error) {
      if (error instanceof WalletError && (error.code === 'WALLET_TIMEOUT' || error.code === 'WALLET_UNAVAILABLE')) {
        throw new WalletError('BROADCAST_OUTCOME_UNKNOWN', error.message);
      }
      if (error instanceof WalletError && error.code === 'WALLET_RPC_ERROR') {
        if (/already|known|in chain|duplicate/i.test(error.message)) return expectedTxid;
        throw new WalletError('BROADCAST_REJECTED', error.message, error.rpcCode);
      }
      throw error;
    }
  }

  async lookupTransaction(txid: string): Promise<ChainObservation> {
    const observedAt = new Date().toISOString();
    try {
      const tx = await this.zebra.call<ZebraRawTransaction>('getrawtransaction', [txid, 1]);
      const mined = tx.height !== undefined && tx.height >= 0 && tx.confirmations !== undefined;
      return { txid, known: true, inMempool: !mined, height: mined ? tx.height! : null, blockhash: mined ? (tx.blockhash ?? null) : null, confirmations: mined ? tx.confirmations! : 0, observedAt };
    } catch (error) {
      if (error instanceof WalletError && error.code === 'WALLET_RPC_ERROR') {
        const mempool = await this.zebra.call<string[]>('getrawmempool', [false]).catch(() => [] as string[]);
        if (mempool.includes(txid)) return { txid, known: true, inMempool: true, height: null, blockhash: null, confirmations: 0, observedAt };
        return { txid, known: false, inMempool: false, height: null, blockhash: null, confirmations: 0, observedAt };
      }
      throw error;
    }
  }

  async viewTransaction(txid: string): Promise<ZalletViewTransaction | null> {
    try {
      return await this.zallet.call<ZalletViewTransaction>('z_viewtransaction', [txid]);
    } catch (error) {
      if (error instanceof WalletError && error.code === 'WALLET_RPC_ERROR') return null;
      throw error;
    }
  }

  async listTransactions(limit = 50): Promise<unknown[]> {
    return this.zallet.call<unknown[]>('z_listtransactions', [this.config.accountUuid, null, null, 0, limit]);
  }
}

export function unconfiguredHealth(problem: string, configured: boolean): WalletHealth {
  return {
    configured,
    configProblem: problem,
    connectionName: null,
    checkedAt: new Date().toISOString(),
    network: { configured: null, detected: 'unknown', match: false },
    zebra: { reachable: false, build: null, chain: null, blocks: null, estimatedHeight: null, synced: false, error: null },
    zallet: { reachable: false, synced: false, syncProgress: null, encryptionLocked: null, missingMethods: [], error: null },
    account: { found: false, uuid: null, name: null },
    balance: null,
    fundSource: null,
    rpcPrivate: true,
    canPay: false,
    blockers: [problem],
  };
}
