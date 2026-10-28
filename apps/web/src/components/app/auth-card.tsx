import type { ReactNode } from 'react';

import { Mark } from '@/components/brand/wordmark';
import { cx } from '@/components/ui/cx';

/**
 * The card every gate screen uses. With an aside, the form sits beside the brand stage, which carries the short
 * explanation of what this step protects on a glass panel.
 */
export function AuthCard({ title, description, children, aside, wide }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode; wide?: boolean }) {
  return (
    <div className={cx('grid w-full gap-3', aside ? 'max-w-[64rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : wide ? 'max-w-2xl' : 'max-w-md')}>
      <section className="animate-rise rounded-workspace bg-canvas p-6 shadow-workspace md:p-10">
        <h1 className="text-display-l text-[clamp(1.75rem,1.4rem+1.2vw,2.25rem)]">{title}</h1>
        {description && <div className="mt-3 text-body-l text-ink-secondary">{description}</div>}
        <div className="mt-8">{children}</div>
      </section>
      {aside && (
        <aside className="flex flex-col justify-end rounded-workspace bg-stage p-3 sm:p-5 md:p-8">
          <div className="space-y-3 rounded-[20px] border border-glass-light-edge bg-glass-light p-5 text-body-s text-ink-secondary shadow-floating backdrop-blur-md md:p-6">
            <span className="grid size-10 place-items-center rounded-pill bg-surface text-ink shadow-raised"><Mark size={18} /></span>
            {aside}
          </div>
        </aside>
      )}
    </div>
  );
}
