import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.HOSTINGER === 'true' ? { output: 'export' as const } : {}),
  allowedDevOrigins: ['127.0.0.1', '192.168.0.108', '*.loca.lt', '*.lhr.life', '*.localhost.run', '*.serveo.net'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  // HOSTINGER=true serves /api same-origin via server.js — omit rewrites entirely,
  // since Next flags rewrites+export combos and trips deploy checks
  ...(process.env.HOSTINGER === 'true' ? {} : {
    rewrites: async () => {
      const apiBase = process.env.API_URL || 'http://localhost:4000';
      return [
        {
          source: '/api/:path*',
          destination: `${apiBase}/api/:path*`,
        },
        {
          source: '/socket.io/:path*',
          destination: `${apiBase}/socket.io/:path*`,
        },
        {
          source: '/health',
          destination: `${apiBase}/health`,
        },
        {
          source: '/ready',
          destination: `${apiBase}/ready`,
        },
        {
          source: '/api-docs/:path*',
          destination: `${apiBase}/api-docs/:path*`,
        },
      ];
    },
  }),
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
