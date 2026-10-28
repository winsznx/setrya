import { passwordStrength } from '@setrya/security';
import { z } from 'zod';

import { ApiError, body, rateLimit, route } from '../../../http/route';
import { audit } from '../../../services/audit';
import { createBackup } from '../../../services/backup';
import { blockedInDemo } from '../../../services/demo-mode';
import { verifyOwnerPassword } from '../../../services/owner';

export const POST = blockedInDemo(route('unlocked', async (req, ctx) => {
  rateLimit(`backup:${ctx.sessionId}`, 3, 10 * 60_000);
  const input = await body(req, z.object({ ownerPassword: z.string().max(256), backupPassword: z.string().max(256) }));
  if (!(await verifyOwnerPassword(ctx.ownerId, input.ownerPassword))) throw new ApiError('FORBIDDEN', 'Password not accepted.', { fieldErrors: { ownerPassword: 'Not accepted' } });
  const s = passwordStrength(input.backupPassword);
  if (!s.ok) throw new ApiError('INVALID_INPUT', s.problems[0]!, { fieldErrors: { backupPassword: s.problems[0]! } });
  const file = await createBackup(input.backupPassword);
  await audit(ctx.cipher, 'owner', { projectId: null, eventType: 'export.encrypted_backup', diff: { bytes: file.length } });
  return new Response(new Uint8Array(file), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="setrya-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' } });
}));
