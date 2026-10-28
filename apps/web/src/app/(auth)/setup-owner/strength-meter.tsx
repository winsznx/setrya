'use client';

import { cx } from '@/components/ui/cx';

/** Mirrors the server rule in packages/security passwordStrength; the server decides. */
function score(v: string): { score: number; tip: string } {
  if (v.length === 0) return { score: 0, tip: 'At least 12 characters' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
  if (v.length < 12) return { score: 1, tip: `${12 - v.length} more character${12 - v.length === 1 ? '' : 's'}` };
  if (classes < 3 && v.length < 20) return { score: 2, tip: 'Mix letters, numbers and symbols, or make it longer' };
  return { score: v.length >= 20 ? 4 : 3, tip: v.length >= 20 ? 'Strong' : 'Good' };
}

export function StrengthMeter({ value }: { value: string }) {
  const s = score(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-pill', i <= s.score ? (s.score >= 3 ? 'bg-success' : 'bg-warning') : 'bg-surface-strong')} />
        ))}
      </div>
      <p className="mt-1 text-label text-ink-secondary">{s.tip}</p>
    </div>
  );
}
