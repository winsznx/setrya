'use client';

import { useState } from 'react';

import { DefinitionList } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';

interface Row { id: string; eventType: string; actor: string; objectType: string | null; objectId: string | null; at: string; reason: string | null; diff: string | null }

const ROUTE: Record<string, string> = { period: 'periods', partner: 'partners', agreement: 'agreements', import: 'revenue/import', statement: 'statements' };

export function ActivityList({ rows, projectId }: { rows: Row[]; projectId: string }) {
  const [open, setOpen] = useState<Row | null>(null);
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setOpen(r)} className="grid w-full gap-1 px-4 py-3 text-left hover:bg-surface-muted md:grid-cols-[13rem_minmax(0,1fr)_auto] md:px-5">
              <span className="text-body-s tnum text-ink-muted">{r.at}</span>
              <span className="min-w-0 text-body-s"><span className="font-medium">{r.eventType.replace(/[._]/g, ' ')}</span>{r.reason && <span className="block truncate text-ink-secondary">{r.reason}</span>}</span>
              <span className="text-label text-ink-muted">{r.actor}</span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-8 text-center text-body-s text-ink-muted">No events match.</li>}
      </ul>
      <Dialog open={open !== null} onClose={() => setOpen(null)} title="Event" wide>
        {open && (
          <div className="space-y-3">
            <DefinitionList items={[
              { term: 'Event', detail: open.eventType },
              { term: 'When', detail: open.at },
              { term: 'Actor', detail: open.actor },
              { term: 'Object', detail: open.objectType && open.objectId ? (ROUTE[open.objectType] ? <a className="text-accent-text hover:underline" href={`/app/p/${projectId}/${ROUTE[open.objectType]}/${open.objectId}`}>{open.objectType} {open.objectId.slice(0, 8)}…</a> : `${open.objectType} ${open.objectId.slice(0, 8)}…`) : '—' },
              { term: 'Reason', detail: open.reason ?? '—' },
            ]} />
            {open.diff && <pre className="max-h-80 overflow-auto rounded-row bg-surface-muted p-3 font-mono text-[0.75rem]">{open.diff}</pre>}
          </div>
        )}
      </Dialog>
    </>
  );
}
