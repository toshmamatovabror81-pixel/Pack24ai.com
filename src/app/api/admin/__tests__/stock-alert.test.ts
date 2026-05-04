/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const sendLowStockAlertToAdminChatsMock = jest.fn();
const inventoryFindManyMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
}));

jest.mock('@/lib/platform/telegramCommands', () => ({
    sendLowStockAlertToAdminChats: (...args: unknown[]) => sendLowStockAlertToAdminChatsMock(...args),
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        inventory: {
            findMany: (...args: unknown[]) => inventoryFindManyMock(...args),
        },
    },
}));

import { GET, POST } from '@/app/api/admin/stock-alert/route';

describe('admin stock-alert route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        sendLowStockAlertToAdminChatsMock.mockResolvedValue(true);
        publishPlatformEventMock.mockResolvedValue({ id: 50 });
    });

    describe('GET /api/admin/stock-alert', () => {
        it('authorization bo\'lmasa 401 qaytaradi', async () => {
            isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

            const response = await GET(new Request('http://localhost/api/admin/stock-alert') as never);

            expect(response.status).toBe(401);
            await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
        });

        it('threshold noto\'g\'ri bo\'lsa 400 qaytaradi', async () => {
            const response = await GET(
                new Request('http://localhost/api/admin/stock-alert?threshold=1.5') as never,
            );

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: "threshold musbat butun son bo'lishi kerak",
            });
        });

        it('notify=true bo\'lsa alert yuboradi', async () => {
            inventoryFindManyMock.mockResolvedValue([
                {
                    id: 1,
                    quantity: 3,
                    product: { id: 10, name: 'Quti <XL>', sku: 'BX-<1>' },
                },
            ]);

            const response = await GET(
                new Request('http://localhost/api/admin/stock-alert?notify=true&threshold=5') as never,
            );

            expect(response.status).toBe(200);
            expect(inventoryFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
                where: { quantity: { lte: 5 } },
            }));
            expect(sendLowStockAlertToAdminChatsMock).toHaveBeenCalledWith([
                { id: 10, name: 'Quti <XL>', sku: 'BX-<1>', quantity: 3 },
            ], 5);
            expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
                type: 'inventory.low_stock_detected',
                severity: 'warning',
            }));
            await expect(response.json()).resolves.toMatchObject({
                count: 1,
                threshold: 5,
                notified: true,
            });
        });
    });

    describe('POST /api/admin/stock-alert', () => {
        it('manfiy quantity uchun 400 qaytaradi', async () => {
            const response = await POST(new Request('http://localhost/api/admin/stock-alert', {
                method: 'POST',
                body: JSON.stringify({
                    items: [{ name: 'Quti', quantity: -2 }],
                }),
                headers: { 'Content-Type': 'application/json' },
            }) as never);

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: "items[0].quantity manfiy bo'lmasligi kerak",
            });
        });

        it('to\'g\'ri payload bo\'lsa alert yuboradi', async () => {
            const response = await POST(new Request('http://localhost/api/admin/stock-alert', {
                method: 'POST',
                body: JSON.stringify({
                    items: [{ name: 'Qog\'oz <A4>', sku: 'P-01', quantity: 2 }],
                }),
                headers: { 'Content-Type': 'application/json' },
            }) as never);

            expect(response.status).toBe(200);
            expect(sendLowStockAlertToAdminChatsMock).toHaveBeenCalledWith([
                { name: 'Qog\'oz <A4>', sku: 'P-01', quantity: 2 },
            ], 10);
            expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
                type: 'inventory.low_stock_alert_sent',
                severity: 'warning',
            }));
            await expect(response.json()).resolves.toMatchObject({
                success: true,
            });
        });
    });
});
