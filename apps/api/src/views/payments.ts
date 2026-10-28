import type { FormulaTrail } from '@setrya/domain';

import { ApiError } from '../http/route';
import { getAgreement } from '../services/agreements';
import { getPartner, listPartners } from '../services/partners';
import { getPayout, listChainTransactions, listPayouts } from '../services/payments-view';
import { requireProjectApi } from '../services/projects';

import { defineView } from './define';

export const paymentsViews = {
  'payments.list': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const [payouts, txs, partners] = await Promise.all([listPayouts(ctx, project.id), listChainTransactions(project.id), listPartners(ctx, project.id)]);
    return { project, payouts, txs, partners };
  }),

  'payments.detail': defineView('unlocked', async (ctx, q) => {
    const project = await requireProjectApi(ctx, q.get('projectId'));
    const d = await getPayout(ctx, project.id, q.get('paymentId'));
    if (!d) throw new ApiError('NOT_FOUND', 'This payment does not exist.');
    const [partner, agreement] = await Promise.all([getPartner(ctx, project.id, d.intent.partnerId), getAgreement(ctx, project.id, d.row.agreementId)]);
    const formula = ctx.cipher.decJson<FormulaTrail>('calculation_rows', d.row.id, 'formula', d.row.formulaEnc);
    return { project, d, partner, agreement, formula };
  }),
};
