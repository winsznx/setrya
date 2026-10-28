import type { Hono } from 'hono';

import type { AppEnv } from '../http/app-env';
import { ApiError, view, type Auth } from '../http/route';

import { agreementsViews } from './agreements';
import type { ViewDefinition, ViewQuery } from './define';
import { onboardingViews } from './onboarding';
import { partnersViews } from './partners';
import { paymentsViews } from './payments';
import { periodsViews } from './periods';
import { revenueViews } from './revenue';
import { settingsViews } from './settings';
import { shellViews } from './shell';
import { statementsViews } from './statements';
import { walletViews } from './wallet';

/** Data each server-rendered page needs, by name. Loaders keep the server's types so pages render the same values. */
export const VIEWS = {
  ...shellViews,
  ...onboardingViews,
  ...settingsViews,
  ...walletViews,
  ...periodsViews,
  ...paymentsViews,
  ...revenueViews,
  ...agreementsViews,
  ...statementsViews,
  ...partnersViews,
} satisfies Record<string, ViewDefinition<Auth, unknown>>;

export type ViewName = keyof typeof VIEWS;
export type ViewData<N extends ViewName> = Awaited<ReturnType<(typeof VIEWS)[N]['load']>>;

function queryFrom(url: string): ViewQuery {
  const params = new URL(url).searchParams;
  return {
    get(name) {
      const value = params.get(name);
      if (!value) throw new ApiError('INVALID_INPUT', `Missing ${name}.`);
      return value;
    },
    optional(name) {
      return params.get(name) ?? undefined;
    },
  };
}

export function registerViews(app: Hono<AppEnv>): void {
  app.get('/api/v1/views/:name', (c) => {
    const name = c.req.param('name');
    if (!Object.hasOwn(VIEWS, name)) return Promise.resolve(c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Unknown view.', canRetry: false } }, 404));
    const definition = VIEWS[name as ViewName] as ViewDefinition<Auth, unknown>;
    return view(definition.auth, (req, ctx) => definition.load(ctx, queryFrom(req.url)))(c);
  });
}
