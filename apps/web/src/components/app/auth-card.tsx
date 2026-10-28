import type { ReactNode } from 'react';

export function AuthCard({ title, description, children, aside, wide }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode; wide?: boolean }) {
  return (
    <div className={`grid w-full gap-6 ${aside ? 'max-w-4xl md:grid-cols-[1fr_17rem]' : wide ? 'max-w-2xl' : 'max-w-md'}`}>
      <section className="animate-rise rounded-workspace bg-canvas p-6 shadow-workspace md:p-8">
        <h1 className="text-h1">{title}</h1>
        {description && <div className="mt-2 text-body text-ink-secondary">{description}</div>}
        <div className="mt-6">{children}</div>
      </section>
      {aside && <aside className="space-y-3 text-body-s text-ink-secondary md:pt-8">{aside}</aside>}
    </div>
  );
}
