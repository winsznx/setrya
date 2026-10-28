'use client';

import { useState } from 'react';

import { ShareError } from '@/components/recipient/share-error';
import { useShare } from '@/components/recipient/use-share';
import { StatementDoc } from '@/components/statement/statement-doc';
import { VerifyPayout } from '@/components/statement/verify-payout';
import { Button, buttonClasses } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';

/** `apiBase` and `allowAcknowledge` let the public testnet sandbox show its statements with the same page. */
export function RecipientStatement({ shareId, apiBase, allowAcknowledge = true }: { shareId: string; apiBase?: string; allowAcknowledge?: boolean }) {
  const state = useShare(shareId, apiBase);
  const [help, setHelp] = useState(false);
  if (state.kind === 'loading') return <div role="status" aria-live="polite" className="mt-6 space-y-3"><span className="sr-only">Decrypting statement</span><Skeleton className="h-8 w-60" /><Skeleton className="h-[28rem] rounded-panel" /></div>;
  if (state.kind !== 'open') return <ShareError state={state} />;
  const { doc } = state;
  return (
    <div className="mt-2 space-y-4">
      <section className="rounded-workspace bg-canvas p-4 shadow-workspace sm:p-5">
        <h1 className="text-h2">A private statement was shared with you</h1>
        <p className="mt-1 text-body-s text-ink-secondary">Decrypted in this browser. Issued by {doc.issuer.label}. Link expires {new Date(state.expiresAt).toLocaleDateString()}.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon="download" onClick={() => window.print()}>Download PDF</Button>
          {doc.payment.memoRef && <CopyButton value={doc.payment.memoRef} label="Copy payment reference" />}
          {!allowAcknowledge ? null : state.acknowledgedAt ? <span className="inline-flex items-center gap-1.5 text-body-s text-ink-secondary"><Icon name="check" size={15} /> Receipt acknowledged</span> : doc.totals.zat && <a className={buttonClasses({ size: 'sm' })} href={`/r/${shareId}/acknowledge#k=${state.key}`}>Acknowledge receipt</a>}
          <Button variant="ghost" size="sm" onClick={() => setHelp(true)}>How to verify with your wallet</Button>
        </div>
      </section>
      {doc.payment.status !== 'confirmed' && doc.totals.zat && <Callout tone="warning">The issuer has not yet observed this payment confirmed on chain. Check the status again later.</Callout>}
      <VerifyPayout doc={doc} />
      <StatementDoc doc={doc} />
      <Dialog open={help} onClose={() => setHelp(false)} title="Checking the payment yourself">
        <ol className="list-decimal space-y-2 pl-5 text-body-s text-ink-secondary">
          <li>Open a Zcash wallet that controls the address you gave the issuer.</li>
          <li>Look for an incoming shielded transaction{doc.payment.txid ? <> with ID <code className="break-all font-mono text-[0.75rem]">{doc.payment.txid}</code></> : ''}{doc.payment.memoRef ? <> and a memo that starts <code className="font-mono">setrya:v1 ref={doc.payment.memoRef}</code></> : ''}.</li>
          <li>Compare the amount with this statement. A public block explorer cannot show it, because the transfer is shielded.</li>
        </ol>
        <p className="mt-3 text-body-s text-ink-secondary">Never share your seed phrase or viewing key to prove a payment. The issuer will not ask for it.</p>
      </Dialog>
    </div>
  );
}
