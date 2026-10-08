import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Build vaqtida emas, so'rov kelganda yasaladi: SITE_ENV va APP_URL .env dan o'qiladi
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // SITE_ENV=staging bo'lsa sayt indekslanmaydi
  const isProd = (process.env.SITE_ENV || process.env.VERCEL_ENV || 'production') === 'production';
  if (!isProd) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/*/cart', '/*/checkout', '/*/profile', '/*/orders/', '/*/login', '/*/register', '/*?q=', '/*?sort='],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
