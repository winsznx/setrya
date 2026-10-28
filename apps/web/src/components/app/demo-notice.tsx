import { Icon } from '@/components/ui/icons';

export const DEMO_BANNER = 'Shared demo workspace on Zcash testnet. Anyone with the demo login can see it. Password, passphrase and backup changes are turned off.';

/** The calm strip every workspace page shows while the installation runs in demo mode. */
export function DemoBanner() {
  return (
    <p role="note" className="mb-6 flex items-start gap-2.5 rounded-module bg-sample-soft px-4 py-3 text-body-s text-sample md:mb-8">
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      <span>{DEMO_BANNER}</span>
    </p>
  );
}

/** Stands in for a control the demo workspace turns off, so it reads as unavailable rather than broken. */
export function DemoLocked({ title, reason }: { title: string; reason: string }) {
  return (
    <section aria-disabled="true" className="min-w-0 rounded-module border border-border bg-surface-muted p-card md:p-6">
      <h2 className="flex items-center gap-2 text-h3 text-ink-secondary"><Icon name="lock" size={16} />{title}</h2>
      <p className="mt-1.5 text-body-s text-ink-muted">{reason}</p>
    </section>
  );
}
