import { clientIpFrom, upstream, type UpstreamTarget } from './upstream';

/**
 * Browser calls are relayed to an API. Only headers the API reads go up; only what the browser needs comes back. The
 * sandbox relay never forwards cookies, so an operator's session can never reach the public sandbox.
 */
const FORWARD_REQUEST: Record<UpstreamTarget, string[]> = {
  main: ['accept', 'content-type', 'cookie', 'origin', 'user-agent', 'x-setrya-request'],
  sandbox: ['accept', 'content-type', 'origin', 'user-agent', 'x-setrya-request'],
};
const FORWARD_RESPONSE = ['cache-control', 'content-disposition', 'content-type'];
const MAX_BODY_BYTES = 4 * 1024 * 1024;

type Relay = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

export function createRelay(target: UpstreamTarget): Relay {
  return async function relay(req: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
    const { path } = await params;
    const url = new URL(req.url);
    const headers = new Headers();
    for (const name of FORWARD_REQUEST[target]) {
      const value = req.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.arrayBuffer();
    if (body && body.byteLength > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Upload is too large.', canRetry: false } }, { status: 413 });
    }
    try {
      const res = await upstream({ method: req.method, path: `/api/v1/${path.map(encodeURIComponent).join('/')}${url.search}`, headers, body, clientIp: clientIpFrom(req.headers) }, target);
      const out = new Headers();
      for (const name of FORWARD_RESPONSE) {
        const value = res.headers.get(name);
        if (value !== null) out.set(name, value);
      }
      if (target === 'main') for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie);
      return new Response(await res.arrayBuffer(), { status: res.status, headers: out });
    } catch (error) {
      console.error('api.relay_failed', error instanceof Error ? error.message : 'unknown');
      return Response.json({ ok: false, error: { code: 'INTERNAL', message: 'The settlement server is not reachable. Try again in a moment.', canRetry: true } }, { status: 502 });
    }
  };
}
