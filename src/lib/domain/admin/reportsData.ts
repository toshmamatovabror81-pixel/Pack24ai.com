import { prisma } from '@/lib/prisma';
import { OrderStatus, RecycleRequestStatus } from '@prisma/client';
import { calculateOrderSummaries } from '@/lib/domain/admin/reports';

// ─── Response shape interfaces ────────────────────────────────────────────────

export interface AdminReportParams {
    from: Date;
    toExclusive: Date;
    days: number;
    prevFrom: Date;
    prevTo: Date;
}

export interface AdminReportData {
    summary: {
        totalOrders: number;
        newOrders: number;
        totalRevenue: number;
        periodOrders: number;
        periodRevenue: number;
        completedOrders: number;
        conversionRate: number;
        aov: number;
        cancelRate: number;
        repeatRate: number;
        cancelledOrders: number;
        peakHour: number;
    };
    trends: {
        ordersGrowth: number;
        revenueGrowth: number;
        conversionChange: number;
    };
    topProducts: Array<{
        productId: number | null;
        name: string;
        image: string | null;
        price: number;
        totalSold: number;
        orderCount: number;
    }>;
    ordersByStatus: Array<{
        status: string;
        _count: { status: number };
    }>;
    dailyRevenue: Array<{
        date: string;
        revenue: number;
        orders: number;
    }>;
    funnelData: {
        draft: number;
        new: number;
        processing: number;
        shipping: number;
        delivered: number;
        cancelled: number;
    };
    regionSales: Array<{
        region: string;
        orders: number;
        revenue: number;
    }>;
    botReports: {
        customer: {
            uniqueUsers: number;
            totalRequests: number;
            pickupRequests: number;
            selfDeliveryRequests: number;
            confirmedRequests: number;
            disputedRequests: number;
        };
        driver: {
            totalCollections: number;
            totalWeight: number;
            totalAmount: number;
            pendingPayments: number;
        };
        admin: {
            assignedRequests: number;
            completedRequests: number;
            approvedPaymentsCount: number;
            approvedPaymentsAmount: number;
        };
        topDrivers: Array<{
            driverId: number;
            name: string;
            phone: string;
            isOnline: boolean;
            status: string;
            collections: number;
            totalWeight: number;
            totalAmount: number;
        }>;
        topSupervisors: Array<{
            supervisorId: number;
            name: string;
            phone: string;
            assignedRequests: number;
            completedRequests: number;
            approvedPaymentsCount: number;
            approvedPaymentsAmount: number;
        }>;
    };
    period: number;
}

// ─── Main data-fetching & aggregation function ────────────────────────────────

