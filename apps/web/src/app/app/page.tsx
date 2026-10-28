import { redirect } from 'next/navigation';

import { loadView } from '@/lib/api/views';

export default async function AppIndex() {
  const { projectId } = await loadView('shell.home', {}, '/app');
  if (!projectId) redirect('/onboarding');
  redirect(`/app/p/${projectId}`);
}
