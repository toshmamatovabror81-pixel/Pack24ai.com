/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const getBotStatusesMock = jest.fn();
const getTelegramWebhookSecretMock = jest.fn();
const hasTelegramWebhookSecretMock = jest.fn();
const configureTelegramBotsMock = jest.fn();
const deleteTelegramWebhooksMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
    getTelegramWebhookSecret: (...args: unknown[]) => getTelegramWebhookSecretMock(...args),
    hasTelegramWebhookSecret: (...args: unknown[]) => hasTelegramWebhookSecretMock(...args),
}));

jest.mock('@/lib/telegram/botManager', () => ({
    getBotStatuses: (...args: unknown[]) => getBotStatusesMock(...args),
}));

jest.mock('@/lib/telegram/runtime', () => ({
    configureTelegramBots: (...args: unknown[]) => configureTelegramBotsMock(...args),
    deleteTelegramWebhooks: (...args: unknown[]) => deleteTelegramWebhooksMock(...args),
}));

jest.mock('@/lib/telegram/customerBot', () => ({ initCustomerBot: jest.fn() }));
jest.mock('@/lib/telegram/driverBot', () => ({ initDriverBot: jest.fn() }));
jest.mock('@/lib/telegram/adminBot', () => ({ initAdminBot: jest.fn() }));
jest.mock('@/lib/telegram/pack24AdminBot', () => ({ initPack24AdminBot: jest.fn() }));

import { GET, POST } from '@/app/api/telegram/setup/route';

describe('POST /api/telegram/setup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        getTelegramWebhookSecretMock.mockReturnValue('secret-token');
        hasTelegramWebhookSecretMock.mockReturnValue(true);
        configureTelegramBotsMock.mockResolvedValue([
            { bot: 'Customer', status: '✅ Polling boshlandi' },
        ]);
    });

    it('authorization bo\'lmasa 401 qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

        const response = await POST(new Request('http://localhost/api/telegram/setup', { method: 'POST' }) as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('noto\'g\'ri mode uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/telegram/setup', {
            method: 'POST',
            body: JSON.stringify({ mode: 'ftp' }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "mode quyidagilardan biri bo'lishi kerak: webhook, polling",
        });
        expect(configureTelegramBotsMock).not.toHaveBeenCalled();
    });

    it('webhook uchun noto\'g\'ri baseUrl bo\'lsa 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/telegram/setup', {
            method: 'POST',
            body: JSON.stringify({ mode: 'webhook', baseUrl: 'javascript:alert(1)' }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "baseUrl to'g'ri URL bo'lishi kerak",
        });
        expect(configureTelegramBotsMock).not.toHaveBeenCalled();
    });

    it('polling muvaffaqiyatli ishga tushsa 200 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/telegram/setup', {
            method: 'POST',
            body: JSON.stringify({ mode: 'polling' }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(configureTelegramBotsMock).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'polling',
            webhookSecret: 'secret-token',
        }));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            mode: 'polling',
        });
    });
});

describe('GET /api/telegram/setup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('bot statuslarini qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        getBotStatusesMock.mockResolvedValue([{ name: 'Customer Bot', hasToken: true }]);

        const response = await GET(new Request('http://localhost/api/telegram/setup') as never);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            ok: true,
            bots: [{ name: 'Customer Bot', hasToken: true }],
        });
    });
});
