import { getDb, schema, eq, and, desc, isNull } from '@setrya/db';
import { decToString, describeRate, describeTerms, type FormulaTrail, parseDec, type PaymentStatus, type SnapshotPayout, sum, type TxState } from '@setrya/domain';

import { getAgreement } from './agreements';
import { getPartner } from './partners';
import { getPeriod, periodRows } from './periods';
import type { ProjectView } from './projects';
import { ratesByIds } from './rates';
import type { UnlockedContext } from './session';
import { listSources } from './sources';

export { WATERMARK, type PaymentStatus } from '@setrya/domain';

export interface StatementLine {
  agreementTitle: string;
  agreementVersion: number;
  rule: string;
  currency: string;
  eligibleBase: string | null;
  owed: string;
  rateDescription: string | null;
  rateQuotedAt: string | null;
  rateSource: string | null;
  zat: string | null;
  formula: FormulaTrail;
  held: string[];
}

/** The canonical statement. Screen, print, CSV and the encrypted share all render this one object. */
export interface StatementDocument {
  id: string;
  reference: string;
  documentVersion: number;
  generatedAt: string;
  issuer: { label: string; org: string; project: string; logo: string | null };
  recipientLabel: string;
  period: { label: string; startAt: string; endAt: string; timezone: string };
  sources: string[];
  lines: StatementLine[];
  totals: { owedByCurrency: Record<string, string>; zat: string | null };
  payment: {
    status: PaymentStatus;
    txState: TxState | null;
    txid: string | null;
    confirmations: number;
    targetConfirmations: number;
    confirmedAt: string | null;
    network: string;
    walletObserved: boolean;
    memoRef: string | null;
  };
  acknowledgment: { kind: string; at: string } | null;
  issuerNote: string;
}

export interface StatementSummary {
  id: string;
  reference: string;
  partnerId: string;
  periodId: string;
  documentVersion: number;
  generatedAt: Date;
  downloadedAt: Date | null;
  shares: { active: number; expired: number; revoked: number };
  acknowledged: boolean;
}

export async function listStatements(projectId: string, filter: { periodId?: string; partnerId?: string } = {}): Promise<StatementSummary[]> {
  const conditions = [eq(schema.statements.projectId, projectId)];
  if (filter.periodId) conditions.push(eq(schema.statements.periodId, filter.periodId));
  if (filter.partnerId) conditions.push(eq(schema.statements.partnerId, filter.partnerId));
  const rows = await getDb().select().from(schema.statements).where(and(...conditions)).orderBy(desc(schema.statements.generatedAt));
  const shares = rows.length ? await getDb().select().from(schema.statementShares) : [];
  const acks = rows.length ? await getDb().select({ shareId: schema.recipientAcknowledgments.statementShareId }).from(schema.recipientAcknowledgments) : [];
  const now = Date.now();
  return rows.map((r) => {
    const mine = shares.filter((s) => s.statementId === r.id);
    return {
      id: r.id,
      reference: r.reference,
      partnerId: r.partnerId,
      periodId: r.periodId,
      documentVersion: r.documentVersion,
      generatedAt: r.generatedAt,
      downloadedAt: r.downloadedAt,
      shares: { active: mine.filter((s) => !s.revokedAt && s.expiresAt.getTime() > now).length, expired: mine.filter((s) => !s.revokedAt && s.expiresAt.getTime() <= now).length, revoked: mine.filter((s) => s.revokedAt).length },
      acknowledged: mine.some((s) => acks.some((a) => a.shareId === s.id)),
    };
  });
}

