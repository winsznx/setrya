import type { Metadata } from 'next';

import { StatementDoc } from '@/components/statement/statement-doc';
import { loadView } from '@/lib/api/views';

import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Statement', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The canonical print and PDF template: the same document object as the screen, without any app chrome. */
export default async function PrintStatementPage({ params }: { params: Promise<{ statementId: string }> }) {
  const { statementId } = await params;
  const { doc } = await loadView('print.statement', { statementId }, `/print/statements/${statementId}`);
  return (
    <div className="min-h-dvh bg-[#e9ebef] py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[52rem] items-center justify-between px-4">
        <span className="text-body-s text-[#545a66]">Choose “Save as PDF” in the print dialog. A4 and Letter both fit.</span>
        <PrintButton />
      </div>
      <StatementDoc doc={doc} page />
      <style>{`@page { size: auto; margin: 14mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px sans-serif; color: #687080; } }`}</style>
    </div>
  );
}
