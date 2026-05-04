/** @jest-environment node */

const isAuthorizedTelegramOpsRequestMock = jest.fn();
const sendManualOrderNotificationToAdminChatsMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('@/lib/telegram/security', () => ({
    isAuthorizedTelegramOpsRequest: (...args: unknown[]) => isAuthorizedTelegramOpsRequestMock(...args),
}));

jest.mock('@/lib/platform/telegramCommands', () => ({
    sendManualOrderNotificationToAdminChats: (...args: unknown[]) => sendManualOrderNotificationToAdminChatsMock(...args),
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

import { POST } from '@/app/api/telegram/order/route';

describe('POST /api/telegram/order', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(true);
        sendManualOrderNotificationToAdminChatsMock.mockResolvedValue(true);
        publishPlatformEventMock.mockResolvedValue({ id: 21 });
    });

    it('authorization bo\'lmasa 401 qaytaradi', async () => {
        isAuthorizedTelegramOpsRequestMock.mockResolvedValue(false);

        const response = await POST(new Request('http://localhost/api/telegram/order', {
            method: 'POST',
            body: JSON.stringify({ items: [] }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'Unauthorized',
        });
    });

    it('items ichidagi noto\'g\'ri quantity uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/telegram/order', {
            method: 'POST',
            body: JSON.stringify({
                items: [{ name: 'Quti', quantity: '2', price: 12000 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: "items[0].quantity son bo'lishi kerak",
        });
        expect(sendManualOrderNotificationToAdminChatsMock).not.toHaveBeenCalled();
    });

    it('notification va event publisherni chaqiradi', async () => {
        const response = await POST(new Request('http://localhost/api/telegram/order', {
            method: 'POST',
            body: JSON.stringify({
                id: '<b>42</b>',
                contactName: 'Ali <script>',
                contactPhone: '+99890<123>',
                address: 'Yunusobod <1-kvartal>',
                comment: 'Salom & xayr',
                totalAmount: 15000,
                items: [{ name: 'Box <XL>', quantity: 2, price: 7500 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(200);
        expect(sendManualOrderNotificationToAdminChatsMock).toHaveBeenCalledWith(expect.objectContaining({
            id: '<b>42</b>',
            contactName: 'Ali <script>',
            totalAmount: 15000,
            items: [{ name: 'Box <XL>', quantity: 2, price: 7500 }],
        }));
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'order.notification_requested',
            severity: 'success',
        }));
        await expect(response.json()).resolves.toEqual({ success: true });
    });
});
