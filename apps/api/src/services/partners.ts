import { getDb, schema, eq, and, asc, desc, inArray, isNull, sql, type Tx } from '@setrya/db';
import { addressFingerprint, assessAddress, type AddressAssessment, maskAddress, type PartnerPayability, SIGNED_STATES, type TxState } from '@setrya/domain';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/route';
import { audit } from './audit';
import { configuredNetwork, fundPool } from './network';
import type { UnlockedContext } from './session';

export const PARTNER_CATEGORIES = ['promoter', 'creator', 'contributor', 'other'] as const;

export interface AddressVersionView {
  id: string;
  version: number;
  network: string;
  address: string;
  masked: string;
  fingerprint: string;
  assessment: AddressAssessment;
  ownerConfirmedAt: Date | null;
  changeReason: string | null;
  effectiveAt: Date;
  retiredAt: Date | null;
}

export interface PartnerView {
  id: string;
  displayName: string;
  shortRef: string | null;
  contact: string | null;
  notes: string | null;
  category: string;
  active: boolean;
  version: number;
  createdAt: Date;
  address: AddressVersionView | null;
  payability: PartnerPayability;
}

type PartnerRow = typeof schema.partners.$inferSelect;
type AddressRow = typeof schema.partnerAddresses.$inferSelect;

function viewAddress(ctx: UnlockedContext, r: AddressRow): AddressVersionView {
  const address = ctx.cipher.dec('partner_addresses', r.id, 'address', r.addressEnc);
  return {
    id: r.id,
    version: r.version,
    network: r.network,
    address,
    masked: maskAddress(address),
    fingerprint: r.fingerprint,
    assessment: r.assessment as AddressAssessment,
    ownerConfirmedAt: r.ownerConfirmedAt,
    changeReason: ctx.cipher.decOpt('partner_addresses', r.id, 'change_reason', r.changeReasonEnc),
    effectiveAt: r.effectiveAt,
    retiredAt: r.retiredAt,
  };
}

export function payabilityOf(address: AddressVersionView | null): PartnerPayability {
  if (!address) return 'ADDRESS_MISSING';
  if (address.network !== configuredNetwork()) return 'ADDRESS_WRONG_NETWORK';
  const fresh = assessAddress(address.address, configuredNetwork(), fundPool());
  if (fresh.problem === 'WRONG_NETWORK') return 'ADDRESS_WRONG_NETWORK';
  if (!fresh.ok) return 'ADDRESS_UNSUPPORTED';
  if (!address.ownerConfirmedAt) return 'ADDRESS_UNCONFIRMED';
  return 'ok';
}

function viewPartner(ctx: UnlockedContext, r: PartnerRow, address: AddressRow | undefined): PartnerView {
  const d = (c: string, v: string | null) => ctx.cipher.decOpt('partners', r.id, c, v);
  const a = address ? viewAddress(ctx, address) : null;
  return { id: r.id, displayName: d('display_name', r.displayNameEnc)!, shortRef: d('short_ref', r.shortRefEnc), contact: d('contact', r.contactEnc), notes: d('notes', r.notesEnc), category: r.category, active: r.active, version: r.version, createdAt: r.createdAt, address: a, payability: payabilityOf(a) };
}

export async function listPartners(ctx: UnlockedContext, projectId: string): Promise<PartnerView[]> {
  const db = getDb();
  const rows = await db.select().from(schema.partners).where(eq(schema.partners.projectId, projectId)).orderBy(asc(schema.partners.createdAt));
  if (rows.length === 0) return [];
  const addresses = await db.select().from(schema.partnerAddresses).where(and(inArray(schema.partnerAddresses.partnerId, rows.map((r) => r.id)), isNull(schema.partnerAddresses.retiredAt)));
  const byPartner = new Map(addresses.map((a) => [a.partnerId, a]));
  return rows.map((r) => viewPartner(ctx, r, byPartner.get(r.id))).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getPartner(ctx: UnlockedContext, projectId: string, partnerId: string): Promise<PartnerView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(partnerId)) return null;
  const db = getDb();
  const [r] = await db.select().from(schema.partners).where(and(eq(schema.partners.id, partnerId), eq(schema.partners.projectId, projectId))).limit(1);
  if (!r) return null;
  const [a] = await db.select().from(schema.partnerAddresses).where(and(eq(schema.partnerAddresses.partnerId, r.id), isNull(schema.partnerAddresses.retiredAt))).limit(1);
  return viewPartner(ctx, r, a);
}

