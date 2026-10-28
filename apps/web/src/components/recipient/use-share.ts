'use client';

import { useEffect, useState } from 'react';
import type { StatementDocument } from '@setrya/api/contract';

import { api } from '@/lib/client/api';
import { openStatement } from '@/lib/client/share-crypto';

export type ShareState =
  | { kind: 'loading' }
  | { kind: 'missing_key' }
  | { kind: 'wrong_key' }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'offline' }
  | { kind: 'open'; doc: StatementDocument; key: string; expiresAt: string; acknowledgedAt: string | null };

/** Fetches ciphertext, then decrypts with the key from the URL fragment. The key is never sent anywhere. */
export function useShare(shareId: string, apiBase = '/api/v1'): ShareState {
  const [state, setState] = useState<ShareState>({ kind: 'loading' });
  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get('k');
    if (!key) return setState({ kind: 'missing_key' });
    void (async () => {
      const r = await api<{ ciphertext: string; expiresAt: string; acknowledgedAt: string | null }>(`${apiBase}/public-shares/${encodeURIComponent(shareId)}`);
      if (!r.ok) {
        if (r.error.code === 'OFFLINE') return setState({ kind: 'offline' });
        if (r.error.code === 'STATEMENT_EXPIRED') return setState({ kind: 'expired' });
        if (r.error.code === 'STATEMENT_REVOKED') return setState({ kind: 'revoked' });
        if (r.error.code === 'NOT_FOUND') return setState({ kind: 'wrong_key' });
        return setState({ kind: 'unavailable', message: r.error.message });
      }
      try {
        const doc = await openStatement<StatementDocument>(r.data.ciphertext, key, shareId);
        setState({ kind: 'open', doc, key, expiresAt: r.data.expiresAt, acknowledgedAt: r.data.acknowledgedAt });
      } catch {
        setState({ kind: 'wrong_key' });
      }
    })();
  }, [shareId, apiBase]);
  return state;
}
