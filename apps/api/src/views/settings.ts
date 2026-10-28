import { getDb, schema, eq, and, isNull, gt, desc, sql } from '@setrya/db';

import { listPeriods } from '../services/periods';
import { requireProjectApi } from '../services/projects';
import { networkLabel, walletSummary } from '../services/shell';
import { walletHealth } from '../services/wallet';

import { defineView } from './define';

export const settingsViews = {
  'settings.index': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const health = await walletHealth({ minConf: project.minConfirmations });
    const [settings] = await getDb().select().from(schema.systemSettings).where(eq(schema.systemSettings.id, 1));
    return { project, connectionName: health.connectionName, wallet: walletSummary(health), autoLockMinutes: settings?.autoLockMinutes ?? 15, network: networkLabel() };
  }),
  'settings.privacy': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const drafts = (await listPeriods(ctx, project.id)).filter((p) => p.status === 'draft' && p.revision === 1).map((d) => ({ id: d.id, label: d.label }));
    const [shares] = await getDb().select({ active: sql<number>`count(*) filter (where ${schema.statementShares.revokedAt} is null and ${schema.statementShares.expiresAt} > now())::int`, purgeable: sql<number>`count(*) filter (where ${schema.statementShares.ciphertext} is not null and (${schema.statementShares.revokedAt} is not null or ${schema.statementShares.expiresAt} <= now()))::int` }).from(schema.statementShares).innerJoin(schema.statements, and(eq(schema.statements.id, schema.statementShares.statementId), eq(schema.statements.projectId, project.id)));
    return { project, drafts, shares: { active: shares?.active ?? 0, purgeable: shares?.purgeable ?? 0 } };
  }),
  'settings.settlement': defineView('unlocked', async (ctx, q) => ({ project: await requireProjectApi(ctx, q.get('projectId')), network: networkLabel() })),
  /** Sessions are listed by what the owner needs to recognise them; token hashes never leave the API. */
  'settings.security': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const sessions = await getDb().select({ id: schema.sessions.id, userAgent: schema.sessions.userAgent, createdAt: schema.sessions.createdAt, expiresAt: schema.sessions.expiresAt }).from(schema.sessions).where(and(eq(schema.sessions.ownerId, ctx.ownerId), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.lastUsedAt));
    const [settings] = await getDb().select().from(schema.systemSettings).where(eq(schema.systemSettings.id, 1));
    return { project, sessions, currentSessionId: ctx.sessionId, autoLockMinutes: settings?.autoLockMinutes ?? 15 };
  }),
  'settings.integrations': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const health = await walletHealth({ minConf: project.minConfirmations });
    return { project, health, wallet: walletSummary(health) };
  }),
  'settings.project': defineView('unlocked', async (ctx, q) => ({ project: await requireProjectApi(ctx, q.get('projectId')) })),
};
