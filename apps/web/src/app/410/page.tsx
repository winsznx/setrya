import { ErrorFrame } from '@/components/app/error-frame';

export default function Gone() {
  return <ErrorFrame code="410" title="This statement is no longer available" actions={null}>The link expired or was revoked by the issuer. Contact them privately if you need a new one.</ErrorFrame>;
}
