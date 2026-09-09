/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/downloads/windows-monitor': ['./windows-monitor/Install-MidiaMonitor.ps1'],
      '/api/internal/:path*': ['./supabase/migrations/**'],
    },
  },
};

export default nextConfig;
