/** @jest-environment node */

const driverFindUniqueMock = jest.fn();
const driverUpdateMock = jest.fn();
const fetchMock = jest.fn();

jest.mock('@/lib/rateLimit', () => ({
    rateLimit: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        driver: {
            findUnique: (...args: unknown[]) => driverFindUniqueMock(...args),
            update: (...args: unknown[]) => driverUpdateMock(...args),
        },
    },
}));

import { POST } from '@/app/api/auth/driver/reset-password/route';

function post(body: unknown) {
    return POST(new Request('http://localhost/api/auth/driver/reset-password', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    }));
}

const baseDriver = {
    id: 3,
    name: 'Vali',
    status: 'active',
    telegramId: '12345',
    resetOtpCode: null,
    resetOtpExpiry: null,
    resetOtpAttempts: 0,
};

describe('POST /api/auth/driver/reset-password', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.DRIVER_BOT_TOKEN = 'test-token';
        fetchMock.mockResolvedValue({ ok: true });
        global.fetch = fetchMock as unknown as typeof fetch;
        driverUpdateMock.mockResolvedValue({});
    });

    it('kodsiz parolni o\'zgartirmaydi, faqat Telegram\'ga kod yuboradi', async () => {
        driverFindUniqueMock.mockResolvedValue(baseDriver);
        const res = await post({ phone: '+998901234567', newPassword: 'hacked123' });
        expect(res.status).toBe(200);
        const data = driverUpdateMock.mock.calls[0][0].data;
        expect(data.passwordHash).toBeUndefined();
        expect(data.resetOtpCode).toMatch(/^\d{6}$/);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('haydovchi topilmasa ham bir xil javob qaytaradi', async () => {
        driverFindUniqueMock.mockResolvedValue(null);
        const res = await post({ phone: '+998900000000' });
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({ ok: true, codeSent: true });
        expect(driverUpdateMock).not.toHaveBeenCalled();
    });

    it('noto\'g\'ri kod bilan parolni o\'zgartirmaydi', async () => {
        driverFindUniqueMock.mockResolvedValue({
            ...baseDriver,
            resetOtpCode: '123456',
            resetOtpExpiry: new Date(Date.now() + 60_000),
        });
        const res = await post({ phone: '+998901234567', otp: '000000', newPassword: 'newpass1' });
        expect(res.status).toBe(401);
        expect(driverUpdateMock.mock.calls[0][0].data).toEqual({ resetOtpAttempts: { increment: 1 } });
    });

    it('muddati o\'tgan kodni rad etadi', async () => {
        driverFindUniqueMock.mockResolvedValue({
            ...baseDriver,
            resetOtpCode: '123456',
            resetOtpExpiry: new Date(Date.now() - 1000),
        });
        const res = await post({ phone: '+998901234567', otp: '123456', newPassword: 'newpass1' });
        expect(res.status).toBe(401);
        expect(driverUpdateMock.mock.calls[0][0].data.passwordHash).toBeUndefined();
    });

    it('to\'g\'ri kod bilan parolni yangilaydi va kodni tozalaydi', async () => {
        driverFindUniqueMock.mockResolvedValue({
            ...baseDriver,
            resetOtpCode: '123456',
            resetOtpExpiry: new Date(Date.now() + 60_000),
        });
        const res = await post({ phone: '+998901234567', otp: '123456', newPassword: 'newpass1' });
        expect(res.status).toBe(200);
        const data = driverUpdateMock.mock.calls[0][0].data;
        expect(typeof data.passwordHash).toBe('string');
        expect(data.resetOtpCode).toBeNull();
    });
});
