/* Polyfill Web API globals that jsdom doesn't provide.
   The guards source uses `request instanceof Request` and `request.headers.get()`. */
if (typeof globalThis.Request === 'undefined') {
    class FakeHeaders {
        private _map = new Map<string, string>();
        constructor(init?: Record<string, string>) {
            if (init) Object.entries(init).forEach(([k, v]) => this._map.set(k.toLowerCase(), v));
        }
        get(name: string) { return this._map.get(name.toLowerCase()) ?? null; }
        set(name: string, value: string) { this._map.set(name.toLowerCase(), value); }
    }
    class FakeRequest {
        url: string;
        headers: FakeHeaders;
        constructor(url: string, init?: { headers?: FakeHeaders | Record<string, string> }) {
            this.url = url;
            this.headers = init?.headers instanceof FakeHeaders
                ? init.headers
                : new FakeHeaders(init?.headers as Record<string, string> | undefined);
        }
    }
    (globalThis as any).Headers = FakeHeaders;
    (globalThis as any).Request = FakeRequest;
}

/* NextResponse.json must be mocked before guards.ts imports next/server */
jest.mock('next/server', () => ({
    NextResponse: {
        json(body: unknown, init?: { status?: number }) {
            return {
                _body: body,
                status: init?.status ?? 200,
                async json() { return body; },
            };
        },
    },
}));
import { getServerSession } from 'next-auth';
import { validateAdminToken } from '@/lib/adminAuthShared';
import { getAdminSecret, MissingSecretError } from '@/lib/auth/tokenSecrets';
import { verifyDriverToken } from '@/lib/auth/verifyDriverToken';
import {
    requireUser,
    requireRole,
    requireAdmin,
    requireDriver,
    requireAdminOrUser,
} from '@/lib/auth/guards';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/adminAuthShared', () => ({
    ADMIN_AUTH_COOKIE: 'admin_auth',
    ADMIN_AUTH_HEADER: 'x-admin-token',
    validateAdminToken: jest.fn(),
}));
jest.mock('@/lib/auth/tokenSecrets', () => ({
    getAdminSecret: jest.fn(),
    MissingSecretError: class MissingSecretError extends Error {},
}));
jest.mock('@/lib/auth/verifyDriverToken', () => ({
    verifyDriverToken: jest.fn(),
}));

/* Logger mock — guards.ts imports childLogger */
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
    childLogger: () => ({
        warn: (...args: unknown[]) => mockLogWarn(...args),
        error: (...args: unknown[]) => mockLogError(...args),
        info: jest.fn(),
        debug: jest.fn(),
    }),
}));

jest.mock('@/lib/auth/errorCodes', () => ({
    AUTH_ERROR_CODES: {
        AUTH_REQUIRED: 'AUTH_REQUIRED',
        ADMIN_AUTH_REQUIRED: 'ADMIN_AUTH_REQUIRED',
        ADMIN_TOKEN_INVALID: 'ADMIN_TOKEN_INVALID',
        ADMIN_SECRET_MISSING: 'ADMIN_SECRET_MISSING',
        DRIVER_AUTH_REQUIRED: 'DRIVER_AUTH_REQUIRED',
        DRIVER_INACTIVE: 'DRIVER_INACTIVE',
        FORBIDDEN: 'FORBIDDEN',
    },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockValidateAdminToken = validateAdminToken as jest.MockedFunction<typeof validateAdminToken>;
const mockGetAdminSecret = getAdminSecret as jest.MockedFunction<typeof getAdminSecret>;
const mockVerifyDriverToken = verifyDriverToken as jest.MockedFunction<typeof verifyDriverToken>;

beforeEach(() => {
    jest.clearAllMocks();
    mockLogWarn.mockClear();
    mockLogError.mockClear();
});

/* ---------- helpers ---------- */

function makeSession(user: Record<string, unknown>) {
    return { user, expires: '2099-01-01T00:00:00.000Z' };
}

function makeRequest(opts: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
    const h = new Headers();
    if (opts.cookies) {
        h.set('cookie', Object.entries(opts.cookies).map(([k, v]) => `${k}=${v}`).join('; '));
    }
    if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers)) h.set(k, v);
    }
    return new Request('http://localhost/api/test', { headers: h });
}

/* ================================================================
   requireUser
   ================================================================ */
