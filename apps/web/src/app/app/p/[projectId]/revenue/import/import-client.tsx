'use client';

import { useRouter } from 'next/navigation';

import { ImportWizard } from '@/components/forms/import-wizard';

export function ImportClient(props: { projectId: string; sources: { id: string; name: string; currency: string; timezone: string }[]; defaultSourceId?: string }) {
  const router = useRouter();
  return <ImportWizard {...props} onCommitted={(id) => router.push(`/app/p/${props.projectId}/revenue/import/${id}`)} />;
}
