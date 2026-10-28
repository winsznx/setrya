import { listAgreements } from '../services/agreements';
import { listPartners } from '../services/partners';
import { defaultProject } from '../services/projects';
import { receiveAddress } from '../services/receive';
import { setupStatus } from '../services/setup-status';
import { networkLabel } from '../services/shell';
import { listSources } from '../services/sources';
import { walletHealth } from '../services/wallet';

import { defineView } from './define';

export const onboardingViews = {
  'onboarding.layout': defineView('unlocked', async () => ({ network: networkLabel() })),
  'onboarding.hub': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    const status = await setupStatus(project?.id ?? null, await walletHealth());
    return { project, status };
  }),
  'onboarding.workspace': defineView('unlocked', async (ctx) => ({ project: await defaultProject(ctx), ownerTimezone: ctx.timezone })),
  'onboarding.source': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    return { project, sources: project ? await listSources(ctx, project.id) : [] };
  }),
  'onboarding.import': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    return { project, sources: project ? (await listSources(ctx, project.id)).filter((s) => s.enabled) : [] };
  }),
  'onboarding.partner': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    return { project, partners: project ? await listPartners(ctx, project.id) : [], network: networkLabel() };
  }),
  'onboarding.agreement': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    if (!project) return { project, partners: [], sources: [], agreements: [] };
    const [partners, sources, agreements] = await Promise.all([listPartners(ctx, project.id), listSources(ctx, project.id), listAgreements(ctx, project.id)]);
    return { project, partners, sources, agreements };
  }),
  'onboarding.wallet': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    if (!project) return { project, health: null, receive: null };
    const health = await walletHealth({ minConf: project.minConfirmations });
    const receive = health.account.found ? await receiveAddress() : null;
    return { project, health, receive };
  }),
  'onboarding.ready': defineView('unlocked', async (ctx) => {
    const project = await defaultProject(ctx);
    if (!project) return { project, status: null, sources: [], partners: [], agreements: [] };
    const health = await walletHealth({ minConf: project.minConfirmations });
    const [status, sources, partners, agreements] = await Promise.all([setupStatus(project.id, health), listSources(ctx, project.id), listPartners(ctx, project.id), listAgreements(ctx, project.id)]);
    return { project, status, sources, partners, agreements };
  }),
};
