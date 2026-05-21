/** @jest-environment node */

const recycleRequestUpdateMock = jest.fn();
const publishPlatformEventMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        recycleRequest: {
            update: (...args: unknown[]) => recycleRequestUpdateMock(...args),
        },
    },
}));

jest.mock('@/lib/platform/events', () => ({
    publishPlatformEvent: (...args: unknown[]) => publishPlatformEventMock(...args),
}));

import { PUT } from '@/app/api/admin/recycling/requests/[id]/route';

describe('PUT /api/admin/recycling/requests/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        recycleRequestUpdateMock.mockResolvedValue({
            id: 44,
            assignedDriverId: 7,
            supervisorId: 5,
            pointId: 3,
            point: null,
            supervisor: null,
            assignedDriver: null,
        });
        publishPlatformEventMock.mockResolvedValue({ id: 1 });
    });

    it('noto\'g\'ri id uchun 400 qaytaradi', async () => {
        const response = await PUT(
            new Request('http://localhost/api/admin/recycling/requests/abc', {
                method: 'PUT',
                body: JSON.stringify({ status: 'completed' }),
                headers: { 'Content-Type': 'application/json' },
            }),
            { params: Promise.resolve({ id: 'abc' }) },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'id musbat butun son bo\'lishi kerak',
        });
    });

    it('completed status uchun success event yozadi', async () => {
        const response = await PUT(
            new Request('http://localhost/api/admin/recycling/requests/44', {
                method: 'PUT',
                body: JSON.stringify({ status: 'completed', completedNote: 'Tayyor' }),
                headers: { 'Content-Type': 'application/json' },
            }),
            { params: Promise.resolve({ id: '44' }) },
        );

        expect(response.status).toBe(200);
        expect(publishPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'recycling.request.completed',
            severity: 'success',
            entityId: 44,
            requestId: 44,
            notifyAdmins: false,
            payload: expect.objectContaining({
                status: 'completed',
                completedNote: 'Tayyor',
            }),
        }));
    });
});
