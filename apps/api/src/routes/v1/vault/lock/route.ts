import { route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { dropKey } from '../../../../services/vault-store';

export const POST = route('session', async (_req, session) => {
  dropKey(session.sessionId);
  await audit(null, 'owner', { projectId: null, eventType: 'vault.locked' });
  return { locked: true };
});
