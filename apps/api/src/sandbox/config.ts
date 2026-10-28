/**
 * The public testnet sandbox runs as its own installation, with its own database, master key and wallet. Nothing in it
 * is shared with an operator's real workspace. It is off unless SETRYA_SANDBOX=1.
 */
export interface SandboxConfig {
  owner: { email: string; password: string; vaultPassphrase: string; setupToken: string };
  payoutZat: bigint;
  origin: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required when SETRYA_SANDBOX=1`);
  return value;
}

export function loadSandboxConfig(env: NodeJS.ProcessEnv = process.env): SandboxConfig | null {
  if (env.SETRYA_SANDBOX !== '1') return null;
  if (env.SETRYA_NETWORK !== 'testnet') throw new Error('The sandbox only runs on testnet');
  const payoutZat = BigInt(env.SETRYA_SANDBOX_PAYOUT_ZAT ?? '1000000');
  if (payoutZat <= 0n || payoutZat > 5_000_000n) throw new Error('SETRYA_SANDBOX_PAYOUT_ZAT must be between 1 and 5,000,000 zatoshis');
  return {
    owner: {
      email: required(env, 'SETRYA_SANDBOX_OWNER_EMAIL'),
      password: required(env, 'SETRYA_SANDBOX_OWNER_PASSWORD'),
      vaultPassphrase: required(env, 'SETRYA_SANDBOX_VAULT_PASSPHRASE'),
      setupToken: setupToken(env),
    },
    payoutZat,
    origin: required(env, 'SETRYA_PUBLIC_ORIGIN').split(',')[0]!.trim(),
  };
}

function setupToken(env: NodeJS.ProcessEnv): string {
  const token = required(env, 'SETRYA_SETUP_TOKEN');
  if (token.length < 24) throw new Error('SETRYA_SETUP_TOKEN must be at least 24 characters');
  return token;
}
