/** @jest-environment node */

const recycleRequestFindUniqueMock = jest.fn();
const recycleRequestUpdateMock = jest.fn();
const supervisorFindUniqueMock = jest.fn();
const driverUpdateMock = jest.fn();
const notifyCustomerMock = jest.fn();
const notifySalesChatsMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        recycleRequest: {
            findUnique: (...args: unknown[]) => recycleRequestFindUniqueMock(...args),
            update: (...args: unknown[]) => recycleRequestUpdateMock(...args),
        },
        supervisor: {
            findUnique: (...args: unknown[]) => supervisorFindUniqueMock(...args),
        },
        driver: {
            update: (...args: unknown[]) => driverUpdateMock(...args),
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

import { POST } from '@/app/api/admin/recycling/dispatch/route';

describe('POST /api/admin/recycling/dispatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        notifySalesChatsMock.mockResolvedValue(true);
        notifyCustomerMock.mockResolvedValue(undefined);
        publishPlatformEventMock.mockResolvedValue({ id: 1 });
        driverUpdateMock.mockResolvedValue({});
    });

    it('noto\'g\'ri requestId uchun 400 qaytaradi', async () => {
        const response = await POST(new Request('http://localhost/api/admin/recycling/dispatch', {
            method: 'POST',
            body: JSON.stringify({
                action: 'dispatch_to_supervisor',
                requestId: 0,
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'requestId musbat butun son bo\'lishi kerak',
        });
    });

    it('dispatch_to_supervisor holatida event yozadi', async () => {
        recycleRequestFindUniqueMock.mockResolvedValue({
            id: 17,
            name: 'Ali',
            phone: '+998901234567',
            point: { regionUz: 'Yunusobod' },
            pickupType: 'pickup',
            address: 'Yunusobod 4',
            material: 'Qog\'oz',
            volume: 20,
            regionId: 9,
        });
        supervisorFindUniqueMock.mockResolvedValue({
            id: 4,
            name: 'Supervisor',
            telegramId: null,
        });
        recycleRequestUpdateMock.mockResolvedValue({
            id: 17,
            supervisorId: 4,
            assignedDriverId: null,
            status: 'dispatched',
            regionId: 9,
        });

        const response = await POST(new Request('http://localhost/api/admin/recycling/dispatch', {
            method: 'POST',
            body: JSON.stringify({
                action: 'dispatch_to_supervisor',
                requestId: 17,
                supervisorId: 4,
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(200);
        expect(notifySalesChatsMock).toHaveBeenCalled();
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'recycling.request.dispatched',
            entityType: 'recycle_request',
            entityId: 17,
            requestId: 17,
            supervisorId: 4,
            severity: 'info',
            notifyAdmins: false,
        }));
    });

    it('cancel_request holatida warning event yozadi', async () => {
        recycleRequestFindUniqueMock.mockResolvedValue({
            id: 18,
            name: 'Vali',
            phone: '+998909999999',
            customerTgId: '123456',
            assignedDriverId: 5,
            supervisorId: 2,
            regionId: 11,
        });
        recycleRequestUpdateMock.mockResolvedValue({
            id: 18,
            status: 'cancelled',
            assignedDriverId: 5,
            supervisorId: 2,
            regionId: 11,
        });

        const response = await POST(new Request('http://localhost/api/admin/recycling/dispatch', {
            method: 'POST',
            body: JSON.stringify({
                action: 'cancel_request',
                requestId: 18,
                note: 'Klient bekor qildi',
            }),
            headers: { 'Content-Type': 'application/json' },
        }) as never);

        expect(response.status).toBe(200);
        expect(driverUpdateMock).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { status: 'active' },
        });
        expect(notifyCustomerMock).toHaveBeenCalled();
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'recycling.request.cancelled',
            severity: 'warning',
            entityId: 18,
            payload: expect.objectContaining({
                action: 'cancel_request',
                note: 'Klient bekor qildi',
            }),
        }));
    });
});
