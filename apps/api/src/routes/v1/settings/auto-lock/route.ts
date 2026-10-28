import { getDb, schema, eq } from '@setrya/db';
import { z } from 'zod';

import { body, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';

export const POST = route('unlocked', async (req, ctx) => {
  const { minutes } = await body(req, z.object({ minutes: z.number().int().min(1).max(240) }));
  await getDb().update(schema.systemSettings).set({ autoLockMinutes: minutes, updatedAt: new Date() }).where(eq(schema.systemSettings.id, 1));
  await audit(ctx.cipher, 'owner', { projectId: null, eventType: 'settings.auto_lock_updated', diff: { minutes } });
  return { ok: true };
});
