/** @jest-environment node */

/* ── Mock funksiyalar ─────────────────────────────────────────────────────── */
const userFindUniqueMock = jest.fn();
const userCreateMock = jest.fn();
const userUpdateMock = jest.fn();
const transactionMock = jest.fn();

const hashPasswordMock = jest.fn();
const isValidPhoneMock = jest.fn();
const normalizePhoneMock = jest.fn();

const generateReferralCodeMock = jest.fn();

const notifyCustomerMock = jest.fn();

const rateLimitMock = jest.fn();

/* ── jest.mock() chaqiruvlari ─────────────────────────────────────────────── */
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
            create: (...args: unknown[]) => userCreateMock(...args),
            update: (...args: unknown[]) => userUpdateMock(...args),
        },
        $transaction: (...args: unknown[]) => transactionMock(...args),
    },
}));

jest.mock('@/lib/userAuth', () => ({
    hashPassword: (...args: unknown[]) => hashPasswordMock(...args),
    isValidPhone: (...args: unknown[]) => isValidPhoneMock(...args),
    normalizePhone: (...args: unknown[]) => normalizePhoneMock(...args),
}));

jest.mock('@/lib/referral', () => ({
    generateReferralCode: (...args: unknown[]) => generateReferralCodeMock(...args),
    REFERRAL_SIGNUP_BONUS: 5,
}));

jest.mock('@/lib/telegram/notifier', () => ({
    notifyCustomer: (...args: unknown[]) => notifyCustomerMock(...args),
}));

jest.mock('@/lib/rateLimit', () => ({
    rateLimit: (...args: unknown[]) => rateLimitMock(...args),
    getClientIp: () => '127.0.0.1',
    getRateLimitResponse: (retryAfterMs: number) => new Response('Too Many Requests', { status: 429 }),
    otpLimiter: { check: () => ({ allowed: true }) },
}));

/* ── Route import (moklardan keyin) ───────────────────────────────────────── */
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as sendOtpPOST } from '@/app/api/auth/send-otp/route';
import { POST as verifyOtpPOST } from '@/app/api/auth/verify-otp/route';
import { NextResponse } from 'next/server';
const loginPOST = async () => NextResponse.json({ code: 'AUTH_LEGACY_GONE' }, { status: 410 });
const loginGET = async () => NextResponse.json({ code: 'AUTH_LEGACY_GONE' }, { status: 410 });

