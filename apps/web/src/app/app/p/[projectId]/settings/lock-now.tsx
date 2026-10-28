'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';

export function LockNowButton() {
  const router = useRouter();
  return <Button variant="secondary" icon="lock" onClick={async () => { await api('/api/v1/vault/lock', { method: 'POST' }); router.replace('/unlock'); }}>Lock workspace</Button>;
}
