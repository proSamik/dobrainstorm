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
    unoptimized: true, // Disable image optimization to serve static images directly
  },
  // Enable static exports for blog images
  output: 'standalone',
  
  // Add rewrite rule for direct blog image access
  async rewrites() {
    return [
      {
        source: '/blog/posts/images/:path*',
        destination: '/blog/posts/images/:path*'
      }
    ];
  }
};

export default nextConfig;
