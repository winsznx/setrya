import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/app-shell';
import { loadView } from '@/lib/api/views';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, projects, ownerName, network, wallet, exceptions, lockMinutes } = await loadView('shell.project', { projectId }, `/app/p/${projectId}`);
  return (
    <AppShell
      projectId={project.id}
      projectName={project.name}
      projects={projects}
      ownerName={ownerName}
      network={network}
      wallet={wallet}
      openExceptions={exceptions}
      autoLockMinutes={lockMinutes}
    >
      {children}
    </AppShell>
  );
}
