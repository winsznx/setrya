'use client';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { download } from '@/lib/client/archive-crypto';

/** Health snapshot only. Contains no addresses, amounts, partner data or credentials. */
export function DiagnosticsButton() {
  return (
    <Button variant="ghost" icon="download" onClick={async () => {
      const r = await api<Record<string, unknown>>('/api/v1/wallet/health?fresh=1');
      const body = r.ok ? { ...r.data, account: { found: (r.data.account as { found: boolean }).found }, connectionName: '[redacted]' } : { error: r.error };
      download(new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), health: body }, null, 2)], { type: 'application/json' }), 'setrya-diagnostics.json');
    }}>Download diagnostics</Button>
  );
}
