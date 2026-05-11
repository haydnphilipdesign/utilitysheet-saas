import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data: https:; font-src 'self' data:;",
  },
  ...(isProduction
    ? [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
    ]
    : []),
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  outputFileTracingIncludes: {
    '/api/seller/**': ['node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/packet/**/pdf': ['node_modules/@sparticuz/chromium/bin/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/_next/server/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/_next/server/:path*',
        destination: '/404',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
