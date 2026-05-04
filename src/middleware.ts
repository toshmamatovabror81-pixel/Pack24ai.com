import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';

const ADMIN_LOGIN_PATH = '/admin/login';
const ADMIN_PATHS = ['/admin'];
const PUBLIC_ADMIN_PATHS = ['/admin/login'];
// Login API ni himoyadan istisno qilamiz — token hali yo'q bo'lganda ham ishlashi kerak
const PUBLIC_ADMIN_API_PATHS = ['/api/admin/login', '/api/admin/logout'];

async function isValidAdminToken(token: string): Promise<boolean> {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return false;
    const validation = await validateAdminToken(token, secret);
    return validation.valid;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
    const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((path) =>
        pathname.startsWith(path)
    );

    // ── Admin sahifalari himoyasi ─────────────────────────────────────────
    if (isAdminPath && !isPublicAdminPath) {
        const adminToken = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;

        if (!adminToken || !(await isValidAdminToken(adminToken))) {
            const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
            loginUrl.searchParams.set('from', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // ── Admin API'lari himoyasi ───────────────────────────────────────────
    const isAdminApi =
        pathname.startsWith('/api/admin') ||
        pathname.startsWith('/api/warehouse') ||
        pathname.startsWith('/api/production') ||
        pathname.startsWith('/api/marketing');

    const isPublicAdminApi = PUBLIC_ADMIN_API_PATHS.some((path) =>
        pathname.startsWith(path)
    );

    if (isAdminApi && !isPublicAdminApi) {
        const adminToken = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
        const authHeader = request.headers.get(ADMIN_AUTH_HEADER);

        const cookieValid = adminToken && (await isValidAdminToken(adminToken));
        const headerValid = authHeader && (await isValidAdminToken(authHeader));

        if (!cookieValid && !headerValid) {
            return NextResponse.json(
                { error: "Ruxsat yo'q. Tizimga kirishingiz kerak." },
                { status: 401 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*',
        '/api/warehouse/:path*',
        '/api/production/:path*',
        '/api/marketing/:path*',
    ],
};
