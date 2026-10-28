import type { Metadata } from 'next';

import { sampleCalculation, SAMPLE_PARTNERS, SAMPLE_ROWS } from '@/components/marketing/sample';
import { sampleStatement } from '@/components/marketing/sample-statement';

import { DemoExplorer } from './demo-explorer';

export const metadata: Metadata = { title: 'Sample explorer', description: 'Explore a sample settlement period. Sample data only; no funds move.' };

export default function DemoPage() {
  const calc = sampleCalculation();
  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8">
      <p className="inline-flex items-center gap-2 rounded-pill bg-sample-soft px-3 py-1.5 text-label font-semibold tracking-[0.06em] text-sample">SAMPLE DATA — NO FUNDS WILL MOVE</p>
      <h1 className="mt-4 text-h1">Sample project: October creator fees</h1>
      <p className="mt-2 max-w-reading text-ink-secondary">One source, three partners, one exception, one statement. Every number below comes from Setrya&apos;s real calculation engine, run on sample rows. This page has no access to any wallet.</p>
      <DemoExplorer rows={SAMPLE_ROWS} partners={SAMPLE_PARTNERS} calc={JSON.parse(JSON.stringify(calc, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))} statement={sampleStatement()} />
    </div>
  );
}
