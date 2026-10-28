import { BackLink, ErrorFrame } from '@/components/app/error-frame';

export default function Offline() {
  return (
    <ErrorFrame code="Offline" title="You’re offline" actions={<BackLink href="/app">Try again</BackLink>}>
      Pages you already opened may still be readable. Sending, status refresh and confirmation are disabled until the connection, wallet and node are back, and no new confirmed state will be shown in the meantime.
    </ErrorFrame>
  );
}
