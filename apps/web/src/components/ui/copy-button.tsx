'use client';

import { useState } from 'react';

import { cx } from './cx';
import { Icon } from './icons';

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className={cx('inline-flex min-h-control-sm items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3 text-body-s font-medium text-ink hover:bg-surface-muted', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('copied');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 2000);
      }}
    >
      <Icon name={state === 'copied' ? 'check' : 'copy'} size={15} />
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
}

/** Masked by default; the full value appears only after a deliberate click and hides again after `timeoutSeconds`. */
export function RevealValue({ masked, value, timeoutSeconds = 30, mono = true }: { masked: string; value: string; timeoutSeconds?: number; mono?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <span className={cx('min-w-0 break-all', mono && 'font-mono text-[0.8125rem]')}>{shown ? value : masked}</span>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-body-s font-medium text-accent-text hover:underline"
        onClick={() => {
          setShown((s) => !s);
          if (!shown) setTimeout(() => setShown(false), timeoutSeconds * 1000);
        }}
        aria-pressed={shown}
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} size={14} />
        {shown ? 'Hide' : 'Reveal'}
      </button>
      {shown && <CopyButton value={value} />}
    </span>
  );
}
