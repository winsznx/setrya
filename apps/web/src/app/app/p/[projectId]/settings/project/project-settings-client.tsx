'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DemoLocked } from '@/components/app/demo-notice';
import { ProjectForm, type ProjectFormValues } from '@/components/forms/project-form';
import { useSubmit } from '@/components/forms/use-submit';
import { Button } from '@/components/ui/button';
import { Callout, Card } from '@/components/ui/card';
import { CheckboxField, TextAreaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function ProjectSettingsClient({ project, initial, demoMode }: { project: { id: string; version: number; archived: boolean; timezone: string }; initial: ProjectFormValues; demoMode: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const archive = useSubmit();
  return (
    <div className="space-y-10">
      <ProjectForm initial={initial} endpoint={`/api/v1/projects/${project.id}`} method="PATCH" extra={{ section: 'project', expectedVersion: project.version }} submitLabel="Save" onSaved={() => { toast('success', 'Project saved. Existing statements keep the header they were issued with.'); router.refresh(); }} />
      <section id="add-project" className="space-y-3 border-t border-border pt-8">
        <h2 className="text-h2">Add project</h2>
        <p className="max-w-reading text-body-s text-ink-secondary">A separate brand or revenue stream with its own sources, partners and periods. Payments come from the payer account configured on this host; to keep accounts separated, run a separate installation.</p>
        {adding ? (
          <ProjectForm initial={{ ...initial, name: '', description: '', logo: null, cadence: undefined }} endpoint="/api/v1/projects" method="POST" submitLabel="Create project" onSaved={(id) => router.push(`/app/p/${id}`)} />
        ) : <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>Add project</Button>}
      </section>
      {demoMode ? (
        <DemoLocked title="Archive project" reason="Turned off in the shared demo workspace, so the project stays open for everyone." />
      ) : (
        <Card className="space-y-3">
          <h2 className="text-h3">{project.archived ? 'Restore project' : 'Archive project'}</h2>
          <p className="text-body-s text-ink-secondary">{project.archived ? 'Restoring allows new periods again.' : 'Archiving blocks new periods, imports and payments while keeping every record and export readable. Nothing is deleted. Paid records are retained.'}</p>
          {archive.message && <Callout tone="danger">{archive.message}</Callout>}
          <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          {!project.archived && <CheckboxField checked={ack} onChange={(e) => setAck(e.target.checked)} label="I have exported what I need from this project" />}
          <Button variant={project.archived ? 'secondary' : 'danger'} busy={archive.busy} disabled={reason.trim().length < 3 || (!project.archived && !ack)} onClick={async () => { const r = await archive.submit(`/api/v1/projects/${project.id}`, { method: 'PATCH', body: { section: 'archive', archived: !project.archived, reason, expectedVersion: project.version } }); if (r.ok) router.refresh(); }}>{project.archived ? 'Restore project' : 'Archive project'}</Button>
        </Card>
      )}
    </div>
  );
}
