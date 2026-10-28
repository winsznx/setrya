'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './icons';

/** Native <dialog>: focus trap, Escape and focus return come from the platform. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className={cx('m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-hidden rounded-workspace border border-border bg-surface p-0 text-ink shadow-floating backdrop:bg-scrim', wide ? 'max-w-2xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="dialog-title" className="text-h2">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-pill text-ink-secondary hover:bg-surface-muted" aria-label="Close">
              <Icon name="x" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
