/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const isTelegramPollingStartedMock = jest.fn();
const startTelegramPollingMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
}));

jest.mock('@/lib/telegram/runtime', () => ({
    isTelegramPollingStarted: (...args: unknown[]) => isTelegramPollingStartedMock(...args),
    startTelegramPolling: (...args: unknown[]) => startTelegramPollingMock(...args),
}));

jest.mock('@/lib/telegram/customerBot', () => ({ initCustomerBot: jest.fn() }));
jest.mock('@/lib/telegram/driverBot', () => ({ initDriverBot: jest.fn() }));
jest.mock('@/lib/telegram/adminBot', () => ({ initAdminBot: jest.fn() }));
jest.mock('@/lib/telegram/pack24AdminBot', () => ({ initPack24AdminBot: jest.fn() }));

import { GET } from '@/app/api/telegram/start-polling/route';

describe('GET /api/telegram/start-polling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        isTelegramPollingStartedMock.mockReturnValue(false);
    });

    it('authorization bo\'lmasa 401 qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

        const response = await GET(new Request('http://localhost/api/telegram/start-polling') as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('polling allaqachon ishlasa tayyor xabar qaytaradi', async () => {
        isTelegramPollingStartedMock.mockReturnValue(true);

        const response = await GET(new Request('http://localhost/api/telegram/start-polling') as never);

        expect(startTelegramPollingMock).not.toHaveBeenCalled();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            ok: true,
            message: '🤖 Botlar allaqachon polling rejimda ishlayapti!',
        });
    });

    it('hech bir bot ishga tushmasa 503 qaytaradi', async () => {
        startTelegramPollingMock.mockResolvedValue([
            { bot: 'Customer', status: '❌ failed' },
        ]);

        const response = await GET(new Request('http://localhost/api/telegram/start-polling') as never);

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({
            ok: false,
            message: '⚠️ Hech bir bot polling rejimida ishga tushmadi.',
            bots: [{ bot: 'Customer', status: '❌ failed' }],
        });
    });

    it('kamida bitta bot ishga tushsa 200 qaytaradi', async () => {
        startTelegramPollingMock.mockResolvedValue([
            { bot: 'Customer', status: '✅ Polling boshlandi' },
            { bot: 'Driver', status: '⚠️ Token topilmadi' },
        ]);

        const response = await GET(new Request('http://localhost/api/telegram/start-polling') as never);

        expect(startTelegramPollingMock).toHaveBeenCalled();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            message: '🤖 Polling rejimi ishga tushirildi!',
        });
    });
});
