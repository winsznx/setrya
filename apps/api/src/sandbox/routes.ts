import { getDb, schema, eq, inArray } from '@setrya/db';
import { sha256 } from '@setrya/security';
import type { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../http/app-env';
import { ApiError, body, clientKey, rateLimit, route } from '../http/route';
import { ownerExists } from '../services/owner';
import { assessForInstall } from '../services/partners';
import { walletHealth } from '../services/wallet';

import { SandboxOperator } from './client';
import type { SandboxConfig } from './config';
import { claimFingerprint, CLAIM_STAGES, SandboxWorker } from './worker';

const UNFINISHED = ['queued', 'setting_up', 'approved', 'inspected', 'authorised', 'confirmed'];

/** Public endpoints of the testnet sandbox: claim a payout to your own address, then follow it to your statement. */
export async function registerSandbox(app: Hono<AppEnv>, edgeKey: string, config: SandboxConfig): Promise<void> {
  const operator = new SandboxOperator(app, edgeKey, config.origin);
  const worker = new SandboxWorker(operator, config);

  app.get('/api/v1/sandbox/status', route('none', async () => {
    const health = await walletHealth({ maxAgeMs: 30_000 });
    return { canPay: health.canPay, spendableZat: health.balance?.spendableZat ?? '0', payoutZat: config.payoutZat.toString(), network: 'testnet', queued: worker.queueLength };
  }));

  app.post('/api/v1/sandbox/claims', route('none', async (req) => {
    rateLimit(`sandbox-claim:${clientKey(req)}`, 3, 60 * 60_000);
    const { address } = await body(req, z.object({ address: z.string().trim().min(10).max(2048) }));
    const assessment = assessForInstall(address);
    if (!assessment.ok) throw new ApiError('ADDRESS_UNSUPPORTED', assessment.message, { fieldErrors: { address: assessment.message } });
    const fingerprint = claimFingerprint(address);
    const [existing] = await getDb().select({ id: schema.sandboxClaims.id }).from(schema.sandboxClaims).where(eq(schema.sandboxClaims.addressFingerprint, fingerprint));
    if (existing) return { claimId: existing.id, existing: true };
    const [row] = await getDb().insert(schema.sandboxClaims).values({ addressFingerprint: fingerprint, clientKeyHash: sha256(clientKey(req)), state: 'queued' }).returning({ id: schema.sandboxClaims.id });
    worker.enqueue({ id: row!.id, address });
    return { claimId: row!.id, existing: false };
  }));

  app.get('/api/v1/sandbox/claims/:claimId', route('none', async (req, _ctx, { claimId }) => {
    rateLimit(`sandbox-status:${clientKey(req)}`, 120, 60_000);
    if (!z.string().uuid().safeParse(claimId).success) throw new ApiError('NOT_FOUND', 'Not found.');
    const [claim] = await getDb().select().from(schema.sandboxClaims).where(eq(schema.sandboxClaims.id, claimId!));
    if (!claim) throw new ApiError('NOT_FOUND', 'Not found.');
    const [tx] = claim.transactionId ? await getDb().select({ txid: schema.chainTransactions.txid, state: schema.chainTransactions.state, confirmations: schema.chainTransactions.confirmations }).from(schema.chainTransactions).where(eq(schema.chainTransactions.id, claim.transactionId)) : [];
    const link = claim.state === 'ready' ? await worker.link(claim) : null;
    return {
      state: claim.state,
      stages: CLAIM_STAGES,
      position: worker.position(claim.id),
      error: claim.error,
      txid: tx?.txid ?? null,
      txState: tx?.state ?? null,
      confirmations: tx?.confirmations ?? 0,
      statementPath: link ? `/try/r/${link.shareId}#k=${link.key}` : null,
    };
  }));

  // Routes are registered above, before the first in-process request builds the router.
  if (!(await ownerExists())) {
    await operator.call('POST', '/api/v1/bootstrap/owner', {
      displayName: 'Sandbox operator',
      email: config.owner.email,
      password: config.owner.password,
      confirmPassword: config.owner.password,
      vaultPassphrase: config.owner.vaultPassphrase,
      confirmVaultPassphrase: config.owner.vaultPassphrase,
      setupToken: config.owner.setupToken,
      timezone: 'UTC',
      acknowledge: true,
    });
  }
  // A restart loses the in-memory queue and each claimant's address, so unfinished claims end honestly.
  await getDb().update(schema.sandboxClaims).set({ state: 'failed', error: 'The sandbox restarted before this payout finished. Claim again with a new address.', updatedAt: new Date() }).where(inArray(schema.sandboxClaims.state, UNFINISHED));
}
