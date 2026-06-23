import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';
import { verifyDriverToken } from '@/lib/auth/verifyDriverToken';
import { childLogger } from '@/lib/logger';
import { AUTH_ERROR_CODES } from '@/lib/auth/errorCodes';
import { getAdminSecret, MissingSecretError } from '@/lib/auth/tokenSecrets';

const log = childLogger({ module: 'auth-guards' });

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

function getCookieFromRequest(req: Request, name: string): string | null {
    // NextRequest cookies structure
    if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
        return (req as any).cookies.get(name)?.value ?? null;
    }

    // Fallback: parse headers manually for raw Request (e.g. in tests)
    const cookieHeader = req.headers?.get('cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => {
        const parts = c.trim().split('=');
        return [parts[0], parts.slice(1).join('=')];
    });
    const match = cookies.find(([k]) => k === name);
    return match ? match[1] : null;
}

export type GuardResult<T> =
    | { ok: true; user: T; session: any }
    | { ok: false; reason: string; response: NextResponse };

export async function requireUser(_req?: Request | NextRequest): Promise<
    | { ok: true; user: AuthSession; session: any }
    | { ok: false; reason: 'no_session'; response: NextResponse }
> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        log.warn('requireUser: No active session');
        return {
            ok: false,
            reason: 'no_session',
            response: NextResponse.json(
                { error: 'Tizimga kirishingiz kerak', code: AUTH_ERROR_CODES.AUTH_REQUIRED },
                { status: 401 }
            ),
        };
    }

    const user = session.user as Record<string, unknown>;
    return {
        ok: true,
        user: {
            id: (user.id as string) ?? '',
            name: (user.name as string) ?? null,
            email: (user.email as string) ?? null,
            role: (user.role as string) ?? 'user',
            phone: (user.phone as string) ?? '',
        },
        session,
    };
}

export type AdminGuardResult =
    | { ok: true; source: 'cookie' | 'header' }
    | { ok: false; reason: 'no_admin_token' | 'invalid_admin_token' | 'misconfig'; response: NextResponse };

export async function requireAdmin(req: Request | NextRequest): Promise<AdminGuardResult> {
    let adminSecret: string;
    try {
        adminSecret = getAdminSecret();
    } catch (err) {
        if (err instanceof MissingSecretError) {
            log.error('requireAdmin: ADMIN_SECRET env not set');
            return {
                ok: false,
                reason: 'misconfig',
                response: NextResponse.json(
                    { error: 'Server konfiguratsiya xatosi', code: AUTH_ERROR_CODES.ADMIN_SECRET_MISSING },
                    { status: 500 }
                ),
            };
        }
        throw err;
    }

    const token =
        getCookieFromRequest(req, ADMIN_AUTH_COOKIE) ??
        req.headers?.get(ADMIN_AUTH_HEADER);

    if (!token) {
        log.warn('requireAdmin: Token missing');
        return {
            ok: false,
            reason: 'no_admin_token',
            response: NextResponse.json(
                { error: 'Avtorizatsiya talab etiladi', code: AUTH_ERROR_CODES.ADMIN_AUTH_REQUIRED },
                { status: 401 }
            ),
        };
    }

    const source = getCookieFromRequest(req, ADMIN_AUTH_COOKIE) === token ? 'cookie' : 'header';
    const validation = await validateAdminToken(token, adminSecret);

    if (!validation.valid) {
        log.warn(`requireAdmin: Token invalid - reason: ${validation.reason}`);
        return {
            ok: false,
            reason: 'invalid_admin_token',
            response: NextResponse.json(
                { error: "Noto'g'ri yoki buzilgan admin token", code: AUTH_ERROR_CODES.ADMIN_TOKEN_INVALID },
                { status: 401 }
            ),
        };
    }

    return {
        ok: true,
        source,
    };
}

export async function requireRole(
    allowedRoles: string[],
    req?: Request | NextRequest,
): Promise<
    | { ok: true; user: AuthSession; session: any }
    | { ok: false; reason: 'no_session' | 'forbidden'; response: NextResponse }
> {
    const userResult = await requireUser(req);

    if (!userResult.ok) {
        return userResult;
    }

    if (!allowedRoles.includes(userResult.user.role)) {
        log.warn(`requireRole: Forbidden. User role: ${userResult.user.role}, allowed: ${allowedRoles}`);
        return {
            ok: false,
            reason: 'forbidden',
            response: NextResponse.json(
                { error: "Bu amal uchun ruxsat yo'q", code: AUTH_ERROR_CODES.FORBIDDEN },
                { status: 403 }
            ),
        };
    }

    return userResult;
}

export type DriverGuardResult =
    | { ok: true; driverId: number; driver: { id: number; name: string; phone: string; pointId: number | null; supervisorId: number | null } }
    | { ok: false; reason: 'no_session' | 'inactive' | 'invalid_token'; response: NextResponse };

export async function requireDriver(req: Request | NextRequest): Promise<DriverGuardResult> {
    const authHeader = req.headers?.get('authorization');
    const result = await verifyDriverToken(authHeader);

    if (!result.ok) {
        log.warn(`requireDriver: Failed with error: ${result.error}`);
        const reason = result.code === 'NO_TOKEN'
            ? 'no_session'
            : result.code === 'DRIVER_INACTIVE'
                ? 'inactive'
                : 'invalid_token';

        const code = result.code === 'DRIVER_INACTIVE'
            ? AUTH_ERROR_CODES.DRIVER_INACTIVE
            : AUTH_ERROR_CODES.DRIVER_AUTH_REQUIRED;

        const status = result.code === 'DRIVER_INACTIVE' ? 403 : 401;

        return {
            ok: false,
            reason,
            response: NextResponse.json(
                { error: result.error, code },
                { status }
            ),
        };
    }

    return {
        ok: true,
        driverId: result.driverId,
        driver: result.driver,
    };
}

export type AdminOrUserGuardResult =
    | { ok: true; kind: 'admin' }
    | { ok: true; kind: 'user'; user: AuthSession; session: any }
    | { ok: false; reason: 'no_session'; response: NextResponse };

export async function requireUserOrAdmin(req: Request | NextRequest): Promise<AdminOrUserGuardResult> {
    const adminResult = await requireAdmin(req);
    if (adminResult.ok) {
        return { ok: true, kind: 'admin' };
    }

    const userResult = await requireUser(req);
    if (userResult.ok) {
        return {
            ok: true,
            kind: 'user',
            user: userResult.user,
            session: userResult.session,
        };
    }

    log.warn('requireUserOrAdmin: both admin and user auth failed');
    return {
        ok: false,
        reason: 'no_session',
        response: NextResponse.json(
            { error: 'Avtorizatsiya talab etiladi', code: AUTH_ERROR_CODES.AUTH_REQUIRED },
            { status: 401 }
        ),
    };
}

export const requireAdminOrUser = requireUserOrAdmin;

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
