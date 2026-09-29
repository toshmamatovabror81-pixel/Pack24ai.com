import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pack24.uz';

export default function robots(): MetadataRoute.Robots {
    return {
        // Bitta umumiy guruh: alohida Googlebot guruhi `*` qoidalarini bekor qilib
        // yuborardi. /_next/ ochiq qoladi, aks holda qidiruv tizimlari JS/CSS ni ko'rmaydi.
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin',
                    '/api/',
                    '/profile',
                    '/cart',
                    '/checkout',
                    '/my-orders',
                    '/orders',
                    '/terminal',
                    '/driver',
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
