import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';

export type Step = { label: string; state: 'done' | 'current' | 'todo' | 'blocked'; detail?: string };

export function Lifecycle({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className={cx('absolute left-[0.6875rem] top-6 h-[calc(100%-1rem)] w-px', s.state === 'done' ? 'bg-success' : 'bg-border-strong')} />}
          <span className={cx('relative z-10 grid size-6 shrink-0 place-items-center rounded-pill', s.state === 'done' ? 'bg-success text-white' : s.state === 'current' ? 'bg-brand text-on-brand' : s.state === 'blocked' ? 'bg-danger-soft text-danger-text' : 'border border-border-strong bg-surface text-ink-muted')}>
            {s.state === 'done' ? <Icon name="check" size={13} strokeWidth={2.4} /> : s.state === 'blocked' ? <Icon name="alert" size={12} /> : <span className="size-1.5 rounded-pill bg-current" />}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className={cx('text-body-s', s.state === 'todo' ? 'text-ink-muted' : 'font-medium')}>{s.label}<span className="sr-only">: {s.state}</span></div>
            {s.detail && <div className="text-label text-ink-secondary">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
