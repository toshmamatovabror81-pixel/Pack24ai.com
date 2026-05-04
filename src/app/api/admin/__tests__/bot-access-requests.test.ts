/** @jest-environment node */

const findManyMock = jest.fn();
const groupByMock = jest.fn();
const createOrReuseMock = jest.fn();
const approveMock = jest.fn();
const rejectMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        botAccessRequest: {
            findMany: (...args: unknown[]) => findManyMock(...args),
            groupBy: (...args: unknown[]) => groupByMock(...args),
        },
    },
}));

jest.mock('@/lib/telegram/botAccessRequests', () => ({
    createOrReuseBotAccessRequest: (...args: unknown[]) => createOrReuseMock(...args),
    approveBotAccessRequest: (...args: unknown[]) => approveMock(...args),
    rejectBotAccessRequest: (...args: unknown[]) => rejectMock(...args),
}));

import { GET, POST } from '@/app/api/admin/bot-access-requests/route';
import { PUT } from '@/app/api/admin/bot-access-requests/[id]/route';

describe('bot access request admin API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        findManyMock.mockResolvedValue([]);
        groupByMock.mockResolvedValue([]);
    });

    it('role va status filterlari bilan arizalarni qaytaradi', async () => {
        const response = await GET(
            new Request('http://localhost/api/admin/bot-access-requests?role=driver&status=pending') as never,
        );

        expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'pending', role: 'driver' },
        }));
        expect(response.status).toBe(200);
    });

    it('yangi pending ariza yaratadi', async () => {
        createOrReuseMock.mockResolvedValueOnce({
            kind: 'created',
            request: { id: 1, role: 'driver', status: 'pending' },
        });

        const response = await POST(new Request('http://localhost/api/admin/bot-access-requests', {
            method: 'POST',
            body: JSON.stringify({ role: 'driver', name: 'Ali', phone: '901234567' }),
        }) as never);

        expect(createOrReuseMock).toHaveBeenCalledWith(expect.objectContaining({
            role: 'driver',
            name: 'Ali',
            phone: '901234567',
            sourceBot: 'platform',
        }));
        expect(response.status).toBe(201);
    });

    it('approve actionni helperga uzatadi', async () => {
        approveMock.mockResolvedValueOnce({ request: { id: 7, status: 'approved' } });

        const response = await PUT(
            new Request('http://localhost/api/admin/bot-access-requests/7', {
                method: 'PUT',
                body: JSON.stringify({ action: 'approve', approvedBySupervisorId: 3 }),
            }) as never,
            { params: Promise.resolve({ id: '7' }) },
        );

        expect(approveMock).toHaveBeenCalledWith(7, expect.objectContaining({
            approvedBySupervisorId: 3,
        }));
        expect(response.status).toBe(200);
    });

    it('reject actionni helperga uzatadi', async () => {
        rejectMock.mockResolvedValueOnce({ id: 8, status: 'rejected' });

        const response = await PUT(
            new Request('http://localhost/api/admin/bot-access-requests/8', {
                method: 'PUT',
                body: JSON.stringify({ action: 'reject', reason: 'duplicate' }),
            }) as never,
            { params: Promise.resolve({ id: '8' }) },
        );

        expect(rejectMock).toHaveBeenCalledWith(8, expect.objectContaining({
            reason: 'duplicate',
        }));
        expect(response.status).toBe(200);
    });
});
