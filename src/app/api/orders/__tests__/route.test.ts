/** @jest-environment node */

const getServerSessionMock = jest.fn();
const productFindUniqueMock = jest.fn();
const orderFindFirstMock = jest.fn();
const orderCreateMock = jest.fn();
const orderUpdateMock = jest.fn();
const orderItemDeleteManyMock = jest.fn();
const sendWebsiteOrderCreatedToAdminChatsMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(),
    getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        product: {
            findUnique: (...args: unknown[]) => productFindUniqueMock(...args),
        },
        order: {
            findFirst: (...args: unknown[]) => orderFindFirstMock(...args),
            create: (...args: unknown[]) => orderCreateMock(...args),
            update: (...args: unknown[]) => orderUpdateMock(...args),
        },
        orderItem: {
            deleteMany: (...args: unknown[]) => orderItemDeleteManyMock(...args),
        },
    },
}));

jest.mock('@/lib/platform/telegramCommands', () => ({
    sendWebsiteOrderCreatedToAdminChats: (...args: unknown[]) => sendWebsiteOrderCreatedToAdminChatsMock(...args),
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

import { POST } from '@/app/api/orders/route';

describe('POST /api/orders route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getServerSessionMock.mockResolvedValue(null);
        sendWebsiteOrderCreatedToAdminChatsMock.mockResolvedValue(true);
        publishPlatformEventMock.mockResolvedValue({ id: 99 });
        orderFindFirstMock.mockResolvedValue(null);
        productFindUniqueMock.mockResolvedValue({ id: 1, price: 5000 });
        orderCreateMock.mockResolvedValue({
            id: 12,
            customerName: 'Ali <Test>',
            contactPhone: '+998901234567',
            shippingAddress: 'Yunusobod <4>',
            shippingLocation: '41.3,69.2',
            totalAmount: 10000,
            status: 'new',
            paymentMethod: 'cash',
            deliveryMethod: 'courier',
            items: [
                {
                    quantity: 2,
                    price: 5000,
                    product: { name: 'Quti <XL>' },
                },
            ],
        });
    });

    it('noto\'g\'ri deliveryMethod uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Ali',
                contactPhone: '+998901234567',
                deliveryMethod: 'drone',
                items: [{ productId: 1, quantity: 1, price: 5000 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "deliveryMethod quyidagilardan biri bo'lishi kerak: courier, pickup",
        });
    });

    it('noto\'g\'ri quantity uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Ali',
                contactPhone: '+998901234567',
                items: [{ productId: 1, quantity: 0, price: 5000 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "items[0].quantity musbat butun son bo'lishi kerak",
        });
    });

    it('to\'g\'ri payload bo\'lsa buyurtma yaratadi va telegram notification yuboradi', async () => {
        const response = await POST(new Request('http://localhost/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Ali <Test>',
                contactPhone: '+998901234567',
                shippingAddress: 'Yunusobod <4>',
                shippingLocation: '41.3,69.2',
                items: [{ productId: 1, quantity: 2, price: 5000 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(orderCreateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                customerName: 'Ali <Test>',
                contactPhone: '+998901234567',
                deliveryMethod: 'courier',
                paymentMethod: 'cash',
                paymentStatus: 'pending',
                totalAmount: 10000,
            }),
        }));
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'order.created',
            entityType: 'order',
            entityId: 12,
        }));
        expect(sendWebsiteOrderCreatedToAdminChatsMock).toHaveBeenCalledWith(expect.objectContaining({
            id: 12,
            customerName: 'Ali <Test>',
            items: [{ quantity: 2, price: 5000, name: 'Quti <XL>' }],
        }));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            id: 12,
            totalAmount: 10000,
        });
    });
});
