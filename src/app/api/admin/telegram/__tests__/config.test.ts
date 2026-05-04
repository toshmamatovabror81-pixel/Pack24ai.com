/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const getTelegramWebhookSecretMock = jest.fn();
const hasTelegramWebhookSecretMock = jest.fn();
const getCustomerBotMock = jest.fn();
const resetCustomerBotMock = jest.fn();

const telegramConfigFindFirstMock = jest.fn();
const telegramConfigUpdateMock = jest.fn();
const telegramConfigCreateMock = jest.fn();
const userCountMock = jest.fn();
const orderCountMock = jest.fn();
const recycleCollectionCountMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
    getTelegramWebhookSecret: (...args: unknown[]) => getTelegramWebhookSecretMock(...args),
    hasTelegramWebhookSecret: (...args: unknown[]) => hasTelegramWebhookSecretMock(...args),
}));

jest.mock('@/lib/telegram/botManager', () => ({
    getCustomerBot: (...args: unknown[]) => getCustomerBotMock(...args),
    resetCustomerBot: (...args: unknown[]) => resetCustomerBotMock(...args),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        telegramConfig: {
            findFirst: (...args: unknown[]) => telegramConfigFindFirstMock(...args),
            update: (...args: unknown[]) => telegramConfigUpdateMock(...args),
            create: (...args: unknown[]) => telegramConfigCreateMock(...args),
        },
        user: {
            count: (...args: unknown[]) => userCountMock(...args),
        },
        order: {
            count: (...args: unknown[]) => orderCountMock(...args),
        },
        recycleCollection: {
            count: (...args: unknown[]) => recycleCollectionCountMock(...args),
        },
    },
}));

import { GET, POST } from '@/app/api/admin/telegram/config/route';

describe('admin telegram config route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        getTelegramWebhookSecretMock.mockReturnValue('secret-token');
        hasTelegramWebhookSecretMock.mockReturnValue(true);
        telegramConfigFindFirstMock.mockResolvedValue({
            id: 1,
            botToken: 'token-1',
            botUsername: '@pack24',
            welcomeMessage: 'hi',
            mainButton: 'Katalog',
            salesChatId: '1001',
            isActive: true,
        });
        telegramConfigUpdateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: 1,
            botToken: 'token-1',
            botUsername: '@pack24',
            welcomeMessage: 'hi',
            mainButton: 'Katalog',
            salesChatId: '1001',
            isActive: true,
            ...data,
        }));
        userCountMock.mockResolvedValue(10);
        orderCountMock.mockResolvedValue(20);
        recycleCollectionCountMock
            .mockResolvedValueOnce(30)
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(12);
    });

    it('GET authorization bo\'lmasa 401 qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

        const response = await GET(new Request('http://localhost/api/admin/telegram/config') as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('GET config va stats qaytaradi', async () => {
        const setWebhookMock = jest.fn();
        const getWebhookInfoMock = jest.fn().mockResolvedValue({ url: 'https://pack24.ai/api/telegram/webhook' });
        getCustomerBotMock.mockResolvedValue({
            telegram: {
                getWebhookInfo: getWebhookInfoMock,
                setWebhook: setWebhookMock,
            },
        });

        const response = await GET(new Request('http://localhost/api/admin/telegram/config') as never);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            botUsername: '@pack24',
            webhookInfo: { url: 'https://pack24.ai/api/telegram/webhook' },
            stats: {
                totalUsers: 10,
                totalOrders: 20,
                totalCollections: 30,
                pendingCollections: 4,
                paidCollections: 12,
            },
        });
    });

    it('POST invalid json uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/admin/telegram/config', {
            method: 'POST',
            body: '[',
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'Yaroqsiz JSON body' });
    });

    it('POST configni yangilaydi va webhook o\'rnatadi', async () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://pack24.ai';
        const setWebhookMock = jest.fn().mockResolvedValue(undefined);
        const getMeMock = jest.fn().mockResolvedValue({ username: 'Pack24AI_bot' });
        getCustomerBotMock.mockResolvedValue({
            telegram: {
                getMe: getMeMock,
                setWebhook: setWebhookMock,
            },
        });

        const response = await POST(new Request('http://localhost/api/admin/telegram/config', {
            method: 'POST',
            body: JSON.stringify({
                botToken: 'new-token',
                welcomeMessage: 'salom',
                mainButton: 'Boshlash',
                salesChatId: '1001,1002',
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(resetCustomerBotMock).toHaveBeenCalled();
        expect(telegramConfigUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                botToken: 'new-token',
                welcomeMessage: 'salom',
                mainButton: 'Boshlash',
                salesChatId: '1001,1002',
            }),
        }));
        expect(setWebhookMock).toHaveBeenCalledWith(
            'https://pack24.ai/api/telegram/webhook',
            { secret_token: 'secret-token' },
        );
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            botToken: 'new-token',
            botUsername: '@Pack24AI_bot',
        });
    });
});
