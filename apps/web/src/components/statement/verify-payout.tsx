'use client';

import type { StatementDocument } from '@setrya/api/contract';
import { parseCommitmentMemo, verifyPayoutProof } from '@setrya/domain';
import { useId, useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icons';

interface Check {
  label: string;
  pass: boolean;
  detail: string;
}

/** Every check runs in this browser on the decrypted statement. Nothing is sent anywhere. */
function checksFor(doc: StatementDocument, entry: NonNullable<StatementDocument['commitment']>['entries'][number], root: string): Check[] {
  const { leaf, proof, memo } = entry;
  const line = doc.lines.find((l) => l.zat === leaf.amountZat && l.owed === leaf.owed && l.currency === leaf.currency);
  const parsed = parseCommitmentMemo(memo);
  return [
    {
      label: 'Your line matches this statement',
      pass: leaf.partnerRef === doc.reference && line !== undefined,
      detail: line ? `${leaf.owed} ${leaf.currency} owed, ${leaf.amountZat} zatoshis paid, statement ${leaf.partnerRef}.` : 'The committed line does not match any line on this statement.',
    },
    {
      label: 'Your line is part of the approved payment',
      pass: verifyPayoutProof({ leaf, proof, root }),
      detail: 'The proof rebuilds the payment’s commitment from your line and hashes of the other lines. The hashes reveal nothing about them.',
    },
    {
      label: 'The payment memo carries the same commitment',
      pass: parsed !== null && parsed.root === root && parsed.memoRef === doc.payment.memoRef,
      detail: parsed ? `Memo reference ${parsed.memoRef}, commitment ${root.slice(0, 12)}…` : 'This payment memo has no commitment.',
    },
  ];
}

function CheckRow({ check }: { check: Check }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill', check.pass ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text')}>
        <Icon name={check.pass ? 'check' : 'x'} size={12} />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{check.label}<span className="sr-only">{check.pass ? ': passed' : ': failed'}</span></span>
        <span className="block text-body-s text-ink-secondary">{check.detail}</span>
      </span>
    </li>
  );
}

/** Just what the verifier needs: the statement reference, its payment reference and the commitment. No names. */
function downloadProof(doc: StatementDocument) {
  const file = { reference: doc.reference, memoRef: doc.payment.memoRef, txid: doc.payment.txid, commitment: doc.commitment };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `setrya-proof-${doc.reference}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function VerifyPayout({ doc }: { doc: StatementDocument }) {
  const [pasted, setPasted] = useState('');
  const inputId = useId();
  const commitment = doc.commitment;
  if (!commitment) return null;
  const entries = commitment.entries.map((entry) => ({ entry, checks: checksFor(doc, entry, commitment.root) }));
  const allPass = entries.every((e) => e.checks.every((c) => c.pass));
  const expected = commitment.entries.map((e) => e.memo);
  const pastedMatch = pasted.trim() === '' ? null : expected.includes(pasted.trim());

  return (
    <section aria-labelledby="verify-title" className="rounded-workspace bg-canvas p-4 shadow-workspace sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="verify-title" className="text-h2">Verify this payout</h2>
        <span className={cx('rounded-pill px-2.5 py-1 text-label font-medium', allPass ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text')}>{allPass ? 'All checks passed' : 'A check failed'}</span>
      </div>
      <p className="mt-2 text-body-s text-ink-secondary">
        These checks show your line is part of the exact approved snapshot that every partner in this payment was paid against. You learn nothing about the other partners, and nothing leaves this browser.
      </p>
      {entries.map(({ entry, checks }) => (
        <ul key={entry.leaf.payoutKey} className="mt-4 space-y-3">
          {checks.map((check) => <CheckRow key={check.label} check={check} />)}
        </ul>
      ))}
      <div className="mt-5 rounded-panel bg-surface-muted p-3">
        <p className="text-label font-medium text-ink">Your wallet should show this memo on the payment</p>
        {expected.map((memo) => (
          <div key={memo} className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[0.75rem] text-ink">{memo}</code>
            <CopyButton value={memo} label="Copy memo" />
          </div>
        ))}
        <label htmlFor={inputId} className="mt-3 block text-label text-ink-secondary">Paste the memo your wallet shows to compare</label>
        <textarea id={inputId} rows={2} value={pasted} onChange={(e) => setPasted(e.target.value)} className="mt-1 w-full rounded-control border border-border-control bg-surface px-3 py-2 font-mono text-[0.8125rem]" spellCheck={false} />
        {pastedMatch !== null && (
          <p role="status" className={cx('mt-2 text-body-s font-medium', pastedMatch ? 'text-success-text' : 'text-danger-text')}>
            {pastedMatch ? 'Your wallet’s memo matches. This payment carries the same commitment.' : 'This memo does not match. Check you copied the memo of this payment.'}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all text-label text-ink-muted">Payment commitment: <span className="font-mono">{commitment.root}</span></p>
        <button type="button" onClick={() => downloadProof(doc)} className="shrink-0 rounded-pill border border-border-strong px-3 py-1.5 text-label font-medium text-ink hover:bg-surface-muted">Download proof file</button>
      </div>
      <p className="mt-2 text-label text-ink-muted">Anyone can check the proof file with Setrya’s open-source verifier, without using this site.</p>
    </section>
  );
}
