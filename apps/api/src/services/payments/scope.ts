import { getDb, schema, eq } from '@setrya/db';

import type { UnlockedContext } from '../session';
import { batchDigest, loadTx } from './context';

/** A signing step-up is bound to this exact prepared transaction: its PCZT hash, fee, total and recipients. */
export async function transactionScope(ctx: UnlockedContext, txId: string) {
  const { tx, batch, intents, projectId } = await loadTx(ctx.ownerId, txId);
  const [project] = await getDb().select({ w: schema.projects.stepUpWindowSeconds }).from(schema.projects).where(eq(schema.projects.id, projectId));
  return {
    scope: { txId: tx.id, pcztHash: tx.pcztHash, feeZat: tx.feeZat?.toString() ?? null, totalZat: batch.totalZat.toString(), recipientsDigest: batchDigest(intents), accountId: batch.payerAccountId, network: batch.network },
    windowSeconds: project?.w ?? 300,
  };
}
