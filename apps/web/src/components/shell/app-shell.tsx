'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';
import { ToastProvider } from '@/components/ui/toast';
import { api } from '@/lib/client/api';

import { CommandPalette } from './command-palette';
import { isActive, MOBILE_PRIMARY, NAV_GROUPS } from './nav';
import { NetworkBadge, type NetworkLabel, WalletPill, type WalletState } from './status-pills';

export interface ShellProps {
  projectId: string;
  projectName: string;
  projects: { id: string; name: string; archived: boolean }[];
  ownerName: string;
  network: NetworkLabel;
  wallet: { state: WalletState; label: string };
  openExceptions: number;
  autoLockMinutes: number;
  children: ReactNode;
}

function ProjectSwitcher({ projectId, projectName, projects, compact }: Pick<ShellProps, 'projectId' | 'projectName' | 'projects'> & { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={cx('flex w-full min-w-0 items-center gap-2 rounded-row text-left hover:bg-shell-raised', compact ? 'px-2 py-1.5' : 'bg-shell-raised px-3 py-2.5')}>
        <span className="grid size-7 shrink-0 place-items-center rounded-xs bg-brand text-label font-semibold text-on-brand">{projectName.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          {!compact && <span className="block text-micro text-ink-muted">Project</span>}
          <span className="block truncate text-body-s font-semibold">{projectName}</span>
        </span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
      </button>
      {open && (
        <div role="menu" className="animate-rise absolute left-0 right-0 z-50 mt-1 min-w-[14rem] rounded-row border border-border bg-surface p-1 shadow-floating">
          {projects.map((p) => (
            <Link prefetch={false} key={p.id} role="menuitem" href={`/app/p/${p.id}`} onClick={() => setOpen(false)} className={cx('flex items-center justify-between gap-2 rounded-xs px-3 py-2 text-body-s hover:bg-surface-muted', p.id === projectId && 'font-semibold')}>
              <span className="truncate">{p.name}</span>
              {p.archived ? <span className="text-micro text-ink-muted">Archived</span> : p.id === projectId ? <Icon name="check" size={14} /> : null}
            </Link>
          ))}
          <Link prefetch={false} role="menuitem" href={`/app/p/${projectId}/settings/project#add-project`} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 border-t border-border px-3 py-2 text-body-s text-ink-secondary hover:text-ink">
            <Icon name="plus" size={14} /> Add project
          </Link>
        </div>
      )}
    </div>
  );
}

/** Locks the vault after inactivity in this tab. The server enforces its own idle expiry independently. */
function useIdleLock(minutes: number) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const bump = () => (last = Date.now());
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(async () => {
      if (Date.now() - last > minutes * 60_000) {
        clearInterval(timer);
        await api('/api/v1/vault/lock', { method: 'POST' });
        router.replace(`/unlock?next=${encodeURIComponent(window.location.pathname)}`);
      }
    }, 15_000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [minutes, router]);
}

async function lockNow(router: ReturnType<typeof useRouter>) {
  await api('/api/v1/vault/lock', { method: 'POST' });
  router.replace(`/unlock?next=${encodeURIComponent(window.location.pathname)}`);
}

