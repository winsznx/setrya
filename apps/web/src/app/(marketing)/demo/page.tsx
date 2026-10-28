import type { Metadata } from 'next';

import { CONTAINER } from '@/components/landing/primitives';
import { sampleCalculation, SAMPLE_PARTNERS, SAMPLE_ROWS } from '@/components/marketing/sample';
import { sampleStatement } from '@/components/marketing/sample-statement';

import { DemoExplorer } from './demo-explorer';

export const metadata: Metadata = { title: 'Sample explorer', description: 'Explore a sample settlement period. Sample data only; no funds move.' };

export default function DemoPage() {
  const calc = sampleCalculation();
  return (
    <div className={`${CONTAINER} pb-section pt-12 md:pt-16`}>
      <p className="inline-flex items-center gap-2 rounded-pill bg-sample-soft px-4 py-2 text-body-s font-medium text-sample"><span aria-hidden className="size-1.5 rounded-pill bg-sample" />Sample data. No funds will move.</p>
      <h1 className="mt-7 max-w-[48rem] text-balance text-display-l text-ink">Sample project: October creator fees</h1>
      <p className="mt-5 max-w-[40rem] text-pretty text-body-l text-ink-secondary">One source, three partners, one exception, one statement. Every number below comes from Setrya&apos;s real calculation engine, run on sample rows. This page has no access to any wallet.</p>
      <DemoExplorer rows={SAMPLE_ROWS} partners={SAMPLE_PARTNERS} calc={JSON.parse(JSON.stringify(calc, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))} statement={sampleStatement()} />
    </div>
  );
}
