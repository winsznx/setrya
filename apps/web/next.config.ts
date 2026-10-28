import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@setrya/domain'],
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    ];
    if (process.env.NODE_ENV === 'production') base.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
    return [
      { source: '/:path*', headers: base },
      { source: '/(app|r|print|onboarding|unlock|api)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default config;
