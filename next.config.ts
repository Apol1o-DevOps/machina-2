import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
  // Server code runs under tsx server.ts; the next build only needs the client+SSR bundles.
  outputFileTracingIncludes: {
    '/**': ['./lib/core/**'],
  },
};

export default nextConfig;
