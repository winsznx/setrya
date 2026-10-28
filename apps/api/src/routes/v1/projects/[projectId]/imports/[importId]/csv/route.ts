import { toCsv } from '@setrya/domain';

import { ApiError, route } from '../../../../../../../http/route';
import { audit } from '../../../../../../../services/audit';
import { getImport } from '../../../../../../../services/imports';
import { requireProjectApi } from '../../../../../../../services/projects';
import { listEntries } from '../../../../../../../services/revenue';

/** Normalised rows as Setrya stored them. Formula-looking cells are neutralised; numbers are unchanged. */
export const GET = route('unlocked', async (_req, ctx, { projectId, importId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const batch = await getImport(ctx, project.id, importId!);
  if (!batch) throw new ApiError('NOT_FOUND', 'Not found.');
  const entries = await listEntries(ctx, project.id, { batchId: batch.id, includeVoided: true });
  const csv = toCsv(
    ['row', 'external_id', 'occurred_at_utc', 'amount', 'currency', 'type', 'classification', 'issues', 'note', 'description', 'row_hash'],
    entries.sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0)).map((e) => [(e.rowIndex ?? 0) + 1, e.externalId, e.occurredAt.toISOString(), e.amount, e.currency, e.type, e.classification, e.issues.join(' '), e.note, e.description, e.rowHash]),
    new Set([0, 3]),
  );
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: 'export.import_csv', objectType: 'import', objectId: batch.id });
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="setrya-import-${batch.id.slice(0, 8)}.csv"`, 'cache-control': 'no-store' } });
});
