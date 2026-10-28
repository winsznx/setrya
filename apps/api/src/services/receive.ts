import { maskAddress } from '@setrya/domain';
import { ZalletAdapter } from '@setrya/wallet-adapter';
import QRCode from 'qrcode';

import { walletAdapter } from './wallet';

/** Wallet-derived shielded receiving address for funding, or null with the reason. */
export async function receiveAddress(): Promise<{ address: string; masked: string; qrSvg: string } | { error: string }> {
  const adapter = walletAdapter();
  if (!(adapter instanceof ZalletAdapter)) return { error: adapter.problem };
  try {
    const address = await adapter.deriveReceiveAddress();
    return { address, masked: maskAddress(address), qrSvg: await QRCode.toString(address, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Address could not be derived' };
  }
}
