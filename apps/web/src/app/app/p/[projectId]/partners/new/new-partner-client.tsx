'use client';

import { useRouter } from 'next/navigation';

import { PartnerCreateForm } from '@/components/forms/partner-form';
import type { NetworkLabel } from '@/components/shell/status-pills';

export function NewPartnerClient({ projectId, network }: { projectId: string; network: NetworkLabel }) {
  const router = useRouter();
  return <PartnerCreateForm projectId={projectId} network={network} secondaryLabel="Save & add agreement" onSaved={(id, intent) => router.push(intent === 'secondary' ? `/app/p/${projectId}/agreements/new?partner=${id}` : `/app/p/${projectId}/partners/${id}`)} />;
}
