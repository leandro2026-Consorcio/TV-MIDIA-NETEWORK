import { readFileSync } from 'node:fs';

const packageMetadata = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const playerCommit = process.env.VERCEL_GIT_COMMIT_SHA || 'development';
const nextRuntimeVersion = String(packageMetadata.dependencies.next).replace(/^[~^]/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_MPM_PLAYER_VERSION: process.env.MPM_PLAYER_VERSION || packageMetadata.version,
    NEXT_PUBLIC_MPM_PLAYER_BUILD: process.env.MPM_PLAYER_BUILD || process.env.VERCEL_DEPLOYMENT_ID || playerCommit,
    NEXT_PUBLIC_MPM_PLAYER_COMMIT: playerCommit,
    NEXT_PUBLIC_MPM_PLAYER_RUNTIME: `web-next-${nextRuntimeVersion}`,
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/downloads/windows-monitor': ['./windows-monitor/Install-MidiaMonitor.ps1'],
      '/api/internal/:path*': ['./supabase/migrations/**'],
    },
  },
};

export default nextConfig;
