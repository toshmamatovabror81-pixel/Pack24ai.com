/**
 * Unified auth guard helpers for API routes.
 *
 * Usage:
 * ```ts
 * import { requireUser, requireAdmin, requireRole } from '@/lib/auth/guards';
 *
 * export async function GET(req: NextRequest) {
 *     const session = await requireUser(req); // throws AuthError → 401
 *     // ...
 * }
 *
 * export async function POST(req: NextRequest) {
 *     await requireAdmin(req); // throws AuthError → 401
 *     // ...
 * }
 * ```
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthSession {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    phone: string;
}

export class AuthError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 401,
    ) {
        super(message);
        this.name = 'AuthError';
    }

    /** Convert to NextResponse for use in catch blocks */
    toResponse(): NextResponse {
        return NextResponse.json(
            { error: this.message },
            { status: this.statusCode },
        );
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Require an authenticated user (NextAuth session).
 * Returns the session user info or throws AuthError.
 */
export async function requireUser(_req?: NextRequest): Promise<AuthSession> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new AuthError('Avtorizatsiya talab etiladi');
    }

    const user = session.user as Record<string, unknown>;
    return {
        id: (user.id as string) ?? '',
        name: (user.name as string) ?? null,
        email: (user.email as string) ?? null,
        role: (user.role as string) ?? 'user',
        phone: (user.phone as string) ?? '',
    };
}

/**
 * Require admin authentication (HMAC cookie or header).
 * Throws AuthError if not authenticated or token is invalid/expired.
 */
export async function requireAdmin(req: NextRequest): Promise<void> {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
        throw new AuthError('Server konfiguratsiya xatosi', 500);
    }

    const token =
        req.cookies.get(ADMIN_AUTH_COOKIE)?.value ??
        req.headers.get(ADMIN_AUTH_HEADER);

    if (!token) {
        throw new AuthError('Avtorizatsiya talab etiladi');
    }

    const validation = await validateAdminToken(token, adminSecret);
    if (!validation.valid) {
        if (validation.reason === 'expired') {
            throw new AuthError('Sessiya muddati tugagan. Qaytadan kiring.');
        }
        throw new AuthError("Noto'g'ri yoki buzilgan admin token");
    }
}

/**
 * Require an authenticated user with one of the given roles.
 * Returns the session if the user has a matching role, throws otherwise.
 */
export async function requireRole(
    _req: NextRequest,
    allowedRoles: string[],
): Promise<AuthSession> {
    const session = await requireUser(_req);

    if (!allowedRoles.includes(session.role)) {
        throw new AuthError("Bu amal uchun ruxsat yo'q", 403);
    }

    return session;
}

/**
 * Require either a NextAuth session OR admin HMAC token.
 * Useful for routes that both regular users and admins can access (e.g., upload).
 */
export async function requireUserOrAdmin(req: NextRequest): Promise<AuthSession | 'admin'> {
    // Try NextAuth first
    const session = await getServerSession(authOptions);
    if (session?.user) {
        const user = session.user as Record<string, unknown>;
        return {
            id: (user.id as string) ?? '',
            name: (user.name as string) ?? null,
            email: (user.email as string) ?? null,
            role: (user.role as string) ?? 'user',
            phone: (user.phone as string) ?? '',
        };
    }

    // Try admin HMAC token
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
        const token =
            req.cookies.get(ADMIN_AUTH_COOKIE)?.value ??
            req.headers.get(ADMIN_AUTH_HEADER);

        if (token) {
            const v = await validateAdminToken(token, adminSecret);
            if (v.valid) return 'admin';
        }
    }

    throw new AuthError('Avtorizatsiya talab etiladi');
}

// ── Convenience wrapper ───────────────────────────────────────────────────

/**
 * Wrap an async handler with automatic AuthError catching.
 * Returns the appropriate error response if auth fails.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req) => {
 *     const session = await requireUser(req);
 *     return NextResponse.json({ data: ... });
 * });
 * ```
 */
export function withAuth(
    handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
    return async (req: NextRequest) => {
        try {
            return await handler(req);
        } catch (error) {
            if (error instanceof AuthError) {
                return error.toResponse();
            }
            throw error;
        }
    };
}
