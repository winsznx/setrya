'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';

interface Result {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

type SearchState = { status: 'idle' } | { status: 'done'; query: string; results: Result[] } | { status: 'error'; query: string };

const DEBOUNCE_MS = 140;

function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.hash}`;
}

/** Searches every docs section as you type. "/" focuses it from anywhere on the page; arrows and Enter pick a result. */
export function DocsSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<AbortController>(undefined);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    const focusOnSlash = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key !== '/' || typing || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', focusOnSlash);
    return () => window.removeEventListener('keydown', focusOnSlash);
  }, []);

  const runSearch = (value: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    fetch(`/docs/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search failed with ${response.status}`);
        return response.json() as Promise<{ results: Result[] }>;
      })
      .then((body) => {
        setState({ status: 'done', query: value, results: body.results });
        setActive(0);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', query: value });
      });
  };

  const onChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      pending.current?.abort();
      setState({ status: 'idle' });
      return;
    }
    timer.current = setTimeout(() => runSearch(value.trim()), DEBOUNCE_MS);
  };

  const results = state.status === 'done' ? state.results : [];
  const showPanel = open && state.status !== 'idle';

  const go = (result: Result) => {
    setOpen(false);
    onNavigate?.();
    router.push(pathOf(result.url));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showPanel || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = results[active];
      if (chosen) go(chosen);
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="flex min-h-control-sm items-center gap-2 rounded-pill border border-border bg-surface px-3.5 text-ink-muted shadow-raised focus-within:border-border-strong">
        <span className="sr-only">Search the docs</span>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="Search the docs"
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent py-2 text-body-s text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd aria-hidden className="rounded-xs border border-border px-1.5 font-mono text-micro text-ink-muted">/</kbd>
      </label>
      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-module border border-border bg-surface p-1.5 shadow-floating">
          {state.status === 'error' ? (
            <p role="status" className="px-3 py-3 text-body-s text-ink-secondary">Search is not responding. Try again, or browse the sections.</p>
          ) : results.length === 0 ? (
            <p role="status" className="px-3 py-3 text-body-s text-ink-secondary">Nothing matches “{state.query}”. Try a different word, like statement, rate or fee.</p>
          ) : (
            <ul id={listId} role="listbox">
              {results.map((result, index) => (
                <li key={result.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                  <Link
                    prefetch={false}
                    href={pathOf(result.url)}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cx('block rounded-row px-3 py-2.5', index === active && 'bg-surface-muted')}
                  >
                    <strong className="block text-body-s font-semibold text-ink">{result.title}</strong>
                    <span className="mt-0.5 block text-label text-ink-secondary">{result.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
