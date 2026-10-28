import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from './icons';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-body-s text-ink-muted">
        {items.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {c.href ? (
              <Link prefetch={false} href={c.href} className="truncate hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-ink-secondary">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ crumbs, title, description, actions, meta }: { crumbs?: Crumb[]; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="mb-6 md:mb-8">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1.5 max-w-reading text-body text-ink-secondary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-h2">{children}</h2>
      {action}
    </div>
  );
}
