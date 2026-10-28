import { getDb, schema, eq, and, isNull, notInArray } from '@setrya/db';

import { requireProjectApi } from '../services/projects';
import { receiveAddress } from '../services/receive';
import { networkLabel, walletSummary } from '../services/shell';
import { walletHealth } from '../services/wallet';
import { walletTransactions } from '../services/wallet-activity';

import { defineView } from './define';

const MAX_TRANSACTIONS = 100;

export const walletViews = {
  'wallet.overview': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const health = await walletHealth({ minConf: project.minConfirmations });
    const receive = health.account.found ? await receiveAddress() : null;
    const reserved = await getDb()
      .select({ zat: schema.payoutIntents.amountZat })
      .from(schema.payoutIntents)
      .innerJoin(schema.approvals, and(eq(schema.approvals.id, schema.payoutIntents.approvalId), isNull(schema.approvals.invalidatedAt)))
      .innerJoin(schema.periods, eq(schema.periods.id, schema.payoutIntents.periodId))
      .where(and(eq(schema.periods.projectId, project.id), notInArray(schema.payoutIntents.state, ['confirmed', 'failed', 'cancelled', 'superseded', 'broadcast', 'mempool', 'confirming'])));
    const reservedZat = reserved.reduce((s, r) => s + r.zat, 0n);
    return { project, health, receive, reservedZat, summary: walletSummary(health), network: networkLabel() };
  }),
  'wallet.activity': defineView('unlocked', async (ctx, q) => ({ project: await requireProjectApi(ctx, q.get('projectId')) })),
  'wallet.transactions': defineView('unlocked', async (_ctx, q) => {
    const limit = Number(q.optional('limit') ?? 10);
    return walletTransactions(Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_TRANSACTIONS) : 10);
  }),
};
