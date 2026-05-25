/**
 * NextAuth v4 API route handler
 * GET & POST /api/auth/[...nextauth]
 *
 * POST so'rovlariga rate limiting qo'shilgan — brute-force himoyasi.
 */
import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

const authHandler = NextAuth(authOptions);

async function handler(req: NextRequest) {
    // POST so'rovlari uchun rate limiting (login urinishlari)
    if (req.method === 'POST') {
        const limited = await rateLimit(req, {
            bucket: 'nextauth-login',
            limit: 10,
            windowMs: 5 * 60_000, // 5 daqiqada 10 urinish
        });
        if (!limited.ok) return limited.response;
    }
    return authHandler(req);
}

export { handler as GET, handler as POST };
