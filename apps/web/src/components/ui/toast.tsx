'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './icons';

type ToastTone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const Ctx = createContext<(tone: ToastTone, message: string) => void>(() => undefined);

export function useToast() {
  return useContext(Ctx);
}

/** Success toasts dismiss after 5s; errors stay until closed so they can be read. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-3), { id, tone, message }]);
    if (tone !== 'danger') setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--layout-bottom-nav)+1rem)] z-[70] flex flex-col items-center gap-2 md:bottom-6 md:left-auto md:right-6 md:items-end">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-row border border-border bg-surface p-3.5 shadow-floating">
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'danger' ? 'alert' : 'info'} className={cx('mt-0.5 shrink-0', t.tone === 'success' ? 'text-success' : t.tone === 'danger' ? 'text-danger' : 'text-accent')} />
            <p className="flex-1 text-body-s">{t.message}</p>
            <button type="button" className="text-ink-muted hover:text-ink" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
