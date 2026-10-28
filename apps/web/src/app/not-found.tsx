import { BackLink, ErrorFrame } from '@/components/app/error-frame';

/** The same page answers for missing and for not-yours, so an ID's existence is never revealed. */
export default function NotFound() {
  return <ErrorFrame code="404" title="This page doesn’t exist" actions={<BackLink href="/app">Go to workspace</BackLink>}>It may have moved, or the link is incomplete.</ErrorFrame>;
}
