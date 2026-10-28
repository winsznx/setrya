import { z } from 'zod';

import { body, rateLimit, route } from '../../../../http/route';
import { assessForInstall } from '../../../../services/partners';

/** Structural ZIP 316 check against this installation's network and pool. No external lookup. */
export const POST = route('session', async (req, session) => {
  rateLimit(`validate:${session.sessionId}`, 60, 60_000);
  const { address } = await body(req, z.object({ address: z.string().max(2048) }));
  return assessForInstall(address);
});