export async function fetchAdminReportData(params: AdminReportParams): Promise<AdminReportData> {
    const { from, toExclusive, days, prevFrom, prevTo } = params;

    const [
        totalOrders,
        newOrders,
        totalRevenue,
        periodOrders,
        prevPeriodOrders,
        topProducts,
        ordersByStatus,
        dailyRevenue,
        // Yangi: takroriy mijozlar
        repeatCustomers,
        requestByPickupType,
        requestByRecycleStatus,
        uniqueRecycleUsers,
        driverCollections,
        pendingDriverPayments,
        supervisorRequests,
        supervisorCompleted,
        approvedPayments,
    ] = await Promise.all([
        // 1. Jami buyurtmalar
        prisma.order.count(),

        // 2. Yangi buyurtmalar (so'nggi 24 soat)
        prisma.order.count({
            where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),

        // 3. Barcha vaqt daromad
        prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { status: { notIn: ['cancelled', 'draft'] } },
        }),

        // 4. Joriy davr buyurtmalari
        prisma.order.findMany({
            where: { createdAt: { gte: from, lt: toExclusive } },
            orderBy: { createdAt: 'asc' },
            select: { id: true, totalAmount: true, status: true, createdAt: true, contactPhone: true },
        }),

        // 5. Oldingi davr buyurtmalari (trend uchun)
        prisma.order.findMany({
            where: { createdAt: { gte: prevFrom, lt: prevTo } },
            select: { id: true, totalAmount: true, status: true },
        }),

        // 6. Top mahsulotlar
        prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            _count: { productId: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10,
        }),

        // 7. Status bo'yicha
        prisma.order.groupBy({
            by: ['status'],
            _count: { status: true },
            where: { createdAt: { gte: from, lt: toExclusive } },
        }),

        // 8. Kunlik daromad
        prisma.$queryRaw<{ date: string; total: number; count: number }[]>`
            SELECT
                DATE("createdAt")::text as date,
                COALESCE(SUM("totalAmount"), 0) as total,
                COUNT(*) as count
            FROM "Order"
            WHERE "createdAt" >= NOW() - INTERVAL '14 days'
              AND status NOT IN ('cancelled', 'draft')
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `,

        // 9. Takroriy mijozlar (2+ buyurtma)
        prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(*) as count FROM (
                SELECT "contactPhone"
                FROM "Order"
                WHERE "contactPhone" IS NOT NULL
                  AND "contactPhone" != ''
                  AND status NOT IN ('draft')
                GROUP BY "contactPhone"
                HAVING COUNT(*) >= 2
            ) as repeats
        `,

        // 10. Customer bot: arizalar pickup turi bo'yicha
        prisma.recycleRequest.groupBy({
            by: ['pickupType'],
            _count: { _all: true },
            where: { createdAt: { gte: from, lt: toExclusive } },
        }),

        // 11. Customer bot: status bo'yicha arizalar
        prisma.recycleRequest.groupBy({
            by: ['status'],
            _count: { _all: true },
            where: { createdAt: { gte: from, lt: toExclusive } },
        }),

        // 12. Customer bot: unikal Telegram foydalanuvchilar
        prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(DISTINCT "customerTgId")::int as count
            FROM "RecycleRequest"
            WHERE "createdAt" >= ${from}
              AND "createdAt" < ${toExclusive}
              AND "customerTgId" IS NOT NULL
              AND "customerTgId" != ''
        `,

        // 13. Driver bot: yig'ishlar top haydovchilar kesimida
        prisma.recycleCollection.groupBy({
            by: ['driverId'],
            _count: { _all: true },
            _sum: { actualWeight: true, totalAmount: true },
            where: { createdAt: { gte: from, lt: toExclusive } },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 10,
        }),

        // 14. Driver bot: to'lovi kutilayotgan yig'ishlar
        prisma.recycleCollection.count({
            where: { createdAt: { gte: from, lt: toExclusive }, paymentStatus: 'pending' },
        }),

        // 15. Admin bot: supervisor bo'yicha arizalar
        prisma.recycleRequest.groupBy({
            by: ['supervisorId'],
            _count: { _all: true },
            where: { createdAt: { gte: from, lt: toExclusive }, supervisorId: { not: null } },
        }),

        // 16. Admin bot: supervisor bo'yicha yakunlangan arizalar
        prisma.recycleRequest.groupBy({
            by: ['supervisorId'],
            _count: { _all: true },
            where: {
                status: RecycleRequestStatus.completed,
                completedAt: { gte: from, lt: toExclusive },
                supervisorId: { not: null },
            },
        }),

        // 17. Admin bot: masullar tomonidan tasdiqlangan to'lovlar
        prisma.recycleCollection.groupBy({
            by: ['paidBy'],
            _count: { _all: true },
            _sum: { totalAmount: true },
            where: {
                paidAt: { gte: from, lt: toExclusive },
                paidBy: { not: null },
                paymentStatus: { in: ['paid_to_customer', 'paid_to_driver', 'paid_both', 'completed'] },
            },
        }),
    ]);

    // ─── Top mahsulotlar details ──────────────────────────────────────
    const productIds = topProducts.map(p => p.productId).filter(Boolean) as number[];
    const products   = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, image: true },
    });

    const topProductsWithDetails = topProducts.map(tp => {
        const prod = products.find((p: { id: number; name: string; price: number; image: string | null }) => p.id === tp.productId);
        return {
            productId:  tp.productId,
            name:       prod?.name ?? 'Mahsulot',
            image:      prod?.image ?? null,
            price:      prod?.price ?? 0,
            totalSold:  tp._sum.quantity ?? 0,
            orderCount: tp._count.productId,
        };
    });

    // ─── Kunlik daromad format ────────────────────────────────────────
    const daily = dailyRevenue.map(d => ({
        date:    d.date?.slice(5) ?? '',
        revenue: Number(d.total ?? 0),
        orders:  Number(d.count ?? 0),
    }));

    const repeatCount = Number(repeatCustomers?.[0]?.count ?? 0);
    const orderSummaries = calculateOrderSummaries(periodOrders, prevPeriodOrders, repeatCount);
    const curCount = orderSummaries.current.count;
    const curRevenue = orderSummaries.current.revenue;
    const curCompleted = orderSummaries.current.completed;
    const curCancelled = orderSummaries.current.cancelled;
    const curConversion = orderSummaries.current.conversion;
    const aov = orderSummaries.current.aov;
    const cancelRate = orderSummaries.current.cancelRate;
    const repeatRate = orderSummaries.current.repeatRate;
    const trends = orderSummaries.trends;

    // ─── Botlar bo'yicha KPI va jadvallar ────────────────────────────────
    const recycleStatusCountMap = new Map(
        requestByRecycleStatus.map((item) => [item.status, item._count._all])
    );
    const recyclePickupTypeMap = new Map(
        requestByPickupType.map((item) => [item.pickupType ?? 'unknown', item._count._all])
    );

    const customerBotKpi = {
        uniqueUsers: Number(uniqueRecycleUsers?.[0]?.count ?? 0),
        totalRequests: requestByRecycleStatus.reduce((sum, row) => sum + row._count._all, 0),
        pickupRequests: recyclePickupTypeMap.get('pickup') ?? 0,
        selfDeliveryRequests: recyclePickupTypeMap.get('base') ?? 0,
        confirmedRequests:
            (recycleStatusCountMap.get('confirmed') ?? 0) +
            (recycleStatusCountMap.get('completed') ?? 0),
        disputedRequests: recycleStatusCountMap.get('disputed') ?? 0,
    };

    const driverTotals = driverCollections.reduce(
        (acc, row) => {
            acc.collections += row._count._all;
            acc.totalWeight += Number(row._sum.actualWeight ?? 0);
            acc.totalAmount += Number(row._sum.totalAmount ?? 0);
            return acc;
        },
        { collections: 0, totalWeight: 0, totalAmount: 0 }
    );

    const driverIds = driverCollections.map((row) => row.driverId).filter(Boolean) as number[];
    const drivers = driverIds.length > 0
        ? await prisma.driver.findMany({
            where: { id: { in: driverIds } },
            select: { id: true, name: true, phone: true, isOnline: true, status: true },
        })
        : [];
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const topDrivers = driverCollections.map((row) => {
        const driver = driverMap.get(row.driverId);
        return {
            driverId: row.driverId,
            name: driver?.name ?? `Haydovchi #${row.driverId}`,
            phone: driver?.phone ?? '—',
            isOnline: driver?.isOnline ?? false,
            status: driver?.status ?? 'unknown',
            collections: row._count._all,
            totalWeight: Number(row._sum.actualWeight ?? 0),
            totalAmount: Number(row._sum.totalAmount ?? 0),
        };
    });

    const adminAssignedMap = new Map(
        supervisorRequests.map((row) => [row.supervisorId as number, row._count._all])
    );
    const adminCompletedMap = new Map(
        supervisorCompleted.map((row) => [row.supervisorId as number, row._count._all])
    );
    const paymentBySupervisorNameMap = new Map(
        approvedPayments.map((row) => [row.paidBy ?? '', row])
    );

    const supervisorIds = Array.from(new Set([
        ...supervisorRequests.map((row) => row.supervisorId),
        ...supervisorCompleted.map((row) => row.supervisorId),
    ].filter(Boolean))) as number[];

    const supervisors = supervisorIds.length > 0
        ? await prisma.supervisor.findMany({
            where: { id: { in: supervisorIds } },
            select: { id: true, name: true, phone: true },
        })
        : [];

    const topSupervisors = supervisors.map((sup) => {
        const paymentRow = paymentBySupervisorNameMap.get(sup.name);
        return {
            supervisorId: sup.id,
            name: sup.name,
            phone: sup.phone,
            assignedRequests: adminAssignedMap.get(sup.id) ?? 0,
            completedRequests: adminCompletedMap.get(sup.id) ?? 0,
            approvedPaymentsCount: paymentRow?._count?._all ?? 0,
            approvedPaymentsAmount: Number(paymentRow?._sum?.totalAmount ?? 0),
        };
    }).sort((a, b) => b.completedRequests - a.completedRequests);

    const adminBotKpi = {
        assignedRequests: supervisorRequests.reduce((sum, row) => sum + row._count._all, 0),
        completedRequests: supervisorCompleted.reduce((sum, row) => sum + row._count._all, 0),
        approvedPaymentsCount: approvedPayments.reduce((sum, row) => sum + row._count._all, 0),
        approvedPaymentsAmount: approvedPayments.reduce((sum, row) => sum + Number(row._sum.totalAmount ?? 0), 0),
    };

    // ─── Sotuv Funnel (status pipeline) ──────────────────────────────────
    const funnelData = {
        draft:      ordersByStatus.find(s => s.status === OrderStatus.draft)?._count?.status ?? 0,
        new:        ordersByStatus.find(s => s.status === OrderStatus.new_)?._count?.status ?? 0,
        processing: ordersByStatus.find(s => s.status === OrderStatus.processing)?._count?.status ?? 0,
        shipping:   ordersByStatus.find(s => s.status === OrderStatus.shipping)?._count?.status ?? 0,
        delivered:  ordersByStatus.find(s => s.status === OrderStatus.delivered)?._count?.status ?? 0,
        cancelled:  ordersByStatus.find(s => s.status === OrderStatus.cancelled)?._count?.status ?? 0,
    };

    // ─── Viloyat bo'yicha savdo ──────────────────────────────────────────
    let regionSales: { region: string; orders: number; revenue: number }[] = [];
    try {
        const regionData = await prisma.$queryRaw<{
            region: string;
            orders: number;
            revenue: number;
        }[]>`
            SELECT
                CASE
                    WHEN "shippingAddress" ILIKE '%toshkent%' OR "shippingAddress" ILIKE '%ташкент%' THEN 'Toshkent'
                    WHEN "shippingAddress" ILIKE '%samarqand%' OR "shippingAddress" ILIKE '%самарканд%' THEN 'Samarqand'
                    WHEN "shippingAddress" ILIKE '%buxoro%' OR "shippingAddress" ILIKE '%бухар%' THEN 'Buxoro'
                    WHEN "shippingAddress" ILIKE '%andijon%' OR "shippingAddress" ILIKE '%андижан%' THEN 'Andijon'
                    WHEN "shippingAddress" ILIKE '%farg''ona%' OR "shippingAddress" ILIKE '%ферган%' THEN 'Farg''ona'
                    WHEN "shippingAddress" ILIKE '%namangan%' OR "shippingAddress" ILIKE '%наманган%' THEN 'Namangan'
                    WHEN "shippingAddress" ILIKE '%xorazm%' OR "shippingAddress" ILIKE '%хорезм%' OR "shippingAddress" ILIKE '%urganch%' THEN 'Xorazm'
                    WHEN "shippingAddress" ILIKE '%qashqadaryo%' OR "shippingAddress" ILIKE '%кашкадар%' OR "shippingAddress" ILIKE '%qarshi%' THEN 'Qashqadaryo'
                    WHEN "shippingAddress" ILIKE '%surxondaryo%' OR "shippingAddress" ILIKE '%сурхандар%' OR "shippingAddress" ILIKE '%termiz%' THEN 'Surxondaryo'
                    WHEN "shippingAddress" ILIKE '%jizzax%' OR "shippingAddress" ILIKE '%джизак%' THEN 'Jizzax'
                    WHEN "shippingAddress" ILIKE '%sirdaryo%' OR "shippingAddress" ILIKE '%сырдар%' THEN 'Sirdaryo'
                    WHEN "shippingAddress" ILIKE '%navoiy%' OR "shippingAddress" ILIKE '%навои%' THEN 'Navoiy'
                    WHEN "shippingAddress" ILIKE '%nukus%' OR "shippingAddress" ILIKE '%qoraqalpog%' OR "shippingAddress" ILIKE '%каракалп%' THEN 'Qoraqalpog''iston'
                    ELSE 'Boshqa'
                END as region,
                COUNT(*)::int as orders,
                COALESCE(SUM("totalAmount"), 0)::float as revenue
            FROM "Order"
            WHERE "createdAt" >= ${from}
              AND "createdAt" < ${toExclusive}
              AND status NOT IN ('draft', 'cancelled')
              AND "shippingAddress" IS NOT NULL
              AND "shippingAddress" != ''
            GROUP BY region
            ORDER BY revenue DESC
        `;
        regionSales = regionData.map(r => ({
            region: r.region,
            orders: Number(r.orders),
            revenue: Number(r.revenue),
        }));
    } catch {
        // Viloyat so'rovi xato bo'lsa — bo'sh qoladi
    }

    // ─── Eng faol soat ───────────────────────────────────────────────────
    let peakHour = 0;
    try {
        const hourData = await prisma.$queryRaw<{ hour: number; cnt: number }[]>`
            SELECT
                EXTRACT(HOUR FROM "createdAt")::int as hour,
                COUNT(*)::int as cnt
            FROM "Order"
            WHERE "createdAt" >= ${from}
              AND "createdAt" < ${toExclusive}
              AND status NOT IN ('draft')
            GROUP BY hour
            ORDER BY cnt DESC
            LIMIT 1
        `;
        peakHour = hourData?.[0]?.hour ?? 0;
    } catch { /* ignore */ }

    return {
        summary: {
            totalOrders,
            newOrders,
            totalRevenue:    totalRevenue._sum.totalAmount ?? 0,
            periodOrders:    curCount,
            periodRevenue:   curRevenue,
            completedOrders: curCompleted,
            conversionRate:  curConversion,
            // Yangi metrikalar
            aov,
            cancelRate,
            repeatRate,
            cancelledOrders: curCancelled,
            peakHour,
        },
        trends,
        topProducts: topProductsWithDetails,
        ordersByStatus,
        dailyRevenue: daily,
        funnelData,
        regionSales,
        botReports: {
            customer: customerBotKpi,
            driver: {
                totalCollections: driverTotals.collections,
                totalWeight: Math.round(driverTotals.totalWeight * 10) / 10,
                totalAmount: Math.round(driverTotals.totalAmount),
                pendingPayments: pendingDriverPayments,
            },
            admin: adminBotKpi,
            topDrivers,
            topSupervisors,
        },
        period: days,
    };
}
