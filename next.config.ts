import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://mc.yandex.ru https://mc.yandex.com https://yastatic.net https://www.googletagmanager.com https://www.google-analytics.com https://telegram.org`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.supabase.co",
  "frame-src 'self' https://yandex.uz https://yandex.ru https://www.google.com https://mc.yandex.ru https://mc.yandex.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.paycom.uz https://my.click.uz",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'pack24.uz' },
      // Hozirgi katalog rasmlari shu yerdan (admin orqali o'z rasmlaringiz bilan almashtiriladi)
      { protocol: 'https', hostname: 'pack24.ru' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