export async function addressHistory(ctx: UnlockedContext, partnerId: string): Promise<AddressVersionView[]> {
  const rows = await getDb().select().from(schema.partnerAddresses).where(eq(schema.partnerAddresses.partnerId, partnerId)).orderBy(desc(schema.partnerAddresses.version));
  return rows.map((r) => viewAddress(ctx, r));
}

export interface PartnerInput {
  displayName: string;
  shortRef?: string | null;
  contact?: string | null;
  notes?: string | null;
  category: string;
  active: boolean;
}

export async function createPartner(ctx: UnlockedContext, projectId: string, input: PartnerInput, address: { value: string; confirmed: boolean } | null): Promise<string> {
  const id = randomUUID();
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.partners).values({
      id,
      projectId,
      displayNameEnc: ctx.cipher.enc('partners', id, 'display_name', input.displayName),
      shortRefEnc: ctx.cipher.encOpt('partners', id, 'short_ref', input.shortRef),
      contactEnc: ctx.cipher.encOpt('partners', id, 'contact', input.contact),
      notesEnc: ctx.cipher.encOpt('partners', id, 'notes', input.notes),
      category: input.category,
      active: input.active,
    });
    if (address) await insertAddressVersion(ctx, tx, id, 1, address.value, address.confirmed, null);
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'partner.created', objectType: 'partner', objectId: id, diff: { category: input.category, hasAddress: address !== null } }, tx);
  });
  return id;
}

export function assessForInstall(address: string): AddressAssessment {
  return assessAddress(address, configuredNetwork(), fundPool());
}

async function insertAddressVersion(ctx: UnlockedContext, tx: Tx, partnerId: string, version: number, address: string, confirmed: boolean, reason: string | null): Promise<string> {
  const assessment = assessForInstall(address);
  if (!assessment.ok) throw new ApiError('ADDRESS_UNSUPPORTED', assessment.message, { fieldErrors: { address: assessment.message } });
  const id = randomUUID();
  await tx.insert(schema.partnerAddresses).values({
    id,
    partnerId,
    version,
    network: configuredNetwork(),
    addressEnc: ctx.cipher.enc('partner_addresses', id, 'address', address.trim()),
    fingerprint: addressFingerprint(address.trim()),
    assessment,
    ownerConfirmedAt: confirmed ? new Date() : null,
    changeReasonEnc: reason ? ctx.cipher.enc('partner_addresses', id, 'change_reason', reason) : null,
  });
  await tx.update(schema.partners).set({ latestAddressVersion: version, updatedAt: new Date() }).where(eq(schema.partners.id, partnerId));
  return id;
}

export async function updatePartner(ctx: UnlockedContext, projectId: string, partnerId: string, expectedVersion: number, input: PartnerInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.partners)
      .set({
        displayNameEnc: ctx.cipher.enc('partners', partnerId, 'display_name', input.displayName),
        shortRefEnc: ctx.cipher.encOpt('partners', partnerId, 'short_ref', input.shortRef),
        contactEnc: ctx.cipher.encOpt('partners', partnerId, 'contact', input.contact),
        notesEnc: ctx.cipher.encOpt('partners', partnerId, 'notes', input.notes),
        category: input.category,
        active: input.active,
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.partners.id, partnerId), eq(schema.partners.projectId, projectId), eq(schema.partners.version, expectedVersion)))
      .returning({ id: schema.partners.id });
    if (!updated) throw new ApiError('CONFLICT', 'This partner changed since you opened it. Reload and apply your edits again.');
    await audit(ctx.cipher, 'owner', { projectId, eventType: input.active ? 'partner.updated' : 'partner.deactivated', objectType: 'partner', objectId: partnerId, diff: { category: input.category, active: input.active } }, tx);
  });
}

