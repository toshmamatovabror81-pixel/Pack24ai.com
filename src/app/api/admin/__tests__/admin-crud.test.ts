/** @jest-environment node */

/* ── Mock funksiyalar ─────────────────────────────────────────────────────── */
const orderFindManyMock = jest.fn();
const userFindManyMock = jest.fn();
const rateLimitMock = jest.fn();

/* ── jest.mock() chaqiruvlari ─────────────────────────────────────────────── */
jest.mock('@/lib/prisma', () => ({
    prisma: {
        order: {
            findMany: (...args: unknown[]) => orderFindManyMock(...args),
        },
        user: {
            findMany: (...args: unknown[]) => userFindManyMock(...args),
        },
    },
}));

jest.mock('@/lib/rateLimit', () => ({
    rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

jest.mock('@/lib/money', () => ({
    toNumber: (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0'))),
}));

/* ── Route importlar ──────────────────────────────────────────────────────── */
import { POST as adminLoginPOST } from '@/app/api/admin/login/route';
import { POST as adminLogoutPOST } from '@/app/api/admin/logout/route';
import { GET as customersGET } from '@/app/api/admin/customers/route';

/* ── Yordamchi ────────────────────────────────────────────────────────────── */
function makeLoginRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }) as never;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ADMIN LOGIN TESTS                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/admin/login', () => {
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'secret123';
    const ADMIN_SECRET = 'test-admin-secret-key';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ADMIN_USERNAME = ADMIN_USERNAME;
        process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
        process.env.ADMIN_SECRET = ADMIN_SECRET;
        rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: 0 });
    });

    afterEach(() => {
        delete process.env.ADMIN_USERNAME;
        delete process.env.ADMIN_PASSWORD;
        delete process.env.ADMIN_SECRET;
    });

    it('to\'g\'ri kredensiallar bilan muvaffaqiyatli login', async () => {
        const res = await adminLoginPOST(makeLoginRequest({
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD,
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        // Cookie o'rnatilganligini tekshirish
        const setCookie = res.headers.get('set-cookie');
        expect(setCookie).toBeTruthy();
        expect(setCookie).toContain('admin_auth');
    });

    it('noto\'g\'ri username bilan 401 qaytaradi', async () => {
        const res = await adminLoginPOST(makeLoginRequest({
            username: 'wronguser',
            password: ADMIN_PASSWORD,
        }));

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toContain("noto'g'ri");
    });

    it('noto\'g\'ri parol bilan 401 qaytaradi', async () => {
        const res = await adminLoginPOST(makeLoginRequest({
            username: ADMIN_USERNAME,
            password: 'wrongpass',
        }));

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toContain("noto'g'ri");
    });

    it('bo\'sh kredensiallar bilan 401 qaytaradi', async () => {
        const res = await adminLoginPOST(makeLoginRequest({
            username: '',
            password: '',
        }));

        expect(res.status).toBe(401);
    });

    it('env o\'zgaruvchilar yo\'q bo\'lsa 500 qaytaradi', async () => {
        delete process.env.ADMIN_USERNAME;
        delete process.env.ADMIN_PASSWORD;
        delete process.env.ADMIN_SECRET;

        const res = await adminLoginPOST(makeLoginRequest({
            username: 'admin',
            password: 'pass',
        }));

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Server konfiguratsiya xatosi');
    });

    it('noto\'g\'ri JSON formatida 400 qaytaradi', async () => {
        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid-json{{{',
        }) as never;

        const res = await adminLoginPOST(req);
        expect(res.status).toBe(400);
    });

    it('rate limit qo\'llaniladi', async () => {
        rateLimitMock.mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
            retryAfterSec: 60,
        });

        const res = await adminLoginPOST(makeLoginRequest({
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD,
        }));

        expect(res.status).toBe(429);
        expect(rateLimitMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ bucket: 'admin-login' }),
        );
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ADMIN LOGOUT TESTS                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/admin/logout', () => {
    it('muvaffaqiyatli logout va cookie tozalanadi', async () => {
        const res = await adminLogoutPOST();

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        // Cookie o'chirilganligini tekshirish (maxAge=0)
        const setCookie = res.headers.get('set-cookie');
        expect(setCookie).toBeTruthy();
        expect(setCookie).toContain('admin_auth');
        expect(setCookie).toContain('Max-Age=0');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ADMIN CUSTOMERS TESTS                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('GET /api/admin/customers', () => {
    const mockDate = new Date('2026-01-15T10:00:00Z');

    const sampleOrders = [
        {
            id: 1,
            contactPhone: '+998901111111',
            customerName: 'Ali Valiyev',
            totalAmount: 50000,
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'cash',
            createdAt: mockDate,
        },
        {
            id: 2,
            contactPhone: '+998902222222',
            customerName: 'Mehmon User',
            totalAmount: 30000,
            status: 'processing',
            paymentStatus: 'pending',
            paymentMethod: 'payme',
            createdAt: mockDate,
        },
    ];

    const sampleUsers = [
        {
            id: 1,
            name: 'Ali Valiyev',
            phone: '+998901111111',
            email: 'ali@example.com',
            isActive: true,
            customerType: 'individual',
            customerGroup: 'standard',
            companyName: null,
            address: 'Tashkent',
            notes: null,
            createdAt: mockDate,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        orderFindManyMock.mockResolvedValue(sampleOrders);
        userFindManyMock.mockResolvedValue(sampleUsers);
    });

    it('mijozlar ro\'yxatini sahifalab qaytaradi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers') as never,
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.customers).toBeDefined();
        expect(body.total).toBeGreaterThanOrEqual(1);
        expect(body.page).toBe(1);
        expect(body.stats).toBeDefined();
        expect(body.stats.total).toBeGreaterThanOrEqual(1);
    });

    it('ro\'yxatdan o\'tgan va mehmon mijozlarni birlashtiradi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers') as never,
        );

        const body = await res.json();
        // Ali Valiyev — registered, Mehmon User — guest
        expect(body.total).toBe(2);
        const sources = body.customers.map((c: { source: string }) => c.source);
        expect(sources).toContain('registered');
        expect(sources).toContain('guest');
    });

    it('search filtri ishlaydi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers?search=Ali') as never,
        );

        const body = await res.json();
        expect(body.customers.length).toBeGreaterThanOrEqual(1);
        expect(body.customers[0].name).toContain('Ali');
    });

    it('type filtri ishlaydi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers?type=individual') as never,
        );

        const body = await res.json();
        for (const customer of body.customers) {
            expect(customer.customerType).toBe('individual');
        }
    });

    it('group=debtor filtri debitor mijozlarni qaytaradi', async () => {
        // Mehmon User — to'lanmagan buyurtma bor, shuning uchun debitor
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers?group=debtor') as never,
        );

        const body = await res.json();
        for (const customer of body.customers) {
            expect(customer.totalDebit).toBeGreaterThan(0);
        }
    });

    it('bo\'sh ma\'lumotlar bazasi bilan ishlaydi', async () => {
        orderFindManyMock.mockResolvedValue([]);
        userFindManyMock.mockResolvedValue([]);

        const res = await customersGET(
            new Request('http://localhost/api/admin/customers') as never,
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.customers).toEqual([]);
        expect(body.total).toBe(0);
        expect(body.stats.total).toBe(0);
    });

    it('sahifalash (pagination) to\'g\'ri ishlaydi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers?page=1&limit=1') as never,
        );

        const body = await res.json();
        expect(body.customers.length).toBeLessThanOrEqual(1);
        expect(body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('stats moliyaviy ma\'lumotlarni o\'z ichiga oladi', async () => {
        const res = await customersGET(
            new Request('http://localhost/api/admin/customers') as never,
        );

        const body = await res.json();
        expect(body.stats).toMatchObject({
            total: expect.any(Number),
            registered: expect.any(Number),
            guests: expect.any(Number),
            totalRevenue: expect.any(Number),
            totalDebit: expect.any(Number),
            totalPaid: expect.any(Number),
            debtors: expect.any(Number),
        });
    });
});
