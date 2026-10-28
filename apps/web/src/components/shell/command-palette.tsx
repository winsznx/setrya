'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/client/api';

import { NAV_GROUPS } from './nav';

interface Hit {
  kind: string;
  label: string;
  detail: string;
  href: string;
}

/** Search runs on the server against this project's decrypted records; the query never leaves the session. */
export function CommandPalette({ projectId, compact }: { projectId: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const pages: Hit[] = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).map((i) => ({ kind: 'Page', label: i.label, detail: '', href: i.href(projectId) }));
    if (q.trim().length < 2) {
      setHits(pages);
      setActive(0);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<Hit[]>(`/api/v1/projects/${projectId}/search?q=${encodeURIComponent(q.trim())}`);
      setHits([...pages, ...(r.ok ? r.data : [])]);
      setActive(0);
    }, 180);
    return () => clearTimeout(t);
  }, [q, projectId]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ('');
    router.push(h.href);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx('flex items-center gap-2 text-body-s text-ink-muted hover:text-ink', compact ? 'grid size-10 place-items-center rounded-pill hover:bg-surface-muted' : 'h-10 w-full max-w-sm rounded-pill border border-border bg-surface-muted px-4')} aria-label="Search this project">
        <Icon name="search" size={16} />
        {!compact && (
          <>
            <span className="flex-1 text-left">Search partners, periods, payments…</span>
            <kbd className="rounded-xs border border-border bg-surface px-1.5 text-micro">⌘K</kbd>
          </>
        )}
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)} aria-label="Search" className="m-0 mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl rounded-workspace border border-border bg-surface p-0 text-ink shadow-floating backdrop:bg-scrim">
        {open && (
          <div>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Icon name="search" className="text-ink-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1));
                  if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
                  if (e.key === 'Enter' && hits[active]) go(hits[active]);
                }}
                placeholder="Search this project"
                aria-label="Search this project"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={hits[active] ? `hit-${active}` : undefined}
                className="h-14 flex-1 bg-transparent outline-none"
              />
            </div>
            <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
              {hits.length === 0 && <li className="px-3 py-6 text-center text-body-s text-ink-muted">No matches in this project.</li>}
              {hits.map((h, i) => (
                <li key={`${h.kind}-${h.href}-${i}`} id={`hit-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={cx('flex w-full items-center gap-3 rounded-row px-3 py-2.5 text-left', i === active && 'bg-surface-muted')}>
                    <span className="w-20 shrink-0 text-micro text-ink-muted">{h.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-s font-medium">{h.label}</span>
                      {h.detail && <span className="block truncate text-label text-ink-secondary">{h.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dialog>
    </>
  );
}
