/** @jest-environment node */

const getServerSessionMock = jest.fn();
const productFindUniqueMock = jest.fn();
const productFindManyMock = jest.fn();
const orderFindFirstMock = jest.fn();
const orderCreateMock = jest.fn();
const orderUpdateMock = jest.fn();
const orderItemDeleteManyMock = jest.fn();
const sendWebsiteOrderCreatedToAdminChatsMock = jest.fn();
const publishPlatformEventMock = jest.fn();
const validateAndReserveStockMock = jest.fn();

jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(),
    getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

jest.mock('@/lib/domain/stockValidation', () => ({
    validateAndReserveStock: (...args: unknown[]) => validateAndReserveStockMock(...args),
    formatStockErrors: (errors: { productName: string; available: number; requested: number }[]) =>
        errors.map((e) => `"${e.productName}" — omborda ${e.available} ta bor, ${e.requested} ta so'ralgan`).join('; '),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        product: {
            findUnique: (...args: unknown[]) => productFindUniqueMock(...args),
            findMany: (...args: unknown[]) => productFindManyMock(...args),
        },
        order: {
            findFirst: (...args: unknown[]) => orderFindFirstMock(...args),
            create: (...args: unknown[]) => orderCreateMock(...args),
            update: (...args: unknown[]) => orderUpdateMock(...args),
        },
        orderItem: {
            deleteMany: (...args: unknown[]) => orderItemDeleteManyMock(...args),
        },
        $transaction: async (fn: (tx: {
            order: { create: typeof orderCreateMock };
        }) => Promise<unknown>) => {
            const tx = { order: { create: orderCreateMock } };
            return fn(tx);
        },
    },
}));

jest.mock('@/lib/platform/telegramCommands', () => ({
    sendWebsiteOrderCreatedToAdminChats: (...args: unknown[]) => sendWebsiteOrderCreatedToAdminChatsMock(...args),
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

import { Prisma } from '@prisma/client';
import { toNumber } from '@/lib/money';
import { POST } from '@/app/api/orders/route';

describe('POST /api/orders route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getServerSessionMock.mockResolvedValue(null);
        validateAndReserveStockMock.mockResolvedValue({ ok: true });
        sendWebsiteOrderCreatedToAdminChatsMock.mockResolvedValue(true);
        publishPlatformEventMock.mockResolvedValue({ id: 99 });
        orderFindFirstMock.mockResolvedValue(null);
        productFindUniqueMock.mockResolvedValue({ id: 1, price: new Prisma.Decimal(5000) });
        productFindManyMock.mockResolvedValue([{ id: 1, price: new Prisma.Decimal(5000) }]);
        orderCreateMock.mockResolvedValue({
            id: 12,
            customerName: 'Ali <Test>',
            contactPhone: '+998901234567',
            shippingAddress: 'Yunusobod <4>',
            shippingLocation: '41.3,69.2',
            totalAmount: new Prisma.Decimal(10000),
            status: 'new',
            paymentMethod: 'cash',
            deliveryMethod: 'courier',
            items: [
                {
                    quantity: 2,
                    price: new Prisma.Decimal(5000),
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
            }),
        }));
        const createData = orderCreateMock.mock.calls[0][0].data;
        // 2 x 5000 + 20000 kuryer
        expect(toNumber(createData.totalAmount)).toBe(30000);
        expect(toNumber(createData.items.create[0].price)).toBe(5000);
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
        const body = await response.json();
        expect(body).toMatchObject({ id: 12 });
        expect(toNumber(body.totalAmount)).toBe(10000);
    });

    it('mijoz yuborgan narx, jami summa va statusni e\'tiborsiz qoldiradi', async () => {
        const response = await POST(new Request('http://localhost/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Ali',
                contactPhone: '+998901234567',
                deliveryMethod: 'pickup',
                status: 'delivered',
                totalAmount: 1,
                items: [{ productId: 1, quantity: 3, price: 1 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(200);
        const createData = orderCreateMock.mock.calls[0][0].data;
        expect(toNumber(createData.items.create[0].price)).toBe(5000);
        expect(toNumber(createData.totalAmount)).toBe(15000);
        expect(createData.status).toBe('new_');
    });

    it('bazada yo\'q mahsulot uchun 400 qaytaradi', async () => {
        productFindManyMock.mockResolvedValue([]);
        const response = await POST(new Request('http://localhost/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Ali',
                contactPhone: '+998901234567',
                items: [{ productId: 999, quantity: 1, price: 5000 }],
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        expect(orderCreateMock).not.toHaveBeenCalled();
    });
});
