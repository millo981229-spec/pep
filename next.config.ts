import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tong.visitkorea.or.kr',
        pathname: '/cms/resource/**',
      },
    ],
  },
  // Keep the TypeScript API checker enabled for the installed TypeScript 5.x
  // package. Next 16 defaults to its CLI path, which cannot execute this
  // package's shell-wrapper bin with the current managed Node runtime.
  experimental: {
    useTypeScriptCli: false,
  },
  outputFileTracingIncludes: {
    '/*': ['./certs/supabase-ca.crt'],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
