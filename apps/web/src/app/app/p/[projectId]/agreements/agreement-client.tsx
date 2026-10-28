'use client';

import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

import { AgreementForm } from '@/components/forms/agreement-form';

export function AgreementClient(props: Omit<ComponentProps<typeof AgreementForm>, 'onDone'>) {
  const router = useRouter();
  return <AgreementForm {...props} onDone={(id) => { router.push(`/app/p/${props.projectId}/agreements/${id}`); }} />;
}
