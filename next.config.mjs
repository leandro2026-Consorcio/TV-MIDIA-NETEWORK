/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/internal/apply-organic-network': [
        './supabase/migrations/20260907000050_screen_device_types.sql',
        './supabase/migrations/20260907000060_monitor_credit_ratio.sql',
        './supabase/migrations/20260907000070_organic_network.sql',
      ],
    },
  },
};

export default nextConfig;
