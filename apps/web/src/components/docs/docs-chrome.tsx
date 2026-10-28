'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { CONTAINER } from '@/components/landing/primitives';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';
import { DOC_SECTIONS, docPath } from '@/lib/docs/manifest';

import { DocsSearch } from './docs-search';

function NavSections({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      {DOC_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-label font-semibold text-ink">{section.title}</p>
          <ul className="space-y-0.5">
            {section.pages.map((page) => {
              const href = docPath(page.slug);
              const current = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    prefetch={false}
                    href={href}
                    onClick={onNavigate}
                    aria-current={current ? 'page' : undefined}
                    className={cx('block rounded-row px-3 py-1.5 text-body-s transition-colors duration-fast', current ? 'bg-accent-soft font-medium text-accent-text' : 'text-ink-secondary hover:bg-surface-muted hover:text-ink')}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The docs frame inside the site header and footer: search and the section list on the left from 1024 px, a
 * disclosure menu above the article on smaller screens. The menu belongs to the page it was opened on.
 */
export function DocsChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <div className={cx(CONTAINER, 'grid gap-8 pb-section pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:pt-12')}>
      <nav aria-label="Docs" className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-6 overflow-y-auto pb-6 scrollbar-none">
          <DocsSearch />
          <NavSections pathname={pathname} />
        </div>
      </nav>
      <div className="space-y-3 lg:hidden">
        <DocsSearch onNavigate={() => setOpenOn(null)} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="docs-menu"
          onClick={() => setOpenOn(open ? null : pathname)}
          className="flex w-full items-center justify-between rounded-row border border-border bg-surface px-4 py-2.5 text-body-s font-medium text-ink"
        >
          <span className="flex items-center gap-2"><Icon name="menu" size={16} />All docs</span>
          <Icon name="chevronDown" size={16} className={cx('transition-transform duration-fast', open && 'rotate-180')} />
        </button>
        {open && (
          <div id="docs-menu" className="rounded-module border border-border bg-surface p-3 shadow-raised">
            <NavSections pathname={pathname} onNavigate={() => setOpenOn(null)} />
          </div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