export function AppShell(props: ShellProps) {
  const { projectId, network, wallet, openExceptions, ownerName, children } = props;
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  useIdleLock(props.autoLockMinutes);
  useEffect(() => setMoreOpen(false), [pathname]);
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const mobilePrimary = allItems.filter((i) => MOBILE_PRIMARY.includes(i.label));
  const mobileMore = allItems.filter((i) => !MOBILE_PRIMARY.includes(i.label));

  return (
    <ToastProvider>
      <a href="#main-content" className="sr-only z-[80] rounded-pill bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-3">Skip to content</a>
      <div className="flex min-h-dvh flex-col md:flex-row md:bg-shell">
        <aside className="sticky top-0 hidden h-dvh w-rail shrink-0 flex-col px-3 pb-4 pt-5 md:flex" aria-label="Workspace navigation">
          <div className="px-2">
            <Wordmark href={`/app/p/${projectId}`} />
          </div>
          <div className="mt-5">
            <ProjectSwitcher {...props} />
          </div>
          <nav className="mt-5 flex-1 space-y-5 overflow-y-auto scrollbar-none" aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 pb-1.5 text-micro font-medium text-ink-muted">{group.label}</div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, projectId, item);
                    return (
                      <li key={item.label}>
                        <Link prefetch={false} href={item.href(projectId)} aria-current={active ? 'page' : undefined} className={cx('flex min-h-[2.5rem] items-center gap-3 rounded-row px-3 text-body-s transition-colors duration-fast', active ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-ink-secondary hover:bg-shell-raised hover:text-ink')}>
                          <Icon name={item.icon} className={active ? undefined : 'opacity-80'} />
                          <span className="flex-1">{item.label}</span>
                          {item.label === 'Periods' && openExceptions > 0 && <span className="rounded-pill bg-warning-soft px-1.5 text-micro font-semibold text-warning-text" aria-label={`${openExceptions} open exceptions`}>{openExceptions}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-4 space-y-3 border-t border-border px-2 pt-4">
            <div className="flex items-center justify-between gap-2">
              <NetworkBadge network={network} />
              <WalletPill state={wallet.state} label={wallet.label} href={`/app/p/${projectId}/wallet`} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-body-s text-ink-secondary">{ownerName}</span>
              <button type="button" onClick={() => lockNow(router)} className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-body-s font-medium text-ink-secondary hover:bg-shell-raised hover:text-ink">
                <Icon name="lock" size={15} /> Lock
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-canvas md:my-3 md:mr-3 md:rounded-workspace md:shadow-workspace">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-canvas/90 px-gutter backdrop-blur-md md:h-topbar md:rounded-t-workspace">
            <div className="min-w-0 flex-1 md:hidden">
              <ProjectSwitcher {...props} compact />
            </div>
            <div className="hidden flex-1 md:block">
              <CommandPalette projectId={projectId} />
            </div>
            <div className="md:hidden">
              <CommandPalette projectId={projectId} compact />
            </div>
            <Link prefetch={false} href={`/app/p/${projectId}/periods?filter=exceptions`} className="relative grid size-10 place-items-center rounded-pill text-ink-secondary hover:bg-surface-muted hover:text-ink" aria-label={openExceptions > 0 ? `${openExceptions} exceptions need review` : 'No open exceptions'}>
              <Icon name="alert" />
              {openExceptions > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-pill bg-warning px-1 text-center text-micro font-semibold text-white">{openExceptions}</span>}
            </Link>
            <div className="md:hidden">
              <NetworkBadge network={network} />
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-gutter pb-28 pt-6 focus:outline-none md:pb-14 md:pt-9">
            <div className="mx-auto max-w-content">{children}</div>
          </main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
          <ul className="grid h-bottom-nav grid-cols-5">
            {mobilePrimary.map((item) => {
              const active = isActive(pathname, projectId, item);
              return (
                <li key={item.label}>
                  <Link prefetch={false} href={item.href(projectId)} aria-current={active ? 'page' : undefined} className={cx('flex h-full flex-col items-center justify-center gap-0.5 text-micro', active ? 'font-semibold text-ink' : 'text-ink-muted')}>
                    <Icon name={item.icon} size={20} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-micro text-ink-muted">
                <Icon name="menu" size={20} />
                More
              </button>
            </li>
          </ul>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-scrim" onClick={() => setMoreOpen(false)} />
            <div className="animate-rise absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-workspace bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-h2">More</span>
                <button type="button" onClick={() => setMoreOpen(false)} className="grid size-10 place-items-center rounded-pill hover:bg-surface-muted" aria-label="Close">
                  <Icon name="x" />
                </button>
              </div>
              <ul className="mt-4 flex-1 divide-y divide-border overflow-y-auto">
                {mobileMore.map((item) => (
                  <li key={item.label}>
                    <Link prefetch={false} href={item.href(projectId)} className="flex min-h-[3.25rem] items-center gap-3 text-body">
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="space-y-3 border-t border-border pt-4">
                <WalletPill state={wallet.state} label={wallet.label} />
                <button type="button" onClick={() => lockNow(router)} className="flex w-full items-center justify-center gap-2 rounded-pill border border-border-strong py-3 text-body font-medium">
                  <Icon name="lock" /> Lock workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
