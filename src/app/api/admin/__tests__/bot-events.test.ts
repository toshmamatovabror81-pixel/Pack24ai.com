/** @jest-environment node */

const findManyMock = jest.fn();
const countMock = jest.fn();
const groupByMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        botEvent: {
            findMany: (...args: unknown[]) => findManyMock(...args),
            count: (...args: unknown[]) => countMock(...args),
            groupBy: (...args: unknown[]) => groupByMock(...args),
        },
    },
}));

import { GET } from '@/app/api/admin/bot-events/route';

describe('GET /api/admin/bot-events', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        findManyMock.mockResolvedValue([
            {
                id: 1,
                sourceBot: 'platform',
                eventType: 'recycling.request.completed',
                title: 'Done',
            },
        ]);
        countMock
            .mockResolvedValueOnce(10)
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(3);
        groupByMock
            .mockResolvedValueOnce([
                { sourceBot: 'platform', _count: { _all: 7 } },
                { sourceBot: 'driver', _count: { _all: 3 } },
            ])
            .mockResolvedValueOnce([
                { eventType: 'order.created', _count: { _all: 5 } },
                { eventType: 'recycling.request.completed', _count: { _all: 2 } },
            ])
            .mockResolvedValueOnce([
                { entityType: 'order', _count: { _all: 5 } },
                { entityType: 'recycle_request', _count: { _all: 2 } },
            ]);
    });

    it('eventType, entity va date filterlar bilan where ni qo\'llaydi', async () => {
        const response = await GET(
            new Request('http://localhost/api/admin/bot-events?sourceBot=platform&eventType=recycling.request.completed&entityType=recycle_request&entityId=44&from=2026-04-01&to=2026-04-30&severity=success&status=new&q=done') as never,
        );

        expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                sourceBot: 'platform',
                eventType: 'recycling.request.completed',
                entityType: 'recycle_request',
                entityId: 44,
                createdAt: {
                    gte: new Date('2026-04-01T00:00:00.000Z'),
                    lte: new Date('2026-04-30T23:59:59.999Z'),
                },
                severity: 'success',
                status: 'new',
                OR: [
                    { title: { contains: 'done', mode: 'insensitive' } },
                    { message: { contains: 'done', mode: 'insensitive' } },
                ],
            }),
        }));
        expect(groupByMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
            by: ['eventType'],
            where: expect.objectContaining({
                eventType: 'recycling.request.completed',
            }),
        }));
        expect(groupByMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
            by: ['entityType'],
            where: expect.objectContaining({
                entityType: 'recycle_request',
                entityId: 44,
            }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            summary: {
                total: 10,
                unread: 4,
                critical: 3,
                bySource: [
                    { sourceBot: 'platform', count: 7 },
                    { sourceBot: 'driver', count: 3 },
                ],
                byEventType: [
                    { eventType: 'order.created', count: 5 },
                    { eventType: 'recycling.request.completed', count: 2 },
                ],
                byEntityType: [
                    { entityType: 'order', count: 5 },
                    { entityType: 'recycle_request', count: 2 },
                ],
            },
        });
    });

    it('noto\'g\'ri entityId uchun 400 qaytaradi', async () => {
        const response = await GET(
            new Request('http://localhost/api/admin/bot-events?entityId=0') as never,
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'entityId musbat butun son bo\'lishi kerak',
        });
    });

    it('noto\'g\'ri from format uchun 400 qaytaradi', async () => {
        const response = await GET(
            new Request('http://localhost/api/admin/bot-events?from=04-01-2026') as never,
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'from YYYY-MM-DD formatda bo\'lishi kerak',
        });
    });
});
