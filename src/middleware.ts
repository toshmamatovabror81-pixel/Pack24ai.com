import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';
import { WEBVIEW_SOURCE_HEADER, WEBVIEW_SOURCE_VALUE } from '@/lib/webview';

const ADMIN_LOGIN_PATH = '/admin/login';
const ADMIN_PATHS = ['/admin'];
const PUBLIC_ADMIN_PATHS = ['/admin/login'];
// Login API ni himoyadan istisno qilamiz — token hali yo'q bo'lganda ham ishlashi kerak
const PUBLIC_ADMIN_API_PATHS = ['/api/admin/login', '/api/admin/logout'];

const DEFAULT_ALLOWED_ORIGINS = [
    'https://pack24.uz',
    'https://www.pack24.uz',
    'https://pack24.ru',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

function getAllowedOrigins(): string[] {
    const fromEnv = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const merged = [...(fromEnv ?? DEFAULT_ALLOWED_ORIGINS)];
    if (appUrl && !merged.includes(appUrl)) {
        merged.push(appUrl);
    }
    return merged;
}

function requiresAdminApiAuth(pathname: string, method: string): boolean {
    if (
        pathname.startsWith('/api/admin') ||
        pathname.startsWith('/api/warehouse') ||
        pathname.startsWith('/api/production') ||
        pathname.startsWith('/api/marketing')
    ) {
        return true;
    }

    if (pathname === '/api/scrape' && method === 'POST') {
        return true;
    }

    if (pathname.startsWith('/api/products/bulk-')) {
        return true;
    }

    if (pathname === '/api/products' && method === 'POST') {
        return true;
    }

    if (/^\/api\/products\/\d+$/.test(pathname) && ['PUT', 'DELETE'].includes(method)) {
        return true;
    }

    return false;
}

async function isValidAdminToken(token: string): Promise<boolean> {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return false;
    const validation = await validateAdminToken(token, secret);
    return validation.valid;
}

async function hasValidAdminAuth(request: NextRequest): Promise<boolean> {
    const adminToken = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
    const authHeader = request.headers.get(ADMIN_AUTH_HEADER);

    const cookieValid = adminToken && (await isValidAdminToken(adminToken));
    const headerValid = authHeader && (await isValidAdminToken(authHeader));

    return Boolean(cookieValid || headerValid);
}

function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin');
    const allowedOrigins = getAllowedOrigins();

    if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Vary', 'Origin');
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const { method } = request;

    // ── CORS preflight (API) ──────────────────────────────────────────────
    if (pathname.startsWith('/api/') && method === 'OPTIONS') {
        return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
    }

    // ── CSRF himoyasi (state-changing so'rovlar uchun) ─────────────────────
    // POST/PUT/PATCH/DELETE so'rovlarida Origin yoki Referer tekshirish
    const CSRF_EXEMPT_PATHS = [
        '/api/telegram/',       // Telegram webhook (server-to-server)
        '/api/bot',             // Bot webhook
        '/api/payment/click',   // Click callback
        '/api/payment/payme',   // Payme callback
        '/api/push/',           // Push notification callbacks
    ];

    if (
        pathname.startsWith('/api/') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        !CSRF_EXEMPT_PATHS.some(p => pathname.startsWith(p))
    ) {
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const allowedOrigins = getAllowedOrigins();

        // Origin yoki Referer headerdan biri to'g'ri bo'lishi kerak
        const originValid = origin && allowedOrigins.includes(origin);
        const refererValid = referer && allowedOrigins.some(o => referer.startsWith(o));

        // Bearer token bilan kelgan API so'rovlari (mobile/driver) — CSRF exempt
        const hasAuthToken = request.headers.get('authorization')?.startsWith('Bearer ');
        // Admin token bilan kelgan so'rovlar — CSRF exempt
        const hasAdminToken = request.headers.get(ADMIN_AUTH_HEADER) ||
                              request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
        // Pack24 native app (WebView) so'rovlari — CSRF exempt
        const isFromApp = request.headers.get(WEBVIEW_SOURCE_HEADER) === WEBVIEW_SOURCE_VALUE;

        if (!originValid && !refererValid && !hasAuthToken && !hasAdminToken && !isFromApp) {
            const denied = NextResponse.json(
                { error: 'CSRF: Origin tekshiruvidan o\'tmadi' },
                { status: 403 }
            );
            return applyCorsHeaders(request, denied);
        }
    }

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
    const isPublicAdminApi = PUBLIC_ADMIN_API_PATHS.some((path) =>
        pathname.startsWith(path)
    );

    if (requiresAdminApiAuth(pathname, method) && !isPublicAdminApi) {
        if (!(await hasValidAdminAuth(request))) {
            const denied = NextResponse.json(
                { error: "Ruxsat yo'q. Tizimga kirishingiz kerak." },
                { status: 401 }
            );
            return pathname.startsWith('/api/')
                ? applyCorsHeaders(request, denied)
                : denied;
        }
    }

    const response = NextResponse.next();
    return pathname.startsWith('/api/')
        ? applyCorsHeaders(request, response)
        : response;
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/:path*',
    ],
};
