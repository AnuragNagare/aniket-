import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship compiled JS, but let Next transpile them for consistent output.
  transpilePackages: ['@worktrail/types', '@worktrail/ui'],
};

export default nextConfig;
