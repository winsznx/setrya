import { getDb, schema, eq, and, asc, isNull } from '@setrya/db';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import type { UnlockedContext } from './session';

export interface ProjectView {
  id: string;
  name: string;
  orgName: string;
  issuerLabel: string;
  description: string | null;
  contact: string | null;
  logo: string | null;
  currency: string;
  timezone: string;
  cadence: string;
  minConfirmations: number;
  targetConfirmations: number;
  rateExpiryHours: number;
  stepUpWindowSeconds: number;
  maxRecipientsPerBatch: number;
  minPayoutZat: bigint;
  shareExpiryDays: number;
  revealTimeoutSeconds: number;
  defaultClassification: string;
  onboardingStep: string;
  archived: boolean;
  version: number;
}

type ProjectRow = typeof schema.projects.$inferSelect;

export function viewProject(ctx: UnlockedContext, row: ProjectRow): ProjectView {
  const d = (col: string, v: string | null) => ctx.cipher.decOpt('projects', row.id, col, v);
  return {
    id: row.id,
    name: d('name', row.nameEnc)!,
    orgName: d('org_name', row.orgNameEnc)!,
    issuerLabel: d('issuer_label', row.issuerLabelEnc)!,
    description: d('description', row.descriptionEnc),
    contact: d('contact', row.contactEnc),
    logo: d('logo', row.logoEnc),
    currency: row.currency,
    timezone: row.timezone,
    cadence: row.cadence,
    minConfirmations: row.minConfirmations,
    targetConfirmations: row.targetConfirmations,
    rateExpiryHours: row.rateExpiryHours,
    stepUpWindowSeconds: row.stepUpWindowSeconds,
    maxRecipientsPerBatch: row.maxRecipientsPerBatch,
    minPayoutZat: row.minPayoutZat,
    shareExpiryDays: row.shareExpiryDays,
    revealTimeoutSeconds: row.revealTimeoutSeconds,
    defaultClassification: row.defaultClassification,
    onboardingStep: row.onboardingStep,
    archived: row.archivedAt !== null,
    version: row.version,
  };
}

export async function listProjects(ctx: UnlockedContext): Promise<ProjectView[]> {
  const rows = await getDb().select().from(schema.projects).where(eq(schema.projects.ownerId, ctx.ownerId)).orderBy(asc(schema.projects.createdAt));
  return rows.map((r) => viewProject(ctx, r));
}

/** Ownership is checked in the query itself; an unknown and a foreign project look identical. */
export async function findProject(ctx: UnlockedContext, projectId: string): Promise<ProjectView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [row] = await getDb().select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, ctx.ownerId))).limit(1);
  return row ? viewProject(ctx, row) : null;
}

export async function requireProjectApi(ctx: UnlockedContext, projectId: string, { writable = false } = {}): Promise<ProjectView> {
  const p = await findProject(ctx, projectId);
  if (!p) throw new ApiError('NOT_FOUND', 'Not found.');
  if (writable && p.archived) throw new ApiError('FORBIDDEN', 'This project is archived. Historical records stay readable; new work is blocked.');
  return p;
}

export async function defaultProject(ctx: UnlockedContext): Promise<ProjectView | null> {
  const [row] = await getDb().select().from(schema.projects).where(and(eq(schema.projects.ownerId, ctx.ownerId), isNull(schema.projects.archivedAt))).orderBy(asc(schema.projects.createdAt)).limit(1);
  return row ? viewProject(ctx, row) : null;
}

export interface ProjectInput {
  orgName: string;
  name: string;
  issuerLabel: string;
  currency: string;
  timezone: string;
  description?: string | null;
  contact?: string | null;
  logo?: string | null;
}

export async function createProject(ctx: UnlockedContext, input: ProjectInput): Promise<string> {
  const id = randomUUID();
  const e = (col: string, v: string) => ctx.cipher.enc('projects', id, col, v);
  await getDb().insert(schema.projects).values({
    id,
    ownerId: ctx.ownerId,
    nameEnc: e('name', input.name),
    orgNameEnc: e('org_name', input.orgName),
    issuerLabelEnc: e('issuer_label', input.issuerLabel),
    descriptionEnc: ctx.cipher.encOpt('projects', id, 'description', input.description),
    contactEnc: ctx.cipher.encOpt('projects', id, 'contact', input.contact),
    logoEnc: ctx.cipher.encOpt('projects', id, 'logo', input.logo),
    currency: input.currency,
    timezone: input.timezone,
    onboardingStep: 'source',
  });
  return id;
}

export function projectPath(projectId: string, rest = ''): string {
  return `/app/p/${projectId}${rest}`;
}
