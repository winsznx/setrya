'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function PartnerFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(`${pathname}?${n}`);
  };
  const cls = 'min-h-control-sm rounded-control border border-border-control bg-surface px-2 text-body-s';
  return (
    <div className="flex flex-wrap gap-2">
      <input type="search" aria-label="Search partners" placeholder="Search" defaultValue={sp.get('q') ?? ''} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} className={`${cls} w-36`} />
      <select aria-label="Status" className={cls} value={sp.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}>
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select aria-label="Wallet readiness" className={cls} value={sp.get('wallet') ?? ''} onChange={(e) => set('wallet', e.target.value)}>
        <option value="">Any wallet state</option>
        <option value="ready">Verified format</option>
        <option value="missing">Not ready</option>
      </select>
      <select aria-label="Sort" className={cls} value={sp.get('sort') ?? ''} onChange={(e) => set('sort', e.target.value)}>
        <option value="">Sort by name</option>
        <option value="agreements">Sort by agreements</option>
      </select>
    </div>
  );
}