describe('requireUser', () => {
    it('returns ok:true with user data when session exists', async () => {
        mockGetServerSession.mockResolvedValue(
            makeSession({ id: '42', name: 'Alice', email: 'a@b.c', role: 'admin', phone: '+998' })
        );

        const result = await requireUser();

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.user).toEqual({
            id: '42',
            name: 'Alice',
            email: 'a@b.c',
            role: 'admin',
            phone: '+998',
        });
        expect(result.session).toBeDefined();
    });

    it('returns ok:false reason=no_session when no session', async () => {
        mockGetServerSession.mockResolvedValue(null);

        const result = await requireUser();

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_session');
        expect(result.response).toBeDefined();
    });

    it('returns ok:false when session.user is null', async () => {
        mockGetServerSession.mockResolvedValue({ user: null, expires: '' });

        const result = await requireUser();

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_session');
    });

    it('defaults role to "user" when not set', async () => {
        mockGetServerSession.mockResolvedValue(makeSession({ id: '1', name: 'Bob' }));

        const result = await requireUser();

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.user.role).toBe('user');
    });

    it('defaults phone to "" when not set', async () => {
        mockGetServerSession.mockResolvedValue(makeSession({ id: '1' }));

        const result = await requireUser();

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.user.phone).toBe('');
    });
});

/* ================================================================
   requireRole
   ================================================================ */
describe('requireRole', () => {
    it('returns ok:true when user role is in allowed list', async () => {
        mockGetServerSession.mockResolvedValue(
            makeSession({ id: '1', role: 'manager' })
        );

        const result = await requireRole(['admin', 'manager']);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.user.role).toBe('manager');
    });

    it('returns ok:false reason=forbidden when role not allowed', async () => {
        mockGetServerSession.mockResolvedValue(
            makeSession({ id: '1', role: 'user' })
        );

        const result = await requireRole(['admin', 'manager']);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('forbidden');
    });

    it('falls through to requireUser failure when no session', async () => {
        mockGetServerSession.mockResolvedValue(null);

        const result = await requireRole(['admin']);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_session');
    });
});

/* ================================================================
   requireAdmin
   ================================================================ */
