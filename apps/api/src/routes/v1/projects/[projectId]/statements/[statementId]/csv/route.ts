import { getDb, schema, eq } from '@setrya/db';
import { toCsv } from '@setrya/domain';

import { ApiError, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { requireProjectApi } from '../../../../../../../services/projects';
import { buildStatement } from '../../../../../../../services/statements';

/** Same canonical document as the screen and print view, one row per agreement line. */
export const GET = route('unlocked', async (_req, ctx, { projectId, statementId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const doc = await buildStatement(ctx, project, statementId!);
  if (!doc) throw new ApiError('NOT_FOUND', 'Not found.');
  const csv = toCsv(
    ['statement', 'version', 'recipient', 'period', 'period_start_utc', 'period_end_utc', 'agreement', 'agreement_version', 'rule', 'currency', 'eligible_base', 'owed', 'rate', 'zat', 'payment_status', 'txid', 'confirmations'],
    doc.lines.map((l) => [doc.reference, doc.documentVersion, doc.recipientLabel, doc.period.label, doc.period.startAt, doc.period.endAt, l.agreementTitle, l.agreementVersion, l.rule, l.currency, l.eligibleBase, l.owed, l.rateDescription, l.zat, doc.payment.status, doc.payment.txid, doc.payment.confirmations]),
    new Set([1, 7, 10, 11, 13, 16]),
  );
  await getDb().update(schema.statements).set({ downloadedAt: new Date() }).where(eq(schema.statements.id, doc.id));
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.statement_csv', objectType: 'statement', objectId: doc.id });
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${doc.reference}.csv"`, 'cache-control': 'no-store' } });
});
