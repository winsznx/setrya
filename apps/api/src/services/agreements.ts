import { getDb, schema, eq, and, asc, desc, inArray, ne, type Tx } from '@setrya/db';
import { agreementTermsSchema, type AgreementTerms, decToString, poolCommitment, type PoolMember, windowsOverlap } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { audit } from './audit';
import type { UnlockedContext } from './session';

export interface VersionView {
  id: string;
  version: number;
  status: 'draft' | 'active' | 'superseded';
  terms: AgreementTerms;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  reason: string | null;
  activatedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}

export interface AgreementView {
  id: string;
  partnerId: string;
  sourceIds: string[];
  title: string;
  externalRef: string | null;
  status: 'draft' | 'active' | 'ended';
  currentVersion: number;
  version: number;
  endedAt: Date | null;
  versions: VersionView[];
  /** The newest active version, or the draft for an agreement never activated. */
  current: VersionView;
}

function viewVersion(ctx: UnlockedContext, r: typeof schema.agreementVersions.$inferSelect): VersionView {
  return {
    id: r.id,
    version: r.version,
    status: r.status as VersionView['status'],
    terms: agreementTermsSchema.parse(ctx.cipher.decJson('agreement_versions', r.id, 'terms', r.termsEnc)),
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    reason: ctx.cipher.decOpt('agreement_versions', r.id, 'reason', r.reasonEnc),
    activatedAt: r.activatedAt,
    supersededAt: r.supersededAt,
    createdAt: r.createdAt,
  };
}

async function load(ctx: UnlockedContext, rows: (typeof schema.agreements.$inferSelect)[]): Promise<AgreementView[]> {
  if (rows.length === 0) return [];
  const versions = await getDb().select().from(schema.agreementVersions).where(inArray(schema.agreementVersions.agreementId, rows.map((r) => r.id))).orderBy(asc(schema.agreementVersions.version));
  return rows.map((r) => {
    const vs = versions.filter((v) => v.agreementId === r.id).map((v) => viewVersion(ctx, v));
    const current = [...vs].reverse().find((v) => v.status === 'active') ?? vs[vs.length - 1]!;
    return {
      id: r.id,
      partnerId: r.partnerId,
      sourceIds: r.sourceIds,
      title: ctx.cipher.dec('agreements', r.id, 'title', r.titleEnc),
      externalRef: ctx.cipher.decOpt('agreements', r.id, 'external_ref', r.externalRefEnc),
      status: r.status as AgreementView['status'],
      currentVersion: r.currentVersion,
      version: r.version,
      endedAt: r.endedAt,
      versions: vs,
      current,
    };
  });
}

export async function listAgreements(ctx: UnlockedContext, projectId: string, partnerId?: string): Promise<AgreementView[]> {
  const where = partnerId ? and(eq(schema.agreements.projectId, projectId), eq(schema.agreements.partnerId, partnerId)) : eq(schema.agreements.projectId, projectId);
  const rows = await getDb().select().from(schema.agreements).where(where).orderBy(desc(schema.agreements.createdAt));
  return load(ctx, rows);
}

export async function getAgreement(ctx: UnlockedContext, projectId: string, agreementId: string): Promise<AgreementView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(agreementId)) return null;
  const rows = await getDb().select().from(schema.agreements).where(and(eq(schema.agreements.id, agreementId), eq(schema.agreements.projectId, projectId))).limit(1);
  return (await load(ctx, rows))[0] ?? null;
}

export interface AgreementInput {
  partnerId: string;
  sourceIds: string[];
  title: string;
  externalRef?: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  terms: AgreementTerms;
  activate: boolean;
}

export interface ActivationCheck {
  overcommitted: { sourceId: string; totalPct: string }[];
  needsIndependentAck: { sourceId: string; totalPct: string }[];
  overlapsSamePartner: string[];
}

