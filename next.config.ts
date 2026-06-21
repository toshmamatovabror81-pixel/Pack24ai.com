import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint — build paytida warninglarni ko'rsatadi (xatolar build'ni to'xtatadi)
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Image optimization — trusted domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'pack24.uz' },
      { protocol: 'https', hostname: 'pack24.ru' },
      { protocol: 'https', hostname: '**.pack24.ru' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Supabase Storage
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      // Telegram CDN
      { protocol: 'https', hostname: 'api.telegram.org' },
      { protocol: 'https', hostname: '**.telegram.org' },
      // Local dev
      { protocol: 'http',  hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security & performance headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          // ── Yangi xavfsizlik headerlari ─────────────────────────────
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http://localhost:*",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://api.telegram.org https://*.supabase.co https://*.supabase.in https://www.google-analytics.com https://generativelanguage.googleapis.com https://image.pollinations.ai wss:",
              "media-src 'self' https://*.supabase.co https://*.supabase.in",
              "frame-src 'self' https://www.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          { key: 'X-DNS-Prefetch-Control',       value: 'on' },
          { key: 'Cross-Origin-Opener-Policy',    value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy',  value: 'same-origin' },
        ],
      },
      {
        // Cache static assets
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Compiler optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  // Bundle size + `src/instrumentation.ts` Next 15 da fayl mavjud boʻlsa avtomatik ishlaydi
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Trailing slash consistency
  trailingSlash: false,

  // External packages that should not be bundled (Node.js only)
  serverExternalPackages: ["telegraf", "safe-compare"],

  webpack: (config, { isServer, nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        telegraf: false,
        'safe-compare': false,
      };
    }
    return config;
  },
};

export default nextConfig;