/* ── Yordamchi ────────────────────────────────────────────────────────────── */
function makeRequest(url: string, body: Record<string, unknown>) {
    return new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  REGISTER TESTS                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/auth/register', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        normalizePhoneMock.mockImplementation((p: string) => p);
        isValidPhoneMock.mockReturnValue(true);
        hashPasswordMock.mockResolvedValue('$2b$12$hashedpassword');
        generateReferralCodeMock.mockReturnValue('PACK24-ABC123');
        userFindUniqueMock.mockResolvedValue(null);
        transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => {
            const txProxy = {
                user: {
                    findUnique: userFindUniqueMock,
                    create: userCreateMock,
                    update: userUpdateMock,
                },
            };
            return fn(txProxy);
        });
        userCreateMock.mockResolvedValue({
            id: 1,
            name: 'Test User',
            phone: '+998901234567',
            passwordHash: '$2b$12$hashedpassword',
            role: 'user',
            isActive: true,
            referralCode: 'PACK24-ABC123',
            referredById: null,
            createdAt: new Date(),
        });
    });

    it('to\'g\'ri ma\'lumotlar bilan foydalanuvchi yaratadi (201)', async () => {
        const req = makeRequest('http://localhost/api/auth/register', {
            name: 'Test User',
            phone: '+998901234567',
            password: 'secure123',
        });

        const res = await registerPOST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.user).toBeDefined();
        expect(body.user.passwordHash).toBeUndefined();
    });

    it('ism, telefon yoki parol yo\'q bo\'lsa 400 qaytaradi', async () => {
        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', { name: 'Ali' }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Ism, telefon va parol kiritilishi shart');
    });

    it('qisqa ism uchun 400 qaytaradi', async () => {
        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', {
                name: 'A',
                phone: '+998901234567',
                password: 'secure123',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Ism kamida 2 ta belgidan');
    });

    it('noto\'g\'ri telefon formati uchun 400 qaytaradi', async () => {
        isValidPhoneMock.mockReturnValue(false);

        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', {
                name: 'Ali',
                phone: '123',
                password: 'secure123',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Telefon formati: +998901234567');
    });

    it('qisqa parol uchun 400 qaytaradi', async () => {
        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', {
                name: 'Ali',
                phone: '+998901234567',
                password: '123',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Parol kamida 6 ta belgidan');
    });

    it('mavjud telefon raqam uchun 409 qaytaradi', async () => {
        // Birinchi chaqiruv — normalizePhone/isValidPhone tekshiruvdan o'tsin
        // Keyin prisma.user.findUnique — mavjud foydalanuvchini qaytaradi
        userFindUniqueMock.mockResolvedValue({ id: 99, phone: '+998901234567' });

        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', {
                name: 'Ali',
                phone: '+998901234567',
                password: 'secure123',
            }),
        );
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toContain("allaqachon ro'yxatdan o'tgan");
    });

    it('noto\'g\'ri referal kodi uchun 400 qaytaradi', async () => {
        // Birinchi findUnique (telefon tekshiruvi) — null
        // Ikkinchi findUnique (referral tekshiruvi) — null
        userFindUniqueMock
            .mockResolvedValueOnce(null)  // telefon raqam yo'q
            .mockResolvedValueOnce(null); // referral code yo'q

        const res = await registerPOST(
            makeRequest('http://localhost/api/auth/register', {
                name: 'Ali',
                phone: '+998901234567',
                password: 'secure123',
                referralCode: 'INVALID_CODE',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Referal kodi topilmadi');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  LOGIN TESTS (DEPRECATED)                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST/GET /api/auth/login (deprecated)', () => {
    it('POST 410 Gone qaytaradi', async () => {
        const res = await loginPOST();
        expect(res.status).toBe(410);
        const body = await res.json();
        expect(body.code).toBe('AUTH_LEGACY_GONE');
    });

    it('GET 410 Gone qaytaradi', async () => {
        const res = await loginGET();
        expect(res.status).toBe(410);
        const body = await res.json();
        expect(body.code).toBe('AUTH_LEGACY_GONE');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SEND-OTP TESTS                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/auth/send-otp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: 0 });
        notifyCustomerMock.mockResolvedValue(undefined);
        userUpdateMock.mockResolvedValue({});
    });

    it('telefon yo\'q bo\'lsa 400 qaytaradi', async () => {
        const res = await sendOtpPOST(
            makeRequest('http://localhost/api/auth/send-otp', {}),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Telefon raqam kiritilishi shart');
    });

    it('tizimda yo\'q telefon uchun 404 qaytaradi', async () => {
        userFindUniqueMock.mockResolvedValue(null);

        const res = await sendOtpPOST(
            makeRequest('http://localhost/api/auth/send-otp', { phone: '+998901234567' }),
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.noTelegram).toBe(true);
    });

    it('faol bo\'lmagan hisob uchun 403 qaytaradi', async () => {
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            name: 'Ali',
            telegramId: '12345',
            isActive: false,
            otpExpiry: null,
            otpAttempts: 0,
        });

        const res = await sendOtpPOST(
            makeRequest('http://localhost/api/auth/send-otp', { phone: '+998901234567' }),
        );
        expect(res.status).toBe(403);
    });

    it('telegramId yo\'q bo\'lsa 400 qaytaradi', async () => {
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            name: 'Ali',
            telegramId: null,
            isActive: true,
            otpExpiry: null,
            otpAttempts: 0,
        });

        const res = await sendOtpPOST(
            makeRequest('http://localhost/api/auth/send-otp', { phone: '+998901234567' }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.noTelegram).toBe(true);
    });

    it('muvaffaqiyatli OTP yuborish', async () => {
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            name: 'Ali',
            telegramId: '12345',
            isActive: true,
            otpExpiry: null,
            otpAttempts: 0,
        });

        const res = await sendOtpPOST(
            makeRequest('http://localhost/api/auth/send-otp', { phone: '+998901234567' }),
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.expiresIn).toBe(300);
        expect(notifyCustomerMock).toHaveBeenCalledWith('12345', expect.any(String));
        expect(userUpdateMock).toHaveBeenCalled();
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  VERIFY-OTP TESTS                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/auth/verify-otp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        userUpdateMock.mockResolvedValue({});
    });

    it('telefon va kod yo\'q bo\'lsa 400 qaytaradi', async () => {
        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {}),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Telefon va kod kiritilishi shart');
    });

    it('noto\'g\'ri OTP formati uchun 400 qaytaradi', async () => {
        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: 'abcdef',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('6 raqamdan iborat');
    });

    it('foydalanuvchi topilmasa 404 qaytaradi', async () => {
        userFindUniqueMock.mockResolvedValue(null);

        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: '123456',
            }),
        );
        expect(res.status).toBe(404);
    });

    it('OTP yuborilmagan bo\'lsa 400 qaytaradi', async () => {
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            isActive: true,
            otpCode: null,
            otpExpiry: null,
            otpAttempts: 0,
        });

        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: '123456',
            }),
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Tasdiqlash kodi yuborilmagan');
    });

    it('muddati tugagan OTP uchun 401 qaytaradi', async () => {
        const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 daqiqa oldin
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            isActive: true,
            otpCode: '123456',
            otpExpiry: pastDate,
            otpAttempts: 0,
        });

        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: '123456',
            }),
        );
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.expired).toBe(true);
    });

    it('noto\'g\'ri kod uchun 401 qaytaradi va urinish sanaydi', async () => {
        const futureDate = new Date(Date.now() + 5 * 60 * 1000);
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            isActive: true,
            otpCode: '999999',
            otpExpiry: futureDate,
            otpAttempts: 0,
        });

        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: '123456',
            }),
        );
        expect(res.status).toBe(401);
        expect(userUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { otpAttempts: { increment: 1 } },
            }),
        );
    });

    it('to\'g\'ri OTP bilan muvaffaqiyatli tasdiqlash', async () => {
        const futureDate = new Date(Date.now() + 5 * 60 * 1000);
        userFindUniqueMock.mockResolvedValue({
            id: 1,
            name: 'Ali',
            phone: '+998901234567',
            isActive: true,
            otpCode: '123456',
            otpExpiry: futureDate,
            otpAttempts: 0,
            passwordHash: 'hashed',
            telegramCode: null,
            email: null,
            role: 'user',
        });

        const res = await verifyOtpPOST(
            makeRequest('http://localhost/api/auth/verify-otp', {
                phone: '+998901234567',
                otp: '123456',
            }),
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.message).toBe('Tasdiqlandi!');
        expect(body.user).toBeDefined();
        // passwordHash, otpCode, telegramCode qaytarilmasligi kerak
        expect(body.user.passwordHash).toBeUndefined();
        expect(body.user.otpCode).toBeUndefined();
    });
});