/** Checks a candidate against other active agreements in the project. Never normalises rates. */
export async function activationCheck(ctx: UnlockedContext, projectId: string, candidate: { agreementId: string; partnerId: string; sourceIds: string[]; effectiveFrom: Date; effectiveTo: Date | null; terms: AgreementTerms }): Promise<ActivationCheck> {
  const others = (await listAgreements(ctx, projectId)).filter((a) => a.id !== candidate.agreementId && a.status === 'active');
  const members: PoolMember[] = others.flatMap((a) => a.versions.filter((v) => v.status === 'active').map((v) => ({ agreementId: a.id, sourceIds: a.sourceIds, terms: v.terms, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo })));
  const pool = poolCommitment(members, { agreementId: candidate.agreementId, sourceIds: candidate.sourceIds, terms: candidate.terms, effectiveFrom: candidate.effectiveFrom, effectiveTo: candidate.effectiveTo });
  const overlapsSamePartner = others
    .filter((a) => a.partnerId === candidate.partnerId && a.sourceIds.some((s) => candidate.sourceIds.includes(s)))
    .filter((a) => a.versions.some((v) => v.status === 'active' && windowsOverlap(v, candidate)))
    .map((a) => a.title);
  return {
    overcommitted: pool.filter((p) => p.overcommitted).map((p) => ({ sourceId: p.sourceId, totalPct: decToString(p.totalPct) })),
    needsIndependentAck: pool.filter((p) => p.independentUnacknowledged).map((p) => ({ sourceId: p.sourceId, totalPct: decToString(p.totalPct) })),
    overlapsSamePartner,
  };
}

function assertActivatable(check: ActivationCheck): void {
  if (check.overcommitted.length > 0) {
    throw new ApiError('AGREEMENT_OVERLAP', 'Exclusive shares on this source would exceed 100%. Lower a rate, or mark these agreements as independent obligations paid from your own balance.', { fieldErrors: { 'terms.poolSemantics': 'Pool is overcommitted' } });
  }
  if (check.needsIndependentAck.length > 0) {
    throw new ApiError('AGREEMENT_OVERLAP', 'Independent obligations on this source exceed 100% of fees. Confirm you will fund the difference yourself.', { fieldErrors: { 'terms.overcommitAcknowledged': 'Acknowledge the overcommitment' } });
  }
}

async function insertVersion(ctx: UnlockedContext, tx: Tx, agreementId: string, version: number, input: Pick<AgreementInput, 'effectiveFrom' | 'effectiveTo' | 'terms'>, status: 'draft' | 'active', reason: string | null): Promise<string> {
  const id = randomUUID();
  await tx.insert(schema.agreementVersions).values({
    id,
    agreementId,
    version,
    status,
    termsEnc: ctx.cipher.encJson('agreement_versions', id, 'terms', input.terms),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    reasonEnc: reason ? ctx.cipher.enc('agreement_versions', id, 'reason', reason) : null,
    createdBy: ctx.ownerId,
    activatedAt: status === 'active' ? new Date() : null,
  });
  return id;
}

export async function createAgreement(ctx: UnlockedContext, projectId: string, input: AgreementInput): Promise<string> {
  const id = randomUUID();
  if (input.activate) assertActivatable(await activationCheck(ctx, projectId, { ...input, agreementId: id }));
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.agreements).values({
      id,
      projectId,
      partnerId: input.partnerId,
      sourceIds: input.sourceIds,
      titleEnc: ctx.cipher.enc('agreements', id, 'title', input.title),
      externalRefEnc: ctx.cipher.encOpt('agreements', id, 'external_ref', input.externalRef),
      currentVersion: 1,
      status: input.activate ? 'active' : 'draft',
    });
    await insertVersion(ctx, tx, id, 1, input, input.activate ? 'active' : 'draft', null);
    await audit(ctx.cipher, 'owner', { projectId, eventType: input.activate ? 'agreement.activated' : 'agreement.drafted', objectType: 'agreement', objectId: id, diff: { version: 1, terms: input.terms } }, tx);
  });
  return id;
}

/**
 * Saves a draft revision (version N+1) or activates it. Activation supersedes earlier active versions from the new
 * effective date onward; their stored terms and any frozen periods that used them never change.
 */
