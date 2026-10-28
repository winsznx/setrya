import { getDb, schema, eq, and } from '@setrya/db';
import { z } from 'zod';

import { ApiError, body, route } from '../../../../http/route';
import { audit } from '../../../../services/audit';
import { assertNotDemo } from '../../../../services/demo-mode';
import { requireProjectApi } from '../../../../services/projects';
import { projectSchema } from '../../../../services/schemas';

const patch = z.discriminatedUnion('section', [
  projectSchema.extend({ section: z.literal('project'), cadence: z.enum(['weekly', 'monthly', 'per_launch']), expectedVersion: z.number().int() }),
  z.object({
    section: z.literal('settlement'),
    expectedVersion: z.number().int(),
    cadence: z.enum(['weekly', 'monthly', 'per_launch']),
    defaultClassification: z.enum(['realised_fee', 'gross_volume', 'other']),
    minConfirmations: z.number().int().min(1).max(100),
    targetConfirmations: z.number().int().min(1).max(200),
    rateExpiryHours: z.number().int().min(1).max(24 * 30),
    stepUpWindowSeconds: z.number().int().min(60).max(900),
    maxRecipientsPerBatch: z.number().int().min(1).max(50),
    minPayoutZat: z.string().regex(/^\d{1,12}$/),
  }),
  z.object({ section: z.literal('privacy'), expectedVersion: z.number().int(), shareExpiryDays: z.number().int().min(1).max(365), revealTimeoutSeconds: z.number().int().min(5).max(600) }),
  z.object({ section: z.literal('archive'), expectedVersion: z.number().int(), archived: z.boolean(), reason: z.string().trim().min(3).max(300) }),
]);

export const GET = route('unlocked', async (_req, ctx, { projectId }) => requireProjectApi(ctx, projectId!));

export const PATCH = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const input = await body(req, patch);
  if (input.section === 'archive') assertNotDemo();
  if (input.section !== 'archive' && project.archived) throw new ApiError('FORBIDDEN', 'Archived projects are read-only.');
  let set: Partial<typeof schema.projects.$inferInsert> = {};
  if (input.section === 'project') {
    set = {
      nameEnc: ctx.cipher.enc('projects', project.id, 'name', input.name),
      orgNameEnc: ctx.cipher.enc('projects', project.id, 'org_name', input.orgName),
      issuerLabelEnc: ctx.cipher.enc('projects', project.id, 'issuer_label', input.issuerLabel),
      descriptionEnc: ctx.cipher.encOpt('projects', project.id, 'description', input.description),
      contactEnc: ctx.cipher.encOpt('projects', project.id, 'contact', input.contact),
      logoEnc: ctx.cipher.encOpt('projects', project.id, 'logo', input.logo),
      currency: input.currency,
      timezone: input.timezone,
      cadence: input.cadence,
    };
  } else if (input.section === 'settlement') {
    if (input.targetConfirmations < input.minConfirmations) throw new ApiError('INVALID_INPUT', 'Target confirmations must be at least the minimum input confirmations.', { fieldErrors: { targetConfirmations: 'Too low' } });
    const { section: _s, expectedVersion: _v, minPayoutZat, ...rest } = input;
    set = { ...rest, minPayoutZat: BigInt(minPayoutZat) };
  } else if (input.section === 'privacy') {
    set = { shareExpiryDays: input.shareExpiryDays, revealTimeoutSeconds: input.revealTimeoutSeconds };
  } else set = { archivedAt: input.archived ? new Date() : null };
  const [updated] = await getDb().update(schema.projects).set({ ...set, version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(schema.projects.id, project.id), eq(schema.projects.version, input.expectedVersion))).returning({ id: schema.projects.id });
  if (!updated) throw new ApiError('CONFLICT', 'Settings changed in another tab. Reload and apply again.');
  await audit(ctx.cipher, 'owner', { projectId: project.id, eventType: `settings.${input.section}_updated`, objectType: 'project', objectId: project.id, diff: input.section === 'project' ? { currency: input.currency, timezone: input.timezone } : set, reason: input.section === 'archive' ? input.reason : null });
  return { ok: true };
});
