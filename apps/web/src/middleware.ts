import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request nonce CSP. Scripts run only with the nonce, nothing loads from third parties, and the app cannot be
 * framed. Recipient statement pages additionally refuse to send a referrer, so a link's #key never leaks.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  if (req.nextUrl.pathname.startsWith('/r/') || req.nextUrl.pathname.startsWith('/try/r/')) {
    res.headers.set('referrer-policy', 'no-referrer');
    res.headers.set('cache-control', 'no-store');
  }
  return res;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|templates/).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
