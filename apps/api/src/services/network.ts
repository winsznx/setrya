import type { FundPool, ZcashNetwork } from '@setrya/domain';

/** The one network this installation settles on. Addresses, accounts and signing are all checked against it. */
export function configuredNetwork(): ZcashNetwork {
  const n = process.env.SETRYA_NETWORK;
  if (n === 'mainnet' || n === 'testnet' || n === 'regtest') return n;
  if (process.env.NODE_ENV === 'production') throw new Error('SETRYA_NETWORK must be set in production');
  return 'testnet';
}

export function fundPool(): FundPool {
  return process.env.SETRYA_FUND_SOURCE === 'sapling' ? 'sapling' : 'orchard';
}
