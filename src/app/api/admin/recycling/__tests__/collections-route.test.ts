/** @jest-environment node */

const recycleCollectionFindUniqueMock = jest.fn();
const recycleCollectionUpdateMock = jest.fn();
const recycleRequestUpdateMock = jest.fn();
const supervisorFindUniqueMock = jest.fn();
const notifyCustomerMock = jest.fn();
const notifySalesChatsMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        recycleCollection: {
            findUnique: (...args: unknown[]) => recycleCollectionFindUniqueMock(...args),
            update: (...args: unknown[]) => recycleCollectionUpdateMock(...args),
        },
        recycleRequest: {
            update: (...args: unknown[]) => recycleRequestUpdateMock(...args),
        },
        supervisor: {
            findUnique: (...args: unknown[]) => supervisorFindUniqueMock(...args),
        },
    },
}));

jest.mock('@/lib/telegram/notifier', () => ({
    notifyCustomer: (...args: unknown[]) => notifyCustomerMock(...args),
    notifySalesChats: (...args: unknown[]) => notifySalesChatsMock(...args),
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

import { PUT } from '@/app/api/admin/recycling/collections/[id]/route';

describe('PUT /api/admin/recycling/collections/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        recycleCollectionFindUniqueMock.mockResolvedValue({
            id: 30,
            requestId: 11,
            driverId: 6,
            actualWeight: 120,
            totalAmount: 50000,
            request: {
                id: 11,
                supervisorId: 2,
                regionId: 9,
                customerTgId: '1001',
            },
            driver: {
                id: 6,
                name: 'Driver',
                telegramId: '2002',
            },
        });
        recycleCollectionUpdateMock.mockResolvedValue({
            id: 30,
            request: { point: null },
            driver: { id: 6 },
        });
        recycleRequestUpdateMock.mockResolvedValue({});
        supervisorFindUniqueMock.mockResolvedValue({ telegramId: null });
        notifyCustomerMock.mockResolvedValue(undefined);
        notifySalesChatsMock.mockResolvedValue(true);
        publishPlatformEventMock.mockResolvedValue({ id: 2 });
    });

    it('customerConfirmed noto\'g\'ri bo\'lsa 400 qaytaradi', async () => {
        const response = await PUT(
            new Request('http://localhost/api/admin/recycling/collections/30', {
                method: 'PUT',
                body: JSON.stringify({ customerConfirmed: 'yes' }),
                headers: { 'Content-Type': 'application/json' },
            }) as never,
            { params: Promise.resolve({ id: '30' }) },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'customerConfirmed true/false bo\'lishi kerak',
        });
    });

    it('payment status uchun normalized event yozadi', async () => {
        const response = await PUT(
            new Request('http://localhost/api/admin/recycling/collections/30', {
                method: 'PUT',
                body: JSON.stringify({
                    paymentStatus: 'completed',
                    paymentToDriver: '20000',
                    paymentToCustomer: '30000',
                    paidBy: 'admin',
                }),
                headers: { 'Content-Type': 'application/json' },
            }) as never,
            { params: Promise.resolve({ id: '30' }) },
        );

        expect(response.status).toBe(200);
        expect(notifySalesChatsMock).toHaveBeenCalled();
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'recycling.payment.updated',
            severity: 'success',
            entityType: 'recycle_collection',
            entityId: 30,
            requestId: 11,
            collectionId: 30,
            notifyAdmins: false,
            payload: expect.objectContaining({
                paymentStatus: 'completed',
                paymentToDriver: 20000,
                paymentToCustomer: 30000,
                paidBy: 'admin',
            }),
        }));
    });
});
