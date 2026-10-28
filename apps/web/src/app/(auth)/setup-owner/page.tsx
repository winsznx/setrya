import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AuthCard } from '@/components/app/auth-card';
import { loadView } from '@/lib/api/views';

import { SetupOwnerForm } from './setup-owner-form';

export const metadata: Metadata = { title: 'Set up your private workspace', robots: { index: false } };

export default async function SetupOwnerPage() {
  if ((await loadView('auth.status')).ownerExists) notFound();
  return (
    <AuthCard
      wide
      title="Set up your private workspace"
      description="This runs once per installation. It creates the single owner account and the encrypted vault that protects partner and revenue records."
    >
      <SetupOwnerForm defaultTimezone={process.env.TZ ?? 'UTC'} />
    </AuthCard>
  );
}
