'use client';

import { formatZec } from '@setrya/domain';
import { useState } from 'react';

import { ShareError } from '@/components/recipient/share-error';
import { useShare } from '@/components/recipient/use-share';
import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/card';
import { CheckboxField, TextAreaField } from '@/components/ui/field';
import { sealWithKey } from '@/lib/client/share-crypto';

export function AcknowledgeClient({ shareId }: { shareId: string }) {
  const state = useShare(shareId);
  const [checked, setChecked] = useState(false);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const { busy, message, submit } = useSubmit();
  if (state.kind === 'loading') return <Skeleton className="mt-6 h-64 rounded-panel" />;
  if (state.kind !== 'open') return <ShareError state={state} />;
  const { doc } = state;
  const already = state.acknowledgedAt !== null;
  return (
    <section className="mx-auto mt-4 max-w-lg space-y-4 rounded-workspace bg-canvas p-5 shadow-workspace sm:p-6">
      <h1 className="text-h2">Acknowledge receipt</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-body-s">
        <dt className="text-ink-secondary">Statement</dt><dd className="font-mono">{doc.reference}</dd>
        <dt className="text-ink-secondary">Amount</dt><dd>{doc.totals.zat ? `${formatZec(BigInt(doc.totals.zat))} ZEC` : '—'}</dd>
        <dt className="text-ink-secondary">Issuer</dt><dd>{doc.issuer.label}</dd>
      </dl>
      <Callout tone="info">This is your own declaration that you checked the payment. Setrya records it as a self-attested receipt, separate from chain confirmation and from any wallet observation.</Callout>
      {done || already ? (
        <Callout tone="success" title="Acknowledgment sent">The issuer will see a self-attested receipt for this statement.</Callout>
      ) : (
        <>
          <CheckboxField checked={checked} onChange={(e) => setChecked(e.target.checked)} label="I confirm that I checked the payment in a wallet I control" />
          <TextAreaField label="Comment" optional value={comment} onChange={(e) => setComment(e.target.value.slice(0, 280))} hint="Short and non-sensitive. Encrypted with this link's key. Never include a seed phrase or viewing key." />
          {message && <Callout tone="danger">{message}</Callout>}
          <Button full size="lg" busy={busy} disabled={!checked} onClick={async () => {
            const encryptedMessage = comment.trim() ? await sealWithKey(state.key, comment.trim(), `setrya-ack-v1|${shareId}`) : null;
            const r = await submit(`/api/v1/public-shares/${encodeURIComponent(shareId)}/acknowledgments`, { body: { confirm: true, encryptedMessage } });
            if (r.ok) setDone(true);
          }}>Send acknowledgment</Button>
        </>
      )}
      <a href={`/r/${shareId}#k=${state.key}`} className="block text-center text-body-s text-accent-text hover:underline">Back to statement</a>
    </section>
  );
}