/**
 * A new address version retires the old one. Approvals that include this partner and have no signed transaction are
 * invalidated, so a changed destination always goes back through review. Signed or broadcast payments keep the old
 * address in their immutable snapshot.
 */
export async function changeAddress(ctx: UnlockedContext, projectId: string, partnerId: string, address: string, confirmed: boolean, reason: string): Promise<{ invalidatedApprovals: number }> {
  return getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(schema.partners).where(and(eq(schema.partners.id, partnerId), eq(schema.partners.projectId, projectId))).for('update').limit(1);
    if (!p) throw new ApiError('NOT_FOUND', 'Not found.');
    await tx.update(schema.partnerAddresses).set({ retiredAt: new Date() }).where(and(eq(schema.partnerAddresses.partnerId, partnerId), isNull(schema.partnerAddresses.retiredAt)));
    const addressId = await insertAddressVersion(ctx, tx, partnerId, p.latestAddressVersion + 1, address, confirmed, reason);
    const invalidated = await invalidateUnsignedApprovalsFor(tx, partnerId, 'Partner payout address changed');
    await audit(ctx.cipher, 'owner', { projectId, eventType: 'partner.address_changed', objectType: 'partner', objectId: partnerId, diff: { newVersion: p.latestAddressVersion + 1, addressVersionId: addressId, invalidatedApprovals: invalidated }, reason }, tx);
    return { invalidatedApprovals: invalidated };
  });
}

export async function invalidateUnsignedApprovalsFor(tx: Tx, partnerId: string, reason: string): Promise<number> {
  const intents = await tx
    .select({ approvalId: schema.payoutIntents.approvalId, periodId: schema.payoutIntents.periodId })
    .from(schema.payoutIntents)
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.payoutIntents.approvalId))
    .where(and(eq(schema.payoutIntents.partnerId, partnerId), isNull(schema.approvals.invalidatedAt)));
  let count = 0;
  for (const { approvalId, periodId } of new Map(intents.map((i) => [i.approvalId, i])).values()) {
    const txs = await tx
      .select({ state: schema.chainTransactions.state })
      .from(schema.chainTransactions)
      .innerJoin(schema.paymentBatches, eq(schema.paymentBatches.id, schema.chainTransactions.batchId))
      .where(eq(schema.paymentBatches.approvalId, approvalId));
    if (txs.some((t) => SIGNED_STATES.has(t.state as TxState))) continue;
    await tx.update(schema.approvals).set({ invalidatedAt: new Date(), invalidationReason: reason }).where(eq(schema.approvals.id, approvalId));
    await tx.update(schema.chainTransactions).set({ state: 'CANCELLED_BEFORE_SIGN', diagnosis: reason, updatedAt: new Date() }).where(inArray(schema.chainTransactions.batchId, tx.select({ id: schema.paymentBatches.id }).from(schema.paymentBatches).where(eq(schema.paymentBatches.approvalId, approvalId))));
    await tx.update(schema.payoutIntents).set({ state: 'superseded', updatedAt: new Date() }).where(eq(schema.payoutIntents.approvalId, approvalId));
    await tx.update(schema.periods).set({ status: 'draft', revision: sql`${schema.periods.revision} + 1`, approvedSnapshotId: null, frozenSnapshotEnc: null, frozenSnapshotHash: null, frozenAt: null, updatedAt: new Date() }).where(eq(schema.periods.id, periodId));
    count += 1;
  }
  return count;
}