export async function saveRevision(ctx: UnlockedContext, projectId: string, agreementId: string, input: { effectiveFrom: Date; effectiveTo: Date | null; terms: AgreementTerms; reason: string; activate: boolean; expectedVersion: number }): Promise<{ version: number }> {
  const agreement = await getAgreement(ctx, projectId, agreementId);
  if (!agreement) throw new ApiError('NOT_FOUND', 'Not found.');
  if (agreement.status === 'ended') throw new ApiError('FORBIDDEN', 'This agreement has ended. Create a new agreement instead.');
  if (input.activate) assertActivatable(await activationCheck(ctx, projectId, { agreementId, partnerId: agreement.partnerId, sourceIds: agreement.sourceIds, ...input }));
  return getDb().transaction(async (tx) => {
    const [locked] = await tx.update(schema.agreements).set({ version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(schema.agreements.id, agreementId), eq(schema.agreements.version, input.expectedVersion))).returning();
    if (!locked) throw new ApiError('CONFLICT', 'This agreement changed since you opened it. Reload and try again.');
    const draft = agreement.versions.find((v) => v.status === 'draft');
    let versionNumber: number;
    if (draft && agreement.status === 'active') {
      versionNumber = draft.version;
      await tx.delete(schema.agreementVersions).where(and(eq(schema.agreementVersions.id, draft.id), eq(schema.agreementVersions.status, 'draft')));
    } else if (draft && agreement.status === 'draft') {
      versionNumber = draft.version;
      await tx.delete(schema.agreementVersions).where(and(eq(schema.agreementVersions.id, draft.id), eq(schema.agreementVersions.status, 'draft')));
    } else versionNumber = Math.max(...agreement.versions.map((v) => v.version)) + 1;
    await insertVersion(ctx, tx, agreementId, versionNumber, input, input.activate ? 'active' : 'draft', input.reason);
    if (input.activate) {
      for (const prior of agreement.versions.filter((v) => v.status === 'active')) {
        const endsAfter = prior.effectiveTo === null || prior.effectiveTo > input.effectiveFrom;
        if (prior.effectiveFrom >= input.effectiveFrom) {
          await tx.update(schema.agreementVersions).set({ status: 'superseded', supersededAt: new Date() }).where(eq(schema.agreementVersions.id, prior.id));
        } else if (endsAfter) {
          await tx.update(schema.agreementVersions).set({ effectiveTo: input.effectiveFrom, supersededAt: new Date() }).where(eq(schema.agreementVersions.id, prior.id));
        }
      }
      await tx.update(schema.agreements).set({ status: 'active', currentVersion: versionNumber }).where(eq(schema.agreements.id, agreementId));
    }
    await audit(ctx.cipher, 'owner', { projectId, eventType: input.activate ? 'agreement.revision_activated' : 'agreement.revision_drafted', objectType: 'agreement', objectId: agreementId, diff: { version: versionNumber, terms: input.terms }, reason: input.reason }, tx);
    return { version: versionNumber };
  });
}

export async function endAgreement(ctx: UnlockedContext, projectId: string, agreementId: string, endAt: Date, reason: string): Promise<void> {
  const agreement = await getAgreement(ctx, projectId, agreementId);
  if (!agreement) throw new ApiError('NOT_FOUND', 'Not found.');
  await getDb().transaction(async (tx) => {
    for (const v of agreement.versions.filter((x) => x.status === 'active')) {
      if (v.effectiveFrom >= endAt) await tx.update(schema.agreementVersions).set({ status: 'superseded', supersededAt: new Date() }).where(eq(schema.agreementVersions.id, v.id));
      else if (v.effectiveTo === null || v.effectiveTo > endAt) await tx.update(schema.agreementVersions).set({ effectiveTo: endAt }).where(eq(schema.agreementVersions.id, v.id));
    }
    await tx.delete(schema.agreementVersions).where(and(eq(schema.agreementVersions.agreementId, agreementId), eq(schema.agreementVersions.status, 'draft')));
    await tx.update(schema.agreements).set({ status: 'ended', endedAt: endAt, updatedAt: new Date() }).where(eq(schema.agreements.id, agreementId));
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'agreement.ended', objectType: 'agreement', objectId: agreementId, diff: { endAt: endAt.toISOString() }, reason }, tx);
  });
}

export async function periodsUsingVersions(versionIds: string[]): Promise<{ periodId: string; versionId: string; status: string }[]> {
  if (versionIds.length === 0) return [];
  const rows = await getDb()
    .selectDistinct({ periodId: schema.calculationRows.periodId, versionId: schema.calculationRows.agreementVersionId, status: schema.periods.status })
    .from(schema.calculationRows)
    .innerJoin(schema.periods, and(eq(schema.periods.id, schema.calculationRows.periodId), eq(schema.periods.revision, schema.calculationRows.revision)))
    .where(and(inArray(schema.calculationRows.agreementVersionId, versionIds), ne(schema.periods.status, 'cancelled')));
  return rows;
}
