import { getDb, schema, eq } from '@setrya/db';

import { route } from '../../../../../http/route';
import { listAgreements } from '../../../../../services/agreements';
import { listImports } from '../../../../../services/imports';
import { listPartners } from '../../../../../services/partners';
import { listPeriods } from '../../../../../services/periods';
import { projectPath, requireProjectApi } from '../../../../../services/projects';

export const GET = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return [];
  const has = (...values: (string | null | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q));
  const [partners, agreements, periods, imports] = await Promise.all([listPartners(ctx, project.id), listAgreements(ctx, project.id), listPeriods(ctx, project.id), listImports(ctx, project.id)]);
  const names = new Map(partners.map((p) => [p.id, p.displayName]));
  const hits = [
    ...partners.filter((p) => has(p.displayName, p.shortRef)).map((p) => ({ kind: 'Partner', label: p.displayName, detail: p.category, href: projectPath(project.id, `/partners/${p.id}`) })),
    ...agreements.filter((a) => has(a.title, names.get(a.partnerId))).map((a) => ({ kind: 'Agreement', label: a.title, detail: names.get(a.partnerId) ?? '', href: projectPath(project.id, `/agreements/${a.id}`) })),
    ...periods.filter((p) => has(p.label)).map((p) => ({ kind: 'Period', label: p.label, detail: p.status, href: projectPath(project.id, `/periods/${p.id}`) })),
    ...imports.filter((i) => has(i.filename, i.fileHash)).map((i) => ({ kind: 'Import', label: i.filename, detail: `${i.rowCount} rows`, href: projectPath(project.id, `/revenue/import/${i.id}`) })),
  ];
  const statements = await getDb().select({ id: schema.statements.id, reference: schema.statements.reference, partnerId: schema.statements.partnerId }).from(schema.statements).where(eq(schema.statements.projectId, project.id));
  hits.push(...statements.filter((s) => has(s.reference, names.get(s.partnerId))).map((s) => ({ kind: 'Statement', label: s.reference, detail: names.get(s.partnerId) ?? '', href: projectPath(project.id, `/statements/${s.id}`) })));
  const txs = await getDb()
    .select({ intentId: schema.payoutIntents.id, memo: schema.payoutIntents.memoRef, partnerId: schema.payoutIntents.partnerId, txid: schema.chainTransactions.txid })
    .from(schema.payoutIntents)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.payoutIntents.periodId))
    .leftJoin(schema.chainTransactions, eq(schema.chainTransactions.id, schema.payoutIntents.chainTransactionId))
    .where(eq(schema.periods.projectId, project.id));
  hits.push(...txs.filter((t) => has(t.memo, t.txid, names.get(t.partnerId))).map((t) => ({ kind: 'Payment', label: t.memo, detail: `${names.get(t.partnerId) ?? ''}${t.txid ? ` · ${t.txid.slice(0, 10)}…` : ''}`, href: projectPath(project.id, `/payments/${t.intentId}`) })));
  return hits.slice(0, 30);
});
