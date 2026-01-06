import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Disable telemetry
  experimental: {
    // Enable server actions
  },
};

export default nextConfig;
