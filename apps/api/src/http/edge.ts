import { constantTimeEqual } from '@setrya/security';
import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from './app-env';

export const EDGE_KEY_HEADER = 'x-setrya-edge-key';
export const CLIENT_IP_HEADER = 'x-setrya-client-ip';

/**
 * The API only answers the web tier. The web tier proves itself with a shared key and reports the browser's address,
 * which is the only client address the API trusts (for rate limiting and audit).
 */
export function requireEdge(edgeKey: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const presented = c.req.header(EDGE_KEY_HEADER) ?? '';
    if (!constantTimeEqual(presented, edgeKey)) {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'This endpoint is not public.', canRetry: false } }, 403);
    }
    c.set('clientIp', c.req.header(CLIENT_IP_HEADER)?.slice(0, 64) || 'unknown');
    await next();
  };
}
