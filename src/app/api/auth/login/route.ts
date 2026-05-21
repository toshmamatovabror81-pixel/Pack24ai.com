import { NextResponse } from 'next/server';

/**
 * Legacy endpoint — DEPRECATED va o'chirilgan.
 *
 * Eski browser auth bu yo'l orqali ishlardi. Yangi tizimda barcha auth NextAuth
 * orqali ishlaydi: POST /api/auth/callback/credentials yoki client'da
 * `signIn('credentials', { phone, password })`.
 *
 * Bu stub `410 Gone` qaytaradi va eski klientlarni yangi sirtga yo'naltiradi.
 */
const GONE_BODY = {
    error: 'Bu endpoint o\'chirilgan',
    code: 'AUTH_LEGACY_GONE',
    message:
        "Yangi auth: NextAuth credentials provider. Iltimos /api/auth/callback/credentials ishlatlng yoki signIn('credentials', ...) chaqiring.",
    documentation: 'docs/auth-and-runtime-flows.md',
} as const;

export async function POST() {
    return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function GET() {
    return NextResponse.json(GONE_BODY, { status: 410 });
}
