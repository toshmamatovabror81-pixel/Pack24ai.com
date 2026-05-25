import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

// ─── GET /api/admin/stats — Dashboard uchun real statistika ──────────────────
export async function GET(_req: NextRequest) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        // Parallel queries
        const [
            totalOrders,
            newOrders,
            thisMonthOrders,
            lastMonthOrders,
            totalProducts,
            totalCategories,
            recentOrders,
        ] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { status: OrderStatus.new_ } }),
            prisma.order.findMany({
                where: { createdAt: { gte: startOfMonth } },
                select: { totalAmount: true, status: true },
            }),
            prisma.order.findMany({
                where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
                select: { totalAmount: true },
            }),
            prisma.product.count(),
            prisma.category.count(),
            prisma.order.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    customerName: true,
                    contactPhone: true,
                    totalAmount: true,
                    status: true,
                    createdAt: true,
                },
            }),
        ]);

        const thisMonthRevenue = thisMonthOrders.reduce((acc: number, o: { totalAmount: number | null, status: string }) => acc + (o.totalAmount ?? 0), 0);
        const lastMonthRevenue = lastMonthOrders.reduce((acc: number, o: { totalAmount: number | null }) => acc + (o.totalAmount ?? 0), 0);
        const revenueGrowth = lastMonthRevenue > 0
            ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
            : '0';

        // Last 7 days orders by day
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        const last7 = await prisma.order.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true, totalAmount: true, status: true },
        });

        const dayLabels = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(sevenDaysAgo);
            d.setDate(sevenDaysAgo.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        const chartData = dayLabels.map(day => {
            const dayOrders = last7.filter((o: { createdAt: Date, totalAmount: number | null, status: string }) => o.createdAt.toISOString().split('T')[0] === day);
            return {
                name: new Date(day).toLocaleDateString('ru-RU', { weekday: 'short' }),
                orders: dayOrders.length,
                revenue: dayOrders.reduce((acc: number, o: { totalAmount: number | null }) => acc + (o.totalAmount ?? 0), 0),
            };
        });

        return NextResponse.json({
            totalOrders,
            newOrders,
            thisMonthRevenue,
            lastMonthRevenue,
            revenueGrowth: parseFloat(revenueGrowth),
            totalProducts,
            totalCategories,
            recentOrders,
            chartData,
        });
    } catch (error) {
        console.error('[API/admin/stats]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
