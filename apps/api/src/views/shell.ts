import { getDb, schema, eq, and, desc, gte, like } from '@setrya/db';

import { ApiError } from '../http/route';
import { demoConfig } from '../services/demo-mode';
import { overview, partnersDue } from '../services/overview';
import { ownerExists } from '../services/owner';
import { listPartners } from '../services/partners';
import { defaultProject, findProject, listProjects, requireProjectApi } from '../services/projects';
import { readSession, unlockedFrom } from '../services/session';
import { setupStatus } from '../services/setup-status';
import { autoLockMinutes, networkLabel, openExceptionCount, walletSummary } from '../services/shell';
import { listSources } from '../services/sources';
import { buildStatement } from '../services/statements';
import { walletHealth } from '../services/wallet';

import { defineView } from './define';

export const shellViews = {
  /** Public: only whether an owner exists and whether this browser is signed in or unlocked. */
  'auth.status': defineView('none', async () => {
    const session = await readSession();
    return { ownerExists: await ownerExists(), signedIn: session !== null, unlocked: session !== null && unlockedFrom(session) !== null, demoMode: demoConfig().enabled };
  }),
  /** The shared judge login, shown on the sign-in page only when the operator configured one for demo mode. */
  'auth.demoLogin': defineView('none', async () => demoConfig().login),
  'auth.unlock': defineView('session', async (session) => ({ ownerName: session.ownerName, unlocked: unlockedFrom(session) !== null })),
  'shell.home': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    return { projectId: project?.id ?? null };
  }),
  'shell.project': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [projects, health, exceptions, lockMinutes] = await Promise.all([listProjects(ctx), walletHealth({ minConf: project.minConfirmations }), openExceptionCount(project.id), autoLockMinutes()]);
    return {
      project,
      projects: projects.map((p) => ({ id: p.id, name: p.name, archived: p.archived })),
      ownerName: ctx.ownerName,
      network: networkLabel(),
      wallet: walletSummary(health),
      exceptions,
      lockMinutes,
      demo: demoConfig().enabled ? { maxZat: demoConfig().maxZat } : null,
    };
  }),
  'shell.overview': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [data, health, sources, partners] = await Promise.all([overview(ctx, project), walletHealth({ minConf: project.minConfirmations }), listSources(ctx, project.id), listPartners(ctx, project.id)]);
    const status = await setupStatus(project.id, health);
    const due = await partnersDue(ctx, project, data.periods);
    return { project, data, health, sources, partners, status, due, wallet: walletSummary(health) };
  }),
  'shell.activity': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const type = q.optional('type');
    const days = q.optional('days');
    const conditions = [eq(schema.auditEvents.projectId, project.id)];
    if (type && /^[a-z]+$/.test(type)) conditions.push(like(schema.auditEvents.eventType, `${type}.%`));
    if (days && /^\d+$/.test(days)) conditions.push(gte(schema.auditEvents.createdAt, new Date(Date.now() - Number(days) * 86_400_000)));
    const events = await getDb().select().from(schema.auditEvents).where(and(...conditions)).orderBy(desc(schema.auditEvents.createdAt)).limit(300);
    const rows = events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actor: e.actor,
      objectType: e.objectType,
      objectId: e.objectId,
      createdAt: e.createdAt,
      reason: e.reasonEnc ? ctx.cipher.dec('audit_events', e.id, 'reason', e.reasonEnc) : null,
      diff: e.diffEnc ? JSON.stringify(ctx.cipher.decJson('audit_events', e.id, 'diff', e.diffEnc), null, 2) : null,
    }));
    return { project, rows };
  }),
  /** Opening the print view counts as a download, as it did when the page read the database directly. */
  'print.statement': defineView('unlocked', async (ctx, q) => {
    const statementId = q.get('statementId');
    const [row] = /^[0-9a-f-]{36}$/i.test(statementId) ? await getDb().select({ projectId: schema.statements.projectId }).from(schema.statements).where(eq(schema.statements.id, statementId)) : [];
    const project = row ? await findProject(ctx, row.projectId) : null;
    const doc = project ? await buildStatement(ctx, project, statementId) : null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Not found.');
    await getDb().update(schema.statements).set({ downloadedAt: new Date() }).where(eq(schema.statements.id, doc.id));
    return { doc };
  }),
};
