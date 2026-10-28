import { getDb, schema, eq, and } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../../../http/route';
import { audit } from '../../../../../../services/audit';
import { requireProjectApi } from '../../../../../../services/projects';
import { sourceSchema } from '../../../../../../services/schemas';
import { getSource } from '../../../../../../services/sources';

/** Changes defaults for future imports only. Already imported rows keep their stored classification. */
export const PATCH = route('unlocked', async (req, ctx, { projectId, sourceId }) => {
  const project = await requireProjectApi(ctx, projectId!, { writable: true });
  const source = await getSource(ctx, project.id, sourceId!);
  if (!source) throw new ApiError('NOT_FOUND', 'Not found.');
  const input = await body(req, sourceSchema.extend({ enabled: z.boolean(), expectedVersion: z.number().int() }));
  const [u] = await getDb()
    .update(schema.sources)
    .set({
      nameEnc: ctx.cipher.enc('sources', source.id, 'name', input.name),
      platformEnc: ctx.cipher.encOpt('sources', source.id, 'platform', input.platform),
      noteEnc: ctx.cipher.encOpt('sources', source.id, 'note', input.note),
      referenceUrlEnc: ctx.cipher.encOpt('sources', source.id, 'reference_url', input.referenceUrl),
      defaultCurrency: input.defaultCurrency,
      feeType: input.feeType,
      timezone: input.timezone,
      enabled: input.enabled,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.sources.id, source.id), eq(schema.sources.version, input.expectedVersion)))
    .returning({ id: schema.sources.id });
  if (!u) throw new ApiError('CONFLICT', 'This source changed elsewhere. Reload and try again.');
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: input.enabled ? 'source.updated' : 'source.disabled', objectType: 'source', objectId: source.id, diff: { feeType: input.feeType, currency: input.defaultCurrency, enabled: input.enabled } });
  return { ok: true };
});
