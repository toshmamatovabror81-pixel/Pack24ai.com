/** @jest-environment node */

const notifyLegacyAdminChatsMock = jest.fn();

jest.mock('@/lib/telegram/notifier', () => ({
    notifyLegacyAdminChats: (...args: unknown[]) => notifyLegacyAdminChatsMock(...args),
}));

import {
    buildLowStockAdminText,
    buildManualOrderAdminText,
    buildWebsiteOrderCreatedAdminText,
    sendLowStockAlertToAdminChats,
    sendManualOrderNotificationToAdminChats,
    sendWebsiteOrderCreatedToAdminChats,
} from '@/lib/platform/telegramCommands';

describe('telegramCommands', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        notifyLegacyAdminChatsMock.mockResolvedValue(true);
    });

    it('website order xabarida HTML qiymatlarni escape qiladi', () => {
        const text = buildWebsiteOrderCreatedAdminText({
            id: 12,
            customerName: 'Ali <Test>',
            contactPhone: '+99890<123>',
            shippingAddress: 'Yunusobod <4>',
            shippingLocation: '41.3,69.2',
            totalAmount: 10000,
            status: 'new',
            paymentMethod: 'cash',
            deliveryMethod: 'courier',
            items: [{ name: 'Quti <XL>', quantity: 2, price: 5000 }],
        });

        expect(text).toContain('Ali &lt;Test&gt;');
        expect(text).toContain('Quti &lt;XL&gt;');
        expect(text).toContain('+99890&lt;123&gt;');
        expect(text).toContain('https://www.google.com/maps?q=41.3%2C69.2');
    });

    it('manual order xabarida HTML qiymatlarni escape qiladi', () => {
        const text = buildManualOrderAdminText({
            id: '<b>42</b>',
            contactName: 'Ali <script>',
            contactPhone: '+99890<123>',
            address: 'Yunusobod <1-kvartal>',
            comment: 'Salom & xayr',
            totalAmount: 15000,
            items: [{ name: 'Box <XL>', quantity: 2, price: 7500 }],
        });

        expect(text).toContain('&lt;b&gt;42&lt;/b&gt;');
        expect(text).toContain('Ali &lt;script&gt;');
        expect(text).toContain('Box &lt;XL&gt;');
        expect(text).toContain('Salom &amp; xayr');
    });

    it('low-stock xabarida HTML qiymatlarni escape qiladi', () => {
        const text = buildLowStockAdminText([
            { name: 'Qog\'oz <A4>', sku: 'P-<01>', quantity: 2 },
        ], 10);

        expect(text).toContain('Qog\'oz &lt;A4&gt;');
        expect(text).toContain('P-&lt;01&gt;');
    });

    it('website order command notifierga yuboradi', async () => {
        await sendWebsiteOrderCreatedToAdminChats({
            id: 12,
            customerName: 'Ali',
            contactPhone: '+998901234567',
            shippingAddress: 'Yunusobod',
            totalAmount: 10000,
            status: 'new',
            items: [{ name: 'Quti', quantity: 2, price: 5000 }],
        });

        expect(notifyLegacyAdminChatsMock).toHaveBeenCalledTimes(1);
    });

    it('manual order command notifierga yuboradi', async () => {
        await sendManualOrderNotificationToAdminChats({
            id: 42,
            contactName: 'Ali',
            totalAmount: 15000,
            items: [{ name: 'Quti', quantity: 2, price: 7500 }],
        });

        expect(notifyLegacyAdminChatsMock).toHaveBeenCalledTimes(1);
    });

    it('low-stock command bo\'sh itemlarda notifierni chaqirmaydi', async () => {
        const result = await sendLowStockAlertToAdminChats([], 10);

        expect(result).toBe(false);
        expect(notifyLegacyAdminChatsMock).not.toHaveBeenCalled();
    });
});
