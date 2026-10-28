import { z } from 'zod';

import { ApiError, body, rateLimit, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { resumePaymentJobs } from '../../../../services/payments/runner';
import { unlockVault } from '../../../../services/owner';

export const POST = route('session', async (req, session) => {
  rateLimit(`unlock:${session.sessionId}`, 6, 5 * 60_000);
  const { passphrase } = await body(req, z.object({ passphrase: z.string().min(1).max(256) }));
  if (!(await unlockVault(session.sessionId, passphrase))) throw new ApiError('FORBIDDEN', 'That passphrase did not unlock the workspace.', { fieldErrors: { passphrase: 'Passphrase not accepted' } });
  await audit(null, 'owner', { projectId: null, eventType: 'vault.unlocked' });
  void resumePaymentJobs();
  return { unlocked: true };
});
