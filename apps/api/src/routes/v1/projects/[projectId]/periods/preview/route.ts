import { calculatePeriod, type Classification, decToString, type EngineVersion, type EntryType, type IssueCode, parseDec, sum } from '@setrya/domain';

import { body, route } from '../../../../../../http/route';
import { listAgreements } from '../../../../../../services/agreements';
import { listPartners } from '../../../../../../services/partners';
import { candidateEntries } from '../../../../../../services/periods';
import { requireProjectApi } from '../../../../../../services/projects';
import { ratesByIds } from '../../../../../../services/rates';

import { periodInputSchema, periodRange } from '../../../../../../services/schemas';

/** Dry run of the period wizard: same engine, nothing persisted, no funds touched. */
export const POST = route('unlocked', async (req, ctx, { projectId }) => {
  const project = await requireProjectApi(ctx, projectId!);
  const input = await body(req, periodInputSchema.partial({ label: true }));
  const { startAt, endAt } = periodRange(input.startDate, input.endDate, project.timezone);
  const { available, claimed } = await candidateEntries(project.id, { startAt, endAt, sourceIds: input.sourceIds });
  const group = (list: typeof available) => {
    const by = new Map<string, string[]>();
    for (const e of list) by.set(e.currency, [...(by.get(e.currency) ?? []), e.amount]);
    return Object.fromEntries([...by].map(([c, v]) => [c, decToString(sum(v.map((x) => parseDec(x))))]));
  };
  const agreements = (await listAgreements(ctx, project.id)).filter((a) => a.sourceIds.some((s) => input.sourceIds.includes(s)));
  const versions: EngineVersion[] = agreements.flatMap((a) => a.versions.filter((v) => v.status === 'active' || (v.status === 'superseded' && v.effectiveTo !== null)).map((v) => ({ id: v.id, agreementId: a.id, partnerId: a.partnerId, version: v.version, sourceIds: a.sourceIds.filter((s) => input.sourceIds.includes(s)), effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, terms: v.terms })));
  const partners = await listPartners(ctx, project.id);
  const rates = await ratesByIds(ctx, project.id, Object.values(input.rateSnapshotIds));
  const result = calculatePeriod({
    periodStart: startAt,
    periodEnd: endAt,
    entries: available.map((e) => ({ id: e.id, sourceId: e.sourceId, occurredAt: e.occurredAt, amount: parseDec(e.amount), currency: e.currency, type: e.type as EntryType, inclusion: e.classification as Classification, issues: e.issues as IssueCode[], fingerprint: e.rowHash })),
    versions,
    partners: partners.map((p) => ({ id: p.id, active: p.active, payability: p.payability })),
    rates: Object.fromEntries(rates.map((r) => [r.base, r])),
    now: new Date(),
    minPayoutZat: project.minPayoutZat,
  });
  const currencies = [...new Set(available.map((e) => e.currency))];
  return {
    startAt,
    endAt,
    matched: available.length,
    alreadyClaimed: claimed,
    byClassification: { eligible: group(available.filter((e) => e.classification === 'eligible')), excluded: group(available.filter((e) => e.classification === 'excluded')), held: group(available.filter((e) => e.classification === 'held')) },
    heldCount: available.filter((e) => e.classification === 'held').length,
    currencies,
    agreements: versions.map((v) => ({ versionId: v.id, agreementId: v.agreementId, partnerId: v.partnerId, title: agreements.find((a) => a.id === v.agreementId)!.title, partner: partners.find((p) => p.id === v.partnerId)?.displayName ?? '', version: v.version, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, terms: v.terms })),
    rows: result.rows.map((r) => ({ key: r.key, partner: partners.find((p) => p.id === r.partnerId)?.displayName ?? '', currency: r.currency, owed: r.formula.owed, base: r.formula.base, zat: r.zat?.toString() ?? null, status: r.status, holds: r.holds.map((h) => h.code) })),
    totals: result.totals,
    exceptions: result.exceptions.map((e) => ({ code: e.code, severity: e.severity })),
  };
});
