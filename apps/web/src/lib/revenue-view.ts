import type { EntryView, PeriodView } from '@setrya/api/contract';
import { LOCKED_STATUSES } from '@setrya/domain';

import type { EntryRow } from '@/components/revenue/entries-table';
import { formatDateTime } from '@/lib/format';

export function toEntryRows(entries: EntryView[], sourceNames: Map<string, string>, periods: PeriodView[], timeZone: string): EntryRow[] {
  const locked = new Set(periods.filter((p) => LOCKED_STATUSES.includes(p.status)).map((p) => p.id));
  return entries.map((e) => ({
    id: e.id,
    batchId: e.batchId,
    sourceName: sourceNames.get(e.sourceId) ?? 'Unknown source',
    externalId: e.externalId,
    description: e.description,
    reference: e.reference,
    amount: e.amount,
    amountRaw: e.amountRaw,
    currency: e.currency,
    occurredAt: e.occurredAt.toISOString().replace('T', ' ').slice(0, 19),
    occurredLabel: formatDateTime(e.occurredAt, timeZone),
    type: e.type,
    classification: e.classification,
    issues: e.issues as EntryRow['issues'],
    note: e.note,
    raw: e.raw,
    rowHash: e.rowHash,
    rowIndex: e.rowIndex,
    origin: e.origin,
    periodIds: e.periodIds,
    locked: e.periodIds.some((id) => locked.has(id)),
  }));
}
