'use client';

import { useEffect, useState } from 'react';

import { cx } from '@/components/ui/cx';
import type { DocHeading } from '@/lib/docs/markdown';

/** Distance below the sticky header where a heading counts as the one being read. */
const READING_LINE = 120;

export function DocToc({ headings }: { headings: readonly DocHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? '');

  useEffect(() => {
    const elements = headings.map((heading) => document.getElementById(heading.id)).filter((element): element is HTMLElement => element !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = elements.filter((element) => element.getBoundingClientRect().top <= READING_LINE);
      const current = atBottom ? elements[elements.length - 1] : passed[passed.length - 1];
      setActive(current?.id ?? elements[0]?.id ?? '');
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  return (
    <aside aria-label="On this page" className="hidden xl:block">
      <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto scrollbar-none">
        <p className="text-label font-semibold text-ink">On this page</p>
        <ul className="mt-3 space-y-2 border-l border-border">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={heading.id === active ? 'true' : undefined}
                className={cx(
                  '-ml-px block border-l py-0.5 text-body-s transition-colors duration-fast',
                  heading.depth === 3 ? 'pl-6' : 'pl-3',
                  heading.id === active ? 'border-accent text-accent-text' : 'border-transparent text-ink-secondary hover:text-ink',
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
