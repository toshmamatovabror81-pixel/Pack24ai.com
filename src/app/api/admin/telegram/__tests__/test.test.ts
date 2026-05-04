/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const getCustomerBotMock = jest.fn();
const telegramConfigFindFirstMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
}));

jest.mock('@/lib/telegram/botManager', () => ({
    getCustomerBot: (...args: unknown[]) => getCustomerBotMock(...args),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        telegramConfig: {
            findFirst: (...args: unknown[]) => telegramConfigFindFirstMock(...args),
        },
    },
}));

import { POST } from '@/app/api/admin/telegram/test/route';

describe('POST /api/admin/telegram/test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
    });

    it('authorization bo\'lmasa 401 qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

        const response = await POST(new Request('http://localhost/api/admin/telegram/test', {
            method: 'POST',
        }) as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('bot token bo\'lmasa 400 qaytaradi', async () => {
        telegramConfigFindFirstMock.mockResolvedValue(null);

        const response = await POST(new Request('http://localhost/api/admin/telegram/test', {
            method: 'POST',
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'Bot token topilmadi' });
    });

    it('sales chatlarga test xabar yuboradi', async () => {
        const sendMessageMock = jest.fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('blocked'));
        telegramConfigFindFirstMock.mockResolvedValue({
            botToken: 'token',
            salesChatId: '1001, 1002',
        });
        getCustomerBotMock.mockResolvedValue({
            telegram: {
                getMe: jest.fn().mockResolvedValue({ username: 'Pack24AI_bot' }),
                sendMessage: sendMessageMock,
            },
        });

        const response = await POST(new Request('http://localhost/api/admin/telegram/test', {
            method: 'POST',
        }) as never);

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            message: 'Test yakunlandi',
            bot: '@Pack24AI_bot',
            results: [
                { chatId: '1001', status: 'success' },
                { chatId: '1002', status: 'error', message: 'blocked' },
            ],
        });
    });
});
