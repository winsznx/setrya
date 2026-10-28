'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '@/components/ui/icons';

export function MobileMenu({ items }: { items: (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" className="grid size-10 place-items-center rounded-pill hover:bg-surface-muted" aria-label="Menu">
        <Icon name={open ? 'x' : 'menu'} />
      </button>
      {open && (
        <nav id="site-menu" aria-label="Site" className="absolute inset-x-0 top-16 border-b border-border bg-canvas px-4 pb-4 shadow-floating">
          <ul className="divide-y divide-border">
            {items.map(([href, label]) => <li key={href}><Link href={href} onClick={() => setOpen(false)} className="block py-3 text-body">{label}</Link></li>)}
          </ul>
        </nav>
      )}
    </>
  );
}
