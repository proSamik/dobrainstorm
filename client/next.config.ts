import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mapyourideas.com',
      },
      {
        protocol: 'https',
        hostname: 'backendserver.mapyourideas.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Enable static exports for blog images
  output: 'standalone',
};

export default nextConfig;
