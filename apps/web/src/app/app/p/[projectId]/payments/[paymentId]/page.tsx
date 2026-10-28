import { type TxState } from '@setrya/domain';
import Link from 'next/link';

import { PayoutStateBadge, TxStateBadge } from '@/components/app/status';
import { FormulaBreakdown } from '@/components/period/formula';
import { Money, Zec } from '@/components/ui/amount';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Card, DefinitionList, Panel } from '@/components/ui/card';
import { CopyButton, RevealValue } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { PaymentActions } from './payment-actions';

export default async function PaymentPage({ params }: { params: Promise<{ projectId: string; paymentId: string }> }) {
  const { projectId, paymentId } = await params;
  const { project, d, partner, agreement, formula } = await loadView('payments.detail', { projectId, paymentId }, `/app/p/${projectId}/payments/${paymentId}`);
  const tx = d.current;
  const p = (rest: string) => projectPath(project.id, rest);
  const tz = project.timezone;
  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Payments', href: p('/payments') }, { label: d.intent.memoRef }]}
        title={<span className="inline-flex flex-wrap items-baseline gap-3">{d.intent.memoRef}<Zec zat={d.intent.amountZat} className="text-h2" /></span>}
        meta={<PayoutStateBadge state={d.state} />}
        description={<>To <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/partners/${d.intent.partnerId}`)}>{partner?.displayName}</Link> for <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/periods/${d.period.id}`)}>{d.period.label}</Link></>}
        actions={d.statement ? <ButtonLink href={p(`/statements/${d.statement.id}`)} variant="secondary" icon="statements">View statement</ButtonLink> : undefined}
      />
      {d.approval.invalidatedAt && <Callout tone="warning" className="mb-5" title="Superseded">The approval behind this payout was invalidated: {d.approval.invalidationReason}. Nothing from it can be signed.</Callout>}
      {d.recipientsInBatch > 1 && <Callout tone="info" className="mb-5">This payout shares one transaction with {d.recipientsInBatch - 1} other payout(s). The public txid does not say which output belongs to whom.</Callout>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-h3">Financial snapshot</h2>
          <DefinitionList items={[
            { term: 'Agreement', detail: `${agreement?.title} v${agreement?.versions.find((v) => v.id === d.row.agreementVersionId)?.version}` },
            { term: 'Amount owed', detail: <Money value={d.row.owed} currency={d.row.currency} /> },
            { term: 'Approved amount', detail: <Zec zat={d.intent.amountZat} trim={false} /> },
            { term: 'Deductions', detail: 'None. Network fee is paid by the operator.' },
            { term: 'Payout address', detail: <RevealValue masked={d.address.masked} value={d.address.full} timeoutSeconds={project.revealTimeoutSeconds} /> },
            { term: 'Address version', detail: `v${d.address.version} · fingerprint ${d.address.fingerprint.slice(0, 12)}…` },
            { term: 'Approved', detail: formatDateTime(d.approval.approvedAt, tz) },
          ]} />
          <details className="mt-4"><summary className="cursor-pointer text-body-s font-medium">Calculation trail</summary><div className="mt-3"><FormulaBreakdown formula={formula} currency={d.row.currency} /></div></details>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-h3">Transaction</h2>{tx && <TxStateBadge state={tx.state as TxState} />}</div>
          {tx ? (
            <>
              <DefinitionList items={[
                { term: 'txid', detail: tx.txid ? <span className="inline-flex flex-wrap items-center gap-2"><code className="break-all font-mono text-[0.75rem]">{tx.txid}</code><CopyButton value={tx.txid} label="Copy txid" /></span> : 'Not extracted yet' },
                { term: 'Block', detail: tx.height !== null ? `${tx.height}${tx.blockhash ? ` · ${tx.blockhash.slice(0, 16)}…` : ''}` : '—' },
                { term: 'Confirmations', detail: `${tx.confirmations} of ${project.targetConfirmations} required` },
                { term: 'Fee (whole transaction)', detail: tx.feeZat ? <Zec zat={tx.feeZat} trim={false} /> : '—' },
                { term: 'Broadcast', detail: tx.broadcastAt ? formatDateTime(tx.broadcastAt, tz) : '—' },
                { term: 'Wallet observation', detail: tx.walletObservedAt ? `Sending wallet sees it since ${formatDateTime(tx.walletObservedAt, tz)}` : 'Not observed yet' },
                { term: 'Last checked', detail: tx.lastCheckedAt ? formatDateTime(tx.lastCheckedAt, tz) : '—' },
              ]} />
              <p className="mt-3 text-label text-ink-muted">Explorer cannot prove shielded recipient or amount. Recipient wallet observation is not available to Setrya; a recipient acknowledgment is a self-attestation.</p>
            </>
          ) : <p className="text-body-s text-ink-secondary">No transaction prepared yet. <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/periods/${d.period.id}/send`)}>Open the settle screen</Link>.</p>}
          <PaymentActions projectId={project.id} periodId={d.period.id} tx={tx ? { id: tx.id, state: tx.state as TxState, hasTxid: tx.txid !== null } : null} />
        </Card>
      </div>
      <Panel title="Recovery and attempts" className="mt-6">
        <div className="space-y-3 p-4 md:p-5">
          <DefinitionList items={[
            { term: 'Payout intent', detail: <code className="font-mono text-[0.75rem]">{d.intent.idempotencyKey}</code> },
            { term: 'Approval snapshot', detail: <code className="font-mono text-[0.75rem]">{d.approval.snapshotHash}</code> },
            ...d.txs.map((t) => ({ term: `Attempt lineage ${t.lineage}`, detail: <span>{t.state.toLowerCase().replaceAll('_', ' ')}{t.pcztHash ? ` · PCZT ${t.pcztHash.slice(0, 12)}…` : ''}{t.diagnosis ? ` · ${t.diagnosis}` : ''}{t.lastError ? ` · ${t.lastError}` : ''}</span> })),
          ]} />
          <ol className="space-y-1.5 border-t border-border pt-3 text-body-s">
            {d.attempts.map((a) => <li key={a.id} className="grid gap-x-3 sm:grid-cols-[11rem_9rem_1fr]"><time className="tnum text-ink-muted">{formatDateTime(a.createdAt, tz)}</time><span className="font-medium">{a.stage} · {a.outcome}</span><span className="text-ink-secondary">{a.detail}{a.errorCode ? ` (${a.errorCode})` : ''}</span></li>)}
            {d.attempts.length === 0 && <li className="text-ink-muted">No attempts recorded.</li>}
          </ol>
        </div>
      </Panel>
    </>
  );
}
