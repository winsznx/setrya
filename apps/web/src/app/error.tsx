'use client';

import { ErrorFrame } from '@/components/app/error-frame';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorFrame code="500" title="Something failed on the server" actions={<Button onClick={reset}>Retry</Button>}>
      Nothing you were doing was half-saved: every change is all-or-nothing. {error.digest ? <>Reference <code className="font-mono">{error.digest}</code>.</> : null}
    </ErrorFrame>
  );
}