describe('requireAdmin', () => {
    beforeEach(() => {
        mockGetAdminSecret.mockReturnValue('secret123');
    });

    it('returns ok:true source=cookie when valid admin cookie', async () => {
        mockValidateAdminToken.mockResolvedValue({ valid: true, reason: 'ok' });

        const req = makeRequest({ cookies: { admin_auth: 'tok' } });
        const result = await requireAdmin(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.source).toBe('cookie');
        expect(mockValidateAdminToken).toHaveBeenCalledWith('tok', 'secret123');
    });

    it('returns ok:true source=header when valid admin header token', async () => {
        mockValidateAdminToken.mockResolvedValue({ valid: true, reason: 'ok' });

        const req = makeRequest({ headers: { 'x-admin-token': 'hdr-tok' } });
        const result = await requireAdmin(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.source).toBe('header');
        expect(mockValidateAdminToken).toHaveBeenCalledWith('hdr-tok', 'secret123');
    });

    it('returns ok:false reason=no_admin_token when no cookie/header', async () => {
        const req = makeRequest();
        const result = await requireAdmin(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_admin_token');
    });

    it('returns ok:false reason=invalid_admin_token when header token is invalid', async () => {
        mockValidateAdminToken.mockResolvedValue({ valid: false, reason: 'invalid_signature' });

        const req = makeRequest({ headers: { 'x-admin-token': 'bad' } });
        const result = await requireAdmin(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_admin_token');
    });

    it('returns ok:false reason=misconfig when admin secret is missing', async () => {
        mockGetAdminSecret.mockImplementation(() => {
            throw new MissingSecretError('ADMIN_SECRET', 'test');
        });

        const req = makeRequest();
        const result = await requireAdmin(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('misconfig');
    });

    it('cookie is tried before header', async () => {
        // Cookie valid → should return 'cookie', not even check header
        mockValidateAdminToken.mockResolvedValue({ valid: true, reason: 'ok' });

        const req = makeRequest({
            cookies: { admin_auth: 'c-tok' },
            headers: { 'x-admin-token': 'h-tok' },
        });
        const result = await requireAdmin(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.source).toBe('cookie');
        // validateAdminToken called only once (for the cookie)
        expect(mockValidateAdminToken).toHaveBeenCalledTimes(1);
        expect(mockValidateAdminToken).toHaveBeenCalledWith('c-tok', 'secret123');
    });

    it('re-throws unexpected errors from getAdminSecret', async () => {
        mockGetAdminSecret.mockImplementation(() => {
            throw new Error('unexpected');
        });

        const req = makeRequest();
        await expect(requireAdmin(req)).rejects.toThrow('unexpected');
    });

    it('returns invalid_admin_token when cookie is present but invalid and no header', async () => {
        mockValidateAdminToken.mockResolvedValue({ valid: false, reason: 'invalid_signature' });

        const req = makeRequest({ cookies: { admin_auth: 'bad-cookie' } });
        const result = await requireAdmin(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_admin_token');
    });
});

/* ================================================================
   requireDriver
   ================================================================ */
describe('requireDriver', () => {
    it('returns ok:true with driver data when token valid', async () => {
        const driver = { id: 7, name: 'Driver A', phone: '+998', pointId: 1, supervisorId: null };
        mockVerifyDriverToken.mockResolvedValue({ ok: true, driverId: 7, driver });

        const req = makeRequest({ headers: { authorization: 'Bearer abc123' } });
        const result = await requireDriver(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.driverId).toBe(7);
        expect(result.driver).toEqual(driver);
        expect(mockVerifyDriverToken).toHaveBeenCalledWith('Bearer abc123');
    });

    it('returns ok:false reason=no_session with 401 when auth missing', async () => {
        mockVerifyDriverToken.mockResolvedValue({ ok: false, error: 'Token topilmadi', code: 'NO_TOKEN' });

        const req = makeRequest();
        const result = await requireDriver(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_session');
        // Verify the response is a 401
        const body = await result.response.json();
        expect(body.code).toBe('DRIVER_AUTH_REQUIRED');
    });

    it('returns ok:false reason=inactive with 403 when driver inactive', async () => {
        mockVerifyDriverToken.mockResolvedValue({ ok: false, error: 'Hisob faol emas', code: 'DRIVER_INACTIVE' });

        const req = makeRequest({ headers: { authorization: 'Bearer expired' } });
        const result = await requireDriver(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('inactive');
        const body = await result.response.json();
        expect(body.code).toBe('DRIVER_INACTIVE');
    });
});

/* ================================================================
   requireAdminOrUser
   ================================================================ */
describe('requireAdminOrUser', () => {
    it('returns ok:true kind=admin when admin auth passes', async () => {
        mockGetAdminSecret.mockReturnValue('secret');
        mockValidateAdminToken.mockResolvedValue({ valid: true, reason: 'ok' });

        const req = makeRequest({ headers: { 'x-admin-token': 'valid' } });
        const result = await requireAdminOrUser(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.kind).toBe('admin');
    });

    it('returns ok:true kind=user when admin fails but user auth passes', async () => {
        mockGetAdminSecret.mockReturnValue('secret');
        mockValidateAdminToken.mockResolvedValue({ valid: false, reason: 'invalid_signature' });
        mockGetServerSession.mockResolvedValue(makeSession({ id: '5', role: 'user' }));

        const req = makeRequest({ headers: { 'x-admin-token': 'invalid' } });
        const result = await requireAdminOrUser(req);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.kind).toBe('user');
        // Enriched return type — user data should be available
        if (result.kind === 'user') {
            expect(result.user).toEqual({
                id: '5',
                name: null,
                email: null,
                role: 'user',
                phone: '',
            });
            expect(result.session).toBeDefined();
        }
    });

    it('returns ok:false when both fail', async () => {
        mockGetAdminSecret.mockReturnValue('secret');
        mockGetServerSession.mockResolvedValue(null);

        const req = makeRequest();
        const result = await requireAdminOrUser(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('no_session');
    });
});

/* ================================================================
   Logging
   ================================================================ */
describe('logging', () => {
    it('logs warn on requireUser failure', async () => {
        mockGetServerSession.mockResolvedValue(null);
        await requireUser();
        expect(mockLogWarn).toHaveBeenCalled();
    });

    it('logs warn on requireRole forbidden', async () => {
        mockGetServerSession.mockResolvedValue(makeSession({ id: '1', role: 'user' }));
        await requireRole(['admin']);
        expect(mockLogWarn).toHaveBeenCalled();
    });

    it('logs error on requireAdmin misconfig', async () => {
        mockGetAdminSecret.mockImplementation(() => { throw new MissingSecretError('ADMIN_SECRET', 'test'); });
        const req = makeRequest();
        await requireAdmin(req);
        expect(mockLogError).toHaveBeenCalled();
    });

    it('logs warn on requireDriver failure', async () => {
        mockVerifyDriverToken.mockResolvedValue({ ok: false, error: 'Token topilmadi', code: 'NO_TOKEN' });
        const req = makeRequest();
        await requireDriver(req);
        expect(mockLogWarn).toHaveBeenCalled();
    });

    it('logs warn on requireAdminOrUser when both fail', async () => {
        mockGetAdminSecret.mockReturnValue('secret');
        mockGetServerSession.mockResolvedValue(null);
        const req = makeRequest();
        await requireAdminOrUser(req);
        expect(mockLogWarn).toHaveBeenCalled();
    });
});
