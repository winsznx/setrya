'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Non-sensitive filters only live in the URL: classification, source id, currency. Search text stays in the field. */
export function RevenueFilters({ sources, currencies }: { sources: { id: string; name: string }[]; currencies: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const cls = 'min-h-control-sm rounded-control border border-border-control bg-surface px-2 text-body-s';
  return (
    <div className="flex flex-wrap gap-2">
      <input type="search" placeholder="Search reference" aria-label="Search by reference or description" defaultValue={sp.get('q') ?? ''} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} className={`${cls} w-40`} />
      <select aria-label="Classification" className={cls} value={sp.get('classification') ?? ''} onChange={(e) => set('classification', e.target.value)}>
        <option value="">Any classification</option>
        <option value="eligible">Eligible</option>
        <option value="excluded">Excluded</option>
        <option value="held">Unresolved</option>
      </select>
      <select aria-label="Source" className={cls} value={sp.get('source') ?? ''} onChange={(e) => set('source', e.target.value)}>
        <option value="">All sources</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select aria-label="Currency" className={cls} value={sp.get('currency') ?? ''} onChange={(e) => set('currency', e.target.value)}>
        <option value="">All currencies</option>
        {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
