'use client';

import { useState } from 'react';

import { Icon } from '@/components/ui/icons';

const RESET_MS = 2000;

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => setCopied('copied'))
      .catch(() => setCopied('failed'))
      .finally(() => setTimeout(() => setCopied('idle'), RESET_MS));
  };

  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-body-s font-medium text-ink-secondary transition-colors duration-fast hover:border-border-strong hover:text-ink">
      <Icon name={copied === 'copied' ? 'check' : 'copy'} size={14} />
      <span aria-live="polite">{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select and copy' : label}</span>
    </button>
  );
}
