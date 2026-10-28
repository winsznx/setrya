import { Hono } from 'hono';

import type { AppEnv } from './http/app-env';
import { requireEdge } from './http/edge';
import { registerRoutes } from './routes';
import { registerViews } from './views';

export function createApp(edgeKey: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.use('/api/*', requireEdge(edgeKey));
  registerRoutes(app);
  registerViews(app);
  app.notFound((c) => c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found.', canRetry: false } }, 404));
  return app;
}
