import { BackLink, ErrorFrame } from '@/components/app/error-frame';

export default function Forbidden() {
  return <ErrorFrame code="403" title="You don’t have access to this workspace" actions={<BackLink href="/sign-in">Sign in</BackLink>}>This installation has one owner. Sign in with that account to continue.</ErrorFrame>;
}
