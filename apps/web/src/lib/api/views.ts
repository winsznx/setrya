import 'server-only';

import type { Err, ViewData, ViewName } from '@setrya/api/contract';
import { decodeWire } from '@setrya/domain';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { clientIpFrom, upstream } from './upstream';

type Query = Record<string, string | undefined>;

/**
 * Loads a page's data from the API as the signed-in owner. Missing sessions and locked vaults send the owner to the
 * matching gate and back to `next` afterwards; unknown records render the 404 page.
 */
export async function loadView<N extends ViewName>(name: N, query: Query = {}, next?: string): Promise<ViewData<N>> {
  const incoming = await headers();
  const forward = new Headers({ accept: 'application/vnd.setrya.wire+json' });
  const cookie = incoming.get('cookie');
  if (cookie) forward.set('cookie', cookie);
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) search.set(k, v);
  const res = await upstream({ method: 'GET', path: `/api/v1/views/${name}?${search}`, headers: forward, clientIp: clientIpFrom(incoming) });
  const text = await res.text();
  if (res.ok) return decodeWire<{ data: ViewData<N> }>(text).data;
  const gate = next ? `?next=${encodeURIComponent(next)}` : '';
  if (res.status === 401) redirect(`/sign-in${gate}`);
  if (res.status === 423) redirect(`/unlock${gate}`);
  if (res.status === 404) notFound();
  const error = (JSON.parse(text) as Err).error;
  throw new Error(`${error.code}: ${error.message}`);
}
