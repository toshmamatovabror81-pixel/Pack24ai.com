/**
 * Auth guard'lar — Next.js API route'lari va Server Component'lar uchun
 * yagona auth tekshiruvi.
 *
 * Avval har bir route o'zicha NextAuth session yoki admin cookie'ni qo'lda
 * tekshirardi. P1.3 audit bo'yicha shu joydan markazlashtirildi.
 *
 * Foydalanish:
 *   const guard = await requireUser();
 *   if (!guard.ok) return guard.response;
 *   const { user } = guard;
 *
 *   const guard = await requireAdmin(request);
 *   if (!guard.ok) return guard.response;
 *
 *   const guard = await requireRole(['admin', 'manager']);
 *   if (!guard.ok) return guard.response;
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';
import { getAdminSecret, MissingSecretError } from '@/lib/auth/tokenSecrets';

export type UserGuardSuccess = {
    ok: true;
    session: Session;
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string;
        phone?: string;
    };
};

export type AdminGuardSuccess = {
    ok: true;
    source: 'cookie' | 'header';
};

export type GuardFailure = {
    ok: false;
    response: NextResponse;
    reason: 'no_session' | 'inactive' | 'forbidden' | 'no_admin_token' | 'invalid_admin_token' | 'misconfig';
};

function jsonError(message: string, status: number, code?: string): NextResponse {
    return NextResponse.json({ error: message, code }, { status });
}

/**
 * NextAuth session bilan kelgan foydalanuvchini tekshiradi.
 * Session bo'lmasa 401 qaytaradi.
 */
export async function requireUser(): Promise<UserGuardSuccess | GuardFailure> {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return {
            ok: false,
            reason: 'no_session',
            response: jsonError('Tizimga kirishingiz kerak', 401, 'AUTH_REQUIRED'),
        };
    }

    const u = session.user as Record<string, unknown>;
    return {
        ok: true,
        session,
        user: {
            id: String(u.id ?? ''),
            name: (u.name as string | null) ?? null,
            email: (u.email as string | null) ?? null,
            role: (u.role as string | undefined) ?? 'user',
            phone: (u.phone as string | undefined) ?? '',
        },
    };
}

/**
 * Foydalanuvchi tizimda + ma'lum role bilan bo'lishi shart.
 */
export async function requireRole(
    allowed: ReadonlyArray<string>
): Promise<UserGuardSuccess | GuardFailure> {
    const result = await requireUser();
    if (!result.ok) return result;

    const role = result.user.role ?? 'user';
    if (!allowed.includes(role)) {
        return {
            ok: false,
            reason: 'forbidden',
            response: jsonError(
                "Bu amal uchun ruxsat yo'q",
                403,
                'FORBIDDEN'
            ),
        };
    }

    return result;
}

/**
 * Admin HMAC token tekshiruvi (cookie yoki header).
 * Middleware ham xuddi shunday tekshiruvni amalga oshiradi; bu route ichida
 * `getServerSession` aralashmasdan haqiqiy admin'ligini tasdiqlash uchun.
 */
export async function requireAdmin(
    request: NextRequest | Request
): Promise<AdminGuardSuccess | GuardFailure> {
    let adminSecret: string;
    try {
        adminSecret = getAdminSecret();
    } catch (error) {
        if (error instanceof MissingSecretError) {
            return {
                ok: false,
                reason: 'misconfig',
                response: jsonError(
                    'Server admin secret sozlanmagan',
                    500,
                    'ADMIN_SECRET_MISSING'
                ),
            };
        }
        throw error;
    }

    const cookie = request instanceof Request
        ? extractCookieFromHeader(request.headers.get('cookie'), ADMIN_AUTH_COOKIE)
        : (request as NextRequest).cookies.get(ADMIN_AUTH_COOKIE)?.value;

    if (cookie) {
        const v = await validateAdminToken(cookie, adminSecret);
        if (v.valid) {
            return { ok: true, source: 'cookie' };
        }
    }

    const header = request.headers.get(ADMIN_AUTH_HEADER);
    if (header) {
        const v = await validateAdminToken(header, adminSecret);
        if (v.valid) {
            return { ok: true, source: 'header' };
        }
        return {
            ok: false,
            reason: 'invalid_admin_token',
            response: jsonError('Admin token noto\'g\'ri yoki muddati o\'tgan', 401, 'ADMIN_TOKEN_INVALID'),
        };
    }

    if (!cookie) {
        return {
            ok: false,
            reason: 'no_admin_token',
            response: jsonError("Admin sifatida kirishingiz kerak", 401, 'ADMIN_AUTH_REQUIRED'),
        };
    }

    return {
        ok: false,
        reason: 'invalid_admin_token',
        response: jsonError('Admin token noto\'g\'ri yoki muddati o\'tgan', 401, 'ADMIN_TOKEN_INVALID'),
    };
}

/**
 * `Cookie:` header'idan ma'lum cookie qiymatini chiqaradi.
 * `Request` (NextAuth Web Request) uchun ishlatiladi —
 * `NextRequest` da `cookies.get` mavjud bo'ladi.
 */
function extractCookieFromHeader(
    cookieHeader: string | null,
    name: string
): string | undefined {
    if (!cookieHeader) return undefined;
    const parts = cookieHeader.split(';');
    for (const raw of parts) {
        const [k, ...rest] = raw.trim().split('=');
        if (k === name) return rest.join('=');
    }
    return undefined;
}

/**
 * Admin yoki authenticated user — ikkalasidan biri ham bo'lsa o'tadi.
 * Upload va shunga o'xshash umumiy route'lar uchun.
 */
export async function requireAdminOrUser(
    request: NextRequest | Request
): Promise<{ ok: true; kind: 'admin' | 'user' } | GuardFailure> {
    const admin = await requireAdmin(request);
    if (admin.ok) return { ok: true, kind: 'admin' };

    const user = await requireUser();
    if (user.ok) return { ok: true, kind: 'user' };

    return {
        ok: false,
        reason: 'no_session',
        response: jsonError('Avtorizatsiya talab etiladi', 401, 'AUTH_REQUIRED'),
    };
}
