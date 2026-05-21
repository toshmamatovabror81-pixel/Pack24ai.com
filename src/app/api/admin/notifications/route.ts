import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { getRouteCache, setRouteCache, routeCacheTtl } from '@/lib/cache/routeCache';

// ─── GET /api/admin/notifications — Yangi bildirishnomalar ───────────────────
// Admin panel har 30–60 sekundda bu endpointni polling qiladi
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const since = searchParams.get('since');
        const cacheKey = `admin-notifications:${since ?? 'default'}`;
        const cached = getRouteCache<Record<string, unknown>>(cacheKey);
        if (cached) {
            return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
        }

        const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 1000); // last 60s

        const [newOrders, newOrdersCount] = await Promise.all([
            prisma.order.findMany({
                where: {
                    status: OrderStatus.new_,
                    createdAt: { gte: sinceDate },
                },
                select: {
                    id: true,
                    customerName: true,
                    contactPhone: true,
                    totalAmount: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.order.count({ where: { status: OrderStatus.new_ } }),
        ]);

        const body = {
            newOrders,
            newOrdersCount,
            timestamp: new Date().toISOString(),
        };
        setRouteCache(cacheKey, body, routeCacheTtl(20_000));
        return NextResponse.json(body, { headers: { 'X-Cache': 'MISS' } });
    } catch (error) {
        console.error('[API/admin/notifications]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
