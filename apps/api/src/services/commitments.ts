import { getDb, schema, eq, and, asc, isNull } from '@setrya/db';
import { COMMITMENT_MEMO_FORMAT, type PayoutLeaf, type PayoutProof, proofFromLeafHashes, rootFromLeafHashes } from '@setrya/domain';

import type { PeriodView } from './periods';
import type { UnlockedContext } from './session';

export interface StatementCommitment {
  version: 1;
  root: string;
  entries: { memo: string; leaf: PayoutLeaf; proof: PayoutProof }[];
}

export async function statementCommitment(ctx: UnlockedContext, approvalId: string, partnerId: string): Promise<StatementCommitment | null> {
  const [approval] = await getDb().select({ root: schema.approvals.payoutRoot }).from(schema.approvals).where(eq(schema.approvals.id, approvalId));
  if (!approval?.root) return null;
  const rows = await getDb()
    .select({ id: schema.payoutCommitments.id, index: schema.payoutCommitments.leafIndex, hash: schema.payoutCommitments.leafHash, leaf: schema.payoutCommitments.encryptedLeaf, partnerId: schema.payoutIntents.partnerId, memo: schema.payoutIntents.memoText })
    .from(schema.payoutCommitments)
    .innerJoin(schema.payoutIntents, eq(schema.payoutIntents.id, schema.payoutCommitments.payoutIntentId))
    .where(eq(schema.payoutCommitments.approvalId, approvalId))
    .orderBy(asc(schema.payoutCommitments.leafIndex));
  const hashes = rows.map((r) => r.hash);
  if (rootFromLeafHashes(hashes) !== approval.root) throw new Error('Stored payout commitments do not rebuild the approved root.');
  const entries = rows
    .filter((r) => r.partnerId === partnerId)
    .map((r) => ({ memo: r.memo ?? '', leaf: ctx.cipher.decJson<PayoutLeaf>('payout_commitments', r.id, 'leaf', r.leaf), proof: proofFromLeafHashes(hashes, r.index) }));
  return entries.length > 0 ? { version: 1, root: approval.root, entries } : null;
}


export interface CommitmentBundle {
  version: 1;
  periodId: string;
  revision: number;
  approvalId: string;
  root: string;
  memoFormat: string;
  /** Every leaf in tree order, salts included, so an auditor can rebuild the whole tree. Owner only. */
  leaves: (PayoutLeaf & { index: number; leafHash: string; memo: string | null })[];
}

/** The full tree behind a period's active approval, for an auditor. Null before approval or for legacy approvals. */
export async function commitmentBundle(ctx: UnlockedContext, period: PeriodView): Promise<CommitmentBundle | null> {
  const [approval] = await getDb().select({ id: schema.approvals.id, root: schema.approvals.payoutRoot, revision: schema.approvals.revision }).from(schema.approvals).where(and(eq(schema.approvals.periodId, period.id), eq(schema.approvals.revision, period.revision), isNull(schema.approvals.invalidatedAt)));
  if (!approval?.root) return null;
  const rows = await getDb()
    .select({ id: schema.payoutCommitments.id, index: schema.payoutCommitments.leafIndex, hash: schema.payoutCommitments.leafHash, leaf: schema.payoutCommitments.encryptedLeaf, memo: schema.payoutIntents.memoText })
    .from(schema.payoutCommitments)
    .innerJoin(schema.payoutIntents, eq(schema.payoutIntents.id, schema.payoutCommitments.payoutIntentId))
    .where(eq(schema.payoutCommitments.approvalId, approval.id))
    .orderBy(asc(schema.payoutCommitments.leafIndex));
  return {
    version: 1,
    periodId: period.id,
    revision: approval.revision,
    approvalId: approval.id,
    root: approval.root,
    memoFormat: COMMITMENT_MEMO_FORMAT,
    leaves: rows.map((r) => ({ ...ctx.cipher.decJson<PayoutLeaf>('payout_commitments', r.id, 'leaf', r.leaf), index: r.index, leafHash: r.hash, memo: r.memo })),
  };
}
