import { describeTerms } from '@setrya/domain';
import { redirect } from 'next/navigation';

import { draftFromTerms } from '@/components/forms/agreement-form';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, isoDay } from '@/lib/format';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { AgreementClient } from '../../agreement-client';

export default async function ReviseAgreementPage({ params }: { params: Promise<{ projectId: string; agreementId: string }> }) {
  const { projectId, agreementId } = await params;
  const { project, agreement, partners, sources } = await loadView('agreements.edit', { projectId, agreementId }, `/app/p/${projectId}/agreements/${agreementId}/edit`);
  if (agreement.status === 'ended') redirect(projectPath(project.id, `/agreements/${agreement.id}`));
  const draft = agreement.versions.find((v) => v.status === 'draft');
  const base = draft ?? agreement.current;
  const active = [...agreement.versions].reverse().find((v) => v.status === 'active');
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: projectPath(project.id) }, { label: 'Agreements', href: projectPath(project.id, '/agreements') }, { label: agreement.title, href: projectPath(project.id, `/agreements/${agreement.id}`) }, { label: 'Revision' }]} title={agreement.status === 'draft' ? `Edit draft: ${agreement.title}` : `Revise ${agreement.title}`} />
      <AgreementClient
        mode="revision"
        agreementId={agreement.id}
        expectedVersion={agreement.version}
        projectId={project.id}
        projectCurrency={project.currency}
        partners={partners.map((x) => ({ id: x.id, name: x.displayName, active: x.active }))}
        sources={sources.map((s) => ({ id: s.id, name: s.name, currency: s.defaultCurrency }))}
        previous={active ? { version: Math.max(...agreement.versions.map((v) => v.version)), summary: describeTerms(active.terms), effectiveFrom: formatDate(active.effectiveFrom, project.timezone) } : undefined}
        initial={draftFromTerms({ partnerId: agreement.partnerId, sourceIds: agreement.sourceIds, title: agreement.title, externalRef: agreement.externalRef ?? '', effectiveFrom: draft ? isoDay(draft.effectiveFrom, project.timezone) : isoDay(new Date(), project.timezone), effectiveTo: base.effectiveTo ? isoDay(base.effectiveTo, project.timezone) : '' }, base.terms, project.currency)}
      />
    </>
  );
}
