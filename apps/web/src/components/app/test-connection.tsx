'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';

/** Runs a fresh, read-only health query. It never changes wallet state. */
export function TestConnectionButton({ label = 'Test connection' }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      icon="refresh"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        await api('/api/v1/wallet/health?fresh=1');
        setBusy(false);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
