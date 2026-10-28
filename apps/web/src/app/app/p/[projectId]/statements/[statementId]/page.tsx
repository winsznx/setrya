import { WATERMARK } from '@setrya/domain';
import Link from 'next/link';

import { StatementDoc } from '@/components/statement/statement-doc';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Callout } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { SharePanel } from './share-panel';

export default async function StatementPage({ params }: { params: Promise<{ projectId: string; statementId: string }> }) {
  const { projectId, statementId } = await params;
  const { project, doc, shares, acks } = await loadView('statements.detail', { projectId, statementId }, `/app/p/${projectId}/statements/${statementId}`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader
        crumbs={[{ label: project.name, href: p('') }, { label: 'Statements', href: p('/statements') }, { label: doc.reference }]}
        title={`${doc.reference} · ${doc.recipientLabel}`}
        meta={<><Badge tone={doc.payment.status === 'confirmed' ? 'success' : doc.payment.status === 'failed' ? 'danger' : 'warning'} icon={doc.payment.status === 'confirmed' ? 'check' : undefined}>{WATERMARK[doc.payment.status]}</Badge>{doc.acknowledgment && <Badge tone="neutral" icon="check">Self-attested receipt</Badge>}</>}
        actions={
          <>
            <a href={`/print/statements/${doc.id}`} target="_blank" rel="noopener" className={buttonClasses({ variant: 'secondary' })}><Icon name="print" /> Print / PDF</a>
            <a href={`/api/v1/projects/${project.id}/statements/${doc.id}/csv`} className={buttonClasses({ variant: 'secondary' })}><Icon name="download" /> Download CSV</a>
          </>
        }
      />
      {doc.payment.status === 'confirmed' && <Callout tone="info" className="mb-5">Confirmed on chain means the node observed the transaction at {doc.payment.targetConfirmations}+ confirmations. It is not a claim that the recipient independently verified the funds.</Callout>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 rounded-workspace bg-surface-strong p-3 sm:p-6"><StatementDoc doc={doc} /></div>
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SharePanel
            projectId={project.id}
            doc={doc}
            defaultExpiryDays={project.shareExpiryDays}
            shares={shares.map((s) => ({ shareId: s.shareId, expiresAt: s.expiresAt.toISOString(), revokedAt: s.revokedAt?.toISOString() ?? null, accessCount: s.accessCount, documentVersion: s.documentVersion, acknowledged: acks.some((a) => a.statementShareId === s.id) }))}
          />
          <p className="text-body-s text-ink-secondary">Payment detail: {doc.payment.memoRef ? <Link prefetch={false} className="text-accent-text hover:underline" href={p(`/payments?q=${doc.payment.memoRef}`)}>{doc.payment.memoRef}</Link> : 'none, this partner was held'}</p>
        </aside>
      </div>
    </>
  );
}