export async function buildStatement(ctx: UnlockedContext, project: ProjectView, statementId: string): Promise<StatementDocument | null> {
  if (!/^[0-9a-f-]{36}$/i.test(statementId)) return null;
  const [st] = await getDb().select().from(schema.statements).where(and(eq(schema.statements.id, statementId), eq(schema.statements.projectId, project.id)));
  if (!st) return null;
  const snapshot = ctx.cipher.decJson<{ approvalId: string; revision: number; payouts: SnapshotPayout[]; held: { rowKey: string; partnerId: string; reasons: string[] }[] }>('statements', st.id, 'snapshot', st.snapshotEnc);
  const period = await getPeriod(ctx, project.id, st.periodId);
  const partner = await getPartner(ctx, project.id, st.partnerId);
  if (!period || !partner) return null;
  const rows = (await periodRows(ctx, { id: period.id, revision: snapshot.revision })).filter((r) => r.partnerId === st.partnerId && r.status !== 'nothing_owed');
  const rates = await ratesByIds(ctx, project.id, rows.map((r) => r.rateSnapshotId).filter((x): x is string => x !== null));
  const sources = await listSources(ctx, project.id);
  const lines: StatementLine[] = [];
  for (const r of rows) {
    const agreement = await getAgreement(ctx, project.id, r.agreementId);
    const version = agreement?.versions.find((v) => v.id === r.agreementVersionId);
    const rate = rates.find((x) => x.id === r.rateSnapshotId);
    const held = snapshot.held.find((h) => h.rowKey === r.key);
    lines.push({
      agreementTitle: agreement?.title ?? 'Agreement',
      agreementVersion: version?.version ?? 0,
      rule: version ? describeTerms(version.terms) : '',
      currency: r.currency,
      eligibleBase: r.formula.base,
      owed: r.owed,
      rateDescription: rate ? describeRate(rate) : null,
      rateQuotedAt: rate?.quotedAt.toISOString() ?? null,
      rateSource: rate?.sourceText ?? null,
      zat: snapshot.payouts.some((p) => p.payoutKey === r.key) ? r.zat?.toString() ?? null : null,
      formula: r.formula,
      held: held?.reasons ?? [],
    });
  }
  const intent = st.payoutIntentId ? (await getDb().select().from(schema.payoutIntents).where(eq(schema.payoutIntents.id, st.payoutIntentId)))[0] : undefined;
  const [approval] = await getDb().select().from(schema.approvals).where(eq(schema.approvals.id, snapshot.approvalId));
  const tx = intent?.chainTransactionId ? (await getDb().select().from(schema.chainTransactions).where(eq(schema.chainTransactions.id, intent.chainTransactionId)))[0] : undefined;
  const txState = (tx?.state as TxState | undefined) ?? null;
  const status: PaymentStatus = !intent ? 'held' : txState === 'CONFIRMED' ? 'confirmed' : txState && ['FAILED_PRE_BROADCAST', 'BROADCAST_REJECTED', 'CANCELLED_BEFORE_SIGN'].includes(txState) ? 'failed' : txState && txState !== 'PREPARING' && txState !== 'PREPARED_INSPECTED' ? 'pending' : 'approved_not_paid';
  const byCurrency = new Map<string, string[]>();
  for (const l of lines) byCurrency.set(l.currency, [...(byCurrency.get(l.currency) ?? []), l.owed]);
  const [ack] = await getDb().select({ kind: schema.recipientAcknowledgments.kind, at: schema.recipientAcknowledgments.createdAt }).from(schema.recipientAcknowledgments).innerJoin(schema.statementShares, eq(schema.statementShares.id, schema.recipientAcknowledgments.statementShareId)).where(eq(schema.statementShares.statementId, st.id)).limit(1);
  return {
    id: st.id,
    reference: st.reference,
    documentVersion: st.documentVersion,
    generatedAt: st.generatedAt.toISOString(),
    issuer: { label: project.issuerLabel, org: project.orgName, project: project.name, logo: project.logo },
    recipientLabel: partner.displayName,
    period: { label: period.label, startAt: period.startAt.toISOString(), endAt: period.endAt.toISOString(), timezone: project.timezone },
    sources: period.sourceIds.map((s) => sources.find((x) => x.id === s)?.name ?? '').filter(Boolean),
    lines,
    totals: { owedByCurrency: Object.fromEntries([...byCurrency].map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))])), zat: intent ? intent.amountZat.toString() : null },
    payment: { status, txState, txid: tx?.txid ?? null, confirmations: tx?.confirmations ?? 0, targetConfirmations: project.targetConfirmations, confirmedAt: txState === 'CONFIRMED' ? (tx?.minedAt?.toISOString() ?? null) : null, network: approval?.network ?? '', walletObserved: tx?.walletObservedAt != null, memoRef: intent?.memoRef ?? null },
    acknowledgment: ack ? { kind: ack.kind, at: ack.at.toISOString() } : null,
    issuerNote: `This statement is issued by ${project.issuerLabel}. Setrya is not independently validating the project's fee records.`,
  };
}


export async function activeShares(statementId: string) {
  return getDb().select().from(schema.statementShares).where(and(eq(schema.statementShares.statementId, statementId), isNull(schema.statementShares.revokedAt))).orderBy(desc(schema.statementShares.createdAt));
}
