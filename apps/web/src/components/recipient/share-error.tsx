import { Icon } from '@/components/ui/icons';

import type { ShareState } from './use-share';

const COPY: Record<Exclude<ShareState['kind'], 'open' | 'loading'>, { title: string; body: string }> = {
  missing_key: { title: 'The key is missing from this link', body: 'Private statement links end with #k= followed by a key. Ask the issuer to send the complete link.' },
  wrong_key: { title: 'The key cannot open this statement', body: 'The link may be incomplete, altered or for a different statement. Nothing about the statement was revealed.' },
  expired: { title: 'This statement link expired', body: 'The encrypted copy was removed after its expiry date. Contact the issuer privately for a new link.' },
  revoked: { title: 'This link was revoked', body: 'The issuer withdrew this link. A copy you downloaded earlier is still yours; Setrya cannot erase it.' },
  unavailable: { title: 'Statement is temporarily unavailable', body: 'Try again in a moment.' },
  offline: { title: 'You appear to be offline', body: 'Reconnect and reload to open the statement.' },
};

export function ShareError({ state }: { state: ShareState }) {
  if (state.kind === 'open' || state.kind === 'loading') return null;
  const c = COPY[state.kind];
  return (
    <section role="alert" className="mx-auto mt-10 max-w-md rounded-workspace bg-canvas p-6 shadow-workspace">
      <Icon name="lock" size={22} className="text-ink-secondary" />
      <h1 className="mt-3 text-h2">{c.title}</h1>
      <p className="mt-2 text-body-s text-ink-secondary">{c.body}</p>
      <p className="mt-4 text-body-s text-ink-secondary">Contact the issuer privately, or try a different link.</p>
    </section>
  );
}
