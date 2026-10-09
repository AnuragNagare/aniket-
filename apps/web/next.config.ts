import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  // Workspace packages ship compiled JS, but let Next transpile them for consistent output.
  transpilePackages: ['@worktrail/types', '@worktrail/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.cartocdn.com https://tiles.basemaps.cartocdn.com",
              "connect-src 'self' https://*.cartocdn.com https://tiles.basemaps.cartocdn.com https://*.ingest.sentry.io https://*.sentry.io",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
