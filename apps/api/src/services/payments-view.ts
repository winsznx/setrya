import { getDb, schema, eq, and, asc, desc, isNull } from '@setrya/db';
import { maskAddress, payoutStateFromTx, type TxState } from '@setrya/domain';

import type { UnlockedContext } from './session';

export async function listPayouts(ctx: UnlockedContext, projectId: string) {
  const rows = await getDb()
    .select({ intent: schema.payoutIntents, period: schema.periods, approval: schema.approvals, tx: schema.chainTransactions, address: schema.partnerAddresses })
    .from(schema.payoutIntents)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.payoutIntents.periodId))
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.payoutIntents.approvalId))
    .innerJoin(schema.partnerAddresses, eq(schema.partnerAddresses.id, schema.payoutIntents.addressVersionId))
    .leftJoin(schema.chainTransactions, eq(schema.chainTransactions.id, schema.payoutIntents.chainTransactionId))
    .where(eq(schema.periods.projectId, projectId))
    .orderBy(desc(schema.payoutIntents.createdAt));
  return rows.map((r) => {
    const address = ctx.cipher.dec('partner_addresses', r.address.id, 'address', r.address.addressEnc);
    return {
    id: r.intent.id,
    memoRef: r.intent.memoRef,
    partnerId: r.intent.partnerId,
    periodId: r.period.id,
    periodLabel: ctx.cipher.dec('periods', r.period.id, 'label', r.period.labelEnc),
    amountZat: r.intent.amountZat,
    addressMasked: maskAddress(address),
    addressFull: address,
    txid: r.tx?.txid ?? null,
    txId: r.tx?.id ?? null,
    txState: (r.tx?.state as TxState | undefined) ?? null,
    state: r.intent.state === 'superseded' ? ('superseded' as const) : payoutStateFromTx((r.tx?.state as TxState | undefined) ?? null),
    invalidated: r.approval.invalidatedAt !== null,
    feeZat: r.tx?.feeZat ?? null,
    createdAt: r.intent.createdAt,
    lastCheckedAt: r.tx?.lastCheckedAt ?? null,
    network: r.approval.network,
    };
  });
}

export async function listChainTransactions(projectId: string) {
  return getDb()
    .select({ tx: schema.chainTransactions, batch: schema.paymentBatches, periodId: schema.periods.id })
    .from(schema.chainTransactions)
    .innerJoin(schema.paymentBatches, eq(schema.paymentBatches.id, schema.chainTransactions.batchId))
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.paymentBatches.approvalId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.approvals.periodId))
    .where(eq(schema.periods.projectId, projectId))
    .orderBy(desc(schema.chainTransactions.createdAt));
}

export async function getPayout(ctx: UnlockedContext, projectId: string, intentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(intentId)) return null;
  const [r] = await getDb()
    .select({ intent: schema.payoutIntents, period: schema.periods, approval: schema.approvals, row: schema.calculationRows, address: schema.partnerAddresses })
    .from(schema.payoutIntents)
    .innerJoin(schema.periods, and(eq(schema.periods.id, schema.payoutIntents.periodId), eq(schema.periods.projectId, projectId)))
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.payoutIntents.approvalId))
    .innerJoin(schema.calculationRows, eq(schema.calculationRows.id, schema.payoutIntents.calculationRowId))
    .innerJoin(schema.partnerAddresses, eq(schema.partnerAddresses.id, schema.payoutIntents.addressVersionId))
    .where(eq(schema.payoutIntents.id, intentId));
  if (!r) return null;
  const txs = r.intent.batchId ? await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.batchId, r.intent.batchId)).orderBy(asc(schema.chainTransactions.lineage)) : [];
  const attempts = r.intent.batchId ? await getDb().select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.batchId, r.intent.batchId)).orderBy(asc(schema.paymentAttempts.createdAt)) : [];
  const [statement] = await getDb().select({ id: schema.statements.id, reference: schema.statements.reference }).from(schema.statements).where(and(eq(schema.statements.periodId, r.period.id), eq(schema.statements.partnerId, r.intent.partnerId)));
  const [batch] = r.intent.batchId ? await getDb().select().from(schema.paymentBatches).where(eq(schema.paymentBatches.id, r.intent.batchId)) : [];
  const recipientsInBatch = r.intent.batchId ? (await getDb().select({ id: schema.payoutIntents.id }).from(schema.payoutIntents).where(and(eq(schema.payoutIntents.batchId, r.intent.batchId), isNull(schema.payoutIntents.disposition)))).length : 1;
  const current = txs[txs.length - 1] ?? null;
  return {
    intent: r.intent,
    period: { id: r.period.id, label: ctx.cipher.dec('periods', r.period.id, 'label', r.period.labelEnc), status: r.period.status },
    approval: r.approval,
    row: { owed: r.row.owedDecimal, currency: r.row.currency, formulaEnc: r.row.formulaEnc, id: r.row.id, agreementId: r.row.agreementId, agreementVersionId: r.row.agreementVersionId, rateSnapshotId: r.row.rateSnapshotId },
    address: { masked: maskAddress(ctx.cipher.dec('partner_addresses', r.address.id, 'address', r.address.addressEnc)), full: ctx.cipher.dec('partner_addresses', r.address.id, 'address', r.address.addressEnc), version: r.address.version, fingerprint: r.address.fingerprint },
    txs,
    current,
    state: r.intent.state === 'superseded' ? ('superseded' as const) : payoutStateFromTx((current?.state as TxState | undefined) ?? null),
    attempts,
    statement: statement ?? null,
    batch: batch ?? null,
    recipientsInBatch,
  };
}
