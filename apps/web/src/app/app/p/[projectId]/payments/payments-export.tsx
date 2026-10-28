'use client';

import { useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { CheckboxField } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';

/** CSV export of payout rows. Addresses are masked unless the owner explicitly includes them. */
export function PaymentsExport({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState(false);
  const [txids, setTxids] = useState(true);
  return (
    <>
      <Button variant="secondary" icon="download" onClick={() => setOpen(true)}>Export CSV</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Export payouts" footer={<a className={buttonClasses({})} href={`/api/v1/projects/${projectId}/payments/export?addresses=${addresses ? 1 : 0}&txids=${txids ? 1 : 0}`} onClick={() => setOpen(false)}><Icon name="download" /> Download</a>}>
        <div className="space-y-3">
          <p className="text-body-s text-ink-secondary">The file contains private financial information about every partner. Keep it out of shared drives.</p>
          <CheckboxField checked={txids} onChange={(e) => setTxids(e.target.checked)} label="Include transaction IDs" />
          <CheckboxField checked={addresses} onChange={(e) => setAddresses(e.target.checked)} label="Include full payout addresses" hint="Off by default. Masked otherwise." />
        </div>
      </Dialog>
    </>
  );
}
