'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SourceForm, type SourceValues } from '@/components/forms/source-form';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

export function SourceEditor({ projectId, mode, initial, sourceId, expectedVersion }: { projectId: string; mode: 'create' | 'edit'; initial: SourceValues; sourceId?: string; expectedVersion?: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={mode === 'create' ? 'primary' : 'secondary'} size={mode === 'create' ? 'md' : 'sm'} icon={mode === 'create' ? 'plus' : undefined} onClick={() => setOpen(true)}>{mode === 'create' ? 'Add source' : 'Edit defaults'}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === 'create' ? 'Add source' : 'Edit source'} wide>
        {mode === 'edit' && <p className="mb-4 text-body-s text-ink-secondary">Changes apply to future imports only. Rows already imported keep their stored classification.</p>}
        <SourceForm
          initial={initial}
          endpoint={mode === 'create' ? `/api/v1/projects/${projectId}/sources` : `/api/v1/projects/${projectId}/sources/${sourceId}`}
          method={mode === 'create' ? 'POST' : 'PATCH'}
          expectedVersion={expectedVersion}
          submitLabel={mode === 'create' ? 'Save source' : 'Save changes'}
          onSaved={() => { toast('success', mode === 'create' ? 'Source added.' : 'Source updated.'); setOpen(false); router.refresh(); }}
        />
      </Dialog>
    </>
  );
}
