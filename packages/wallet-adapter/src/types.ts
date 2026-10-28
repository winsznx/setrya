/** Shapes from Zallet v0.1.0-beta.3 and Zebra v7.0.0 RPC sources. Only fields Setrya reads are typed. */

export interface ZalletWalletStatus {
  node_tip: { blockhash: string; height: number };
  wallet_tip?: { blockhash: string; height: number };
  fully_synced_height?: number;
  sync_work_remaining?: { unscanned_blocks: number; progress: { numerator: number; denominator: number } };
  locked: boolean;
}

export interface ZalletWalletInfo {
  unlocked_until?: number;
}

export interface ZalletAccount {
  account_uuid: string;
  name?: string;
  addresses?: { ua?: string; sapling?: string; transparent?: string }[];
}

export interface ZalletBalance {
  pools: Partial<Record<'transparent' | 'sapling' | 'orchard' | 'ironwood', { valueZat: number | string }>>;
  minimum_confirmations: number;
}

export interface ZalletAddress {
  account_uuid: string;
  diversifier_index: number | string;
  receiver_types: string[];
  address: string;
}

export interface PcztCreateResult {
  pczt: string;
  privacy_policy: string;
}

export interface InspectOutput {
  value_zat?: number | string;
  user_address?: string;
  address?: string;
}

/** `actions` and `spends` are counts, not lists. */
export interface InspectShieldedPool {
  actions?: number;
  spends?: number;
  outputs?: InspectOutput[];
  value_balance_zat?: number | string;
}

export interface PcztInspection {
  tx_version?: number;
  consensus_branch_id?: string | number;
  expiry_height?: number;
  privacy_policy?: string;
  wallet_created?: boolean;
  fee_zat?: number | string;
  transparent?: { inputs?: unknown[]; outputs?: InspectOutput[] };
  sapling?: InspectShieldedPool;
  orchard?: InspectShieldedPool;
  ironwood?: InspectShieldedPool;
}

export interface PcztProveResult {
  pczt: string;
}

export interface PcztSignResult {
  pczt: string;
  unsigned_transparent?: unknown[];
  unsigned_sapling?: unknown[];
  unsigned_orchard?: unknown[];
  unsigned_ironwood?: unknown[];
}

export interface PcztExtractResult {
  hex: string;
  txid: string;
  stored?: boolean;
}

export interface ZalletViewTransaction {
  txid: string;
  status: 'waiting' | 'mined' | 'expiringsoon' | 'expired';
  confirmations: number;
  blockhash?: string;
  blocktime?: number;
  fee?: number | string;
  outputs?: { pool: string; address?: string; outgoing?: boolean; walletInternal?: boolean; valueZat?: number | string }[];
  accounts?: Record<string, unknown>;
}

export interface ZebraBlockchainInfo {
  chain: string;
  blocks: number;
  estimatedheight?: number;
  bestblockhash?: string;
  verificationprogress?: number;
}

export interface ZebraInfo {
  build?: string;
  subversion?: string;
  testnet?: boolean;
  connections?: number;
}

export interface ZebraRawTransaction {
  txid: string;
  height?: number;
  confirmations?: number;
  blockhash?: string;
  blocktime?: number;
}
