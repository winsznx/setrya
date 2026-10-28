import { getDb, schema, eq, and, desc, isNull } from '@setrya/db';
import { payoutStateFromTx, type TxState } from '@setrya/domain';

export interface SettlementLine {
  periodId: string;
  periodStatus: string;
  revision: number;
  rowKey: string;
  owed: string;
  currency: string;
  zat: bigint | null;
  status: string;
  intentId: string | null;
  payoutState: ReturnType<typeof payoutStateFromTx> | null;
  txState: TxState | null;
  confirmedAt: Date | null;
}

/** Every calculation row for one partner on each period's current revision, with its payout state. */
export async function partnerSettlements(projectId: string, partnerId: string): Promise<SettlementLine[]> {
  const db = getDb();
  const rows = await db
    .select({ row: schema.calculationRows, period: schema.periods })
    .from(schema.calculationRows)
    .innerJoin(schema.periods, and(eq(schema.periods.id, schema.calculationRows.periodId), eq(schema.periods.revision, schema.calculationRows.revision)))
    .where(and(eq(schema.periods.projectId, projectId), eq(schema.calculationRows.partnerId, partnerId)))
    .orderBy(desc(schema.periods.startAt));
  const intents = await db
    .select({ intent: schema.payoutIntents, txState: schema.chainTransactions.state, minedAt: schema.chainTransactions.minedAt })
    .from(schema.payoutIntents)
    .innerJoin(schema.approvals, and(eq(schema.approvals.id, schema.payoutIntents.approvalId), isNull(schema.approvals.invalidatedAt)))
    .leftJoin(schema.chainTransactions, eq(schema.chainTransactions.id, schema.payoutIntents.chainTransactionId))
    .where(eq(schema.payoutIntents.partnerId, partnerId));
  return rows.map(({ row, period }) => {
    const i = intents.find((x) => x.intent.calculationRowId === row.id);
    const txState = (i?.txState as TxState | null | undefined) ?? null;
    return {
      periodId: period.id,
      periodStatus: period.status,
      revision: period.revision,
      rowKey: row.rowKey,
      owed: row.owedDecimal,
      currency: row.currency,
      zat: row.amountZat,
      status: row.status,
      intentId: i?.intent.id ?? null,
      payoutState: i ? payoutStateFromTx(txState) : null,
      txState,
      confirmedAt: txState === 'CONFIRMED' ? (i?.minedAt ?? null) : null,
    };
  });
}
