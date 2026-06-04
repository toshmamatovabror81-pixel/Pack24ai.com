import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ─── GET /api/corporate/dashboard — Korporativ dashboard ma'lumotlari ────────
export async function GET(req: NextRequest) {
    try {
        // ── Auth: Session yoki Mobile token ──────────────────────────────
        const session = await getServerSession(authOptions);
        let sessionUserId = Number(session?.user?.id);

        // Mobile token fallback
        if (!Number.isFinite(sessionUserId)) {
            try {
                const { verifyMobileToken } = await import('@/lib/auth/verifyMobileToken');
                const authHeader = req.headers.get('authorization');
                const result = await verifyMobileToken(authHeader);
                if (result.ok) {
                    sessionUserId = result.userId;
                }
            } catch { /* noop */ }
        }

        if (!Number.isFinite(sessionUserId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Foydalanuvchini olish va corporate tekshirish ────────────────
        const user = await prisma.user.findUnique({
            where: { id: sessionUserId },
            select: {
                id: true,
                name: true,
                companyName: true,
                customerType: true,
                totalRecycledWeight: true,
                totalCO2Saved: true,
                treesEquivalent: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.customerType !== 'corporate') {
            return NextResponse.json({ error: 'Corporate access only' }, { status: 403 });
        }

        // ── Buyurtmalar statistikasi ─────────────────────────────────────
        const orderStats = await prisma.order.aggregate({
            where: { userId: sessionUserId, status: { not: 'draft' } },
            _count: { id: true },
            _sum: { totalAmount: true },
        });

        const totalOrders = orderStats._count.id;
        const totalAmount = Number(orderStats._sum.totalAmount ?? 0);
        const avgOrderValue = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;

        // ── Oylik buyurtmalar (oxirgi 12 oy) ────────────────────────────
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        const monthlyOrders = await prisma.order.findMany({
            where: {
                userId: sessionUserId,
                status: { not: 'draft' },
                createdAt: { gte: twelveMonthsAgo },
            },
            select: {
                createdAt: true,
                totalAmount: true,
            },
        });

        // Oylik guruhlash
        const monthlyMap = new Map<string, { count: number; amount: number }>();
        for (let i = 0; i < 12; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap.set(key, { count: 0, amount: 0 });
        }
        for (const order of monthlyOrders) {
            const d = new Date(order.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const entry = monthlyMap.get(key);
            if (entry) {
                entry.count += 1;
                entry.amount += Number(order.totalAmount ?? 0);
            }
        }
        const ordersByMonth = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .reverse();

        // ── Top mahsulotlar ─────────────────────────────────────────────
        const topProductsRaw = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                order: {
                    userId: sessionUserId,
                    status: { not: 'draft' },
                },
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10,
        });

        const productIds = topProductsRaw.map((p) => p.productId);
        const productsMap = productIds.length > 0
            ? new Map(
                  (
                      await prisma.product.findMany({
                          where: { id: { in: productIds } },
                          select: { id: true, name: true },
                      })
                  ).map((p) => [p.id, p.name])
              )
            : new Map<number, string>();

        const topProducts = topProductsRaw.map((p) => ({
            productId: p.productId,
            name: productsMap.get(p.productId) ?? `Mahsulot #${p.productId}`,
            quantity: p._sum.quantity ?? 0,
        }));

        // ── Aktiv shartnomalar ──────────────────────────────────────────
        const contracts = await prisma.contract.findMany({
            where: { userId: sessionUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                contractNo: true,
                companyName: true,
                status: true,
                paymentTermDays: true,
                creditLimit: true,
                startDate: true,
                endDate: true,
            },
        });

        // ── To'lanmagan fakturalar ──────────────────────────────────────
        const contractIds = contracts.map((c) => c.id);
        const pendingInvoices = contractIds.length > 0
            ? await prisma.corporateInvoice.findMany({
                  where: {
                      contractId: { in: contractIds },
                      status: { not: 'paid' },
                  },
                  orderBy: { dueDate: 'asc' },
                  select: {
                      id: true,
                      invoiceNo: true,
                      subtotal: true,
                      vatAmount: true,
                      totalAmount: true,
                      status: true,
                      dueDate: true,
                      paidAmount: true,
                      createdAt: true,
                  },
              })
            : [];

        // ── Eko statistika ──────────────────────────────────────────────
        const ecoStats = {
            totalRecycledWeight: user.totalRecycledWeight ?? 0,
            co2Saved: user.totalCO2Saved ?? 0,
            treesEquivalent: user.treesEquivalent ?? 0,
        };

        // ── Yetkazish statistikasi ──────────────────────────────────────
        const deliveredOrders = await prisma.order.findMany({
            where: {
                userId: sessionUserId,
                status: 'delivered',
                deliveredAt: { not: null },
            },
            select: {
                createdAt: true,
                shippedAt: true,
                deliveredAt: true,
            },
        });

        let onTimeCount = 0;
        let totalDeliveryDays = 0;
        for (const order of deliveredOrders) {
            if (order.deliveredAt && order.createdAt) {
                const days = Math.ceil(
                    (new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24)
                );
                totalDeliveryDays += days;
                // 3 kundan kam = o'z vaqtida
                if (days <= 3) onTimeCount++;
            }
        }

        const deliveryStats = {
            totalDelivered: deliveredOrders.length,
            onTimePercent:
                deliveredOrders.length > 0
                    ? Math.round((onTimeCount / deliveredOrders.length) * 100)
                    : 100,
            avgDeliveryDays:
                deliveredOrders.length > 0
                    ? Math.round((totalDeliveryDays / deliveredOrders.length) * 10) / 10
                    : 0,
        };

        // ── Serialization helper (Decimal → number) ─────────────────────
        const serializeContracts = contracts.map((c) => ({
            ...c,
            creditLimit: Number(c.creditLimit),
        }));

        const serializeInvoices = pendingInvoices.map((inv) => ({
            ...inv,
            subtotal: Number(inv.subtotal),
            vatAmount: Number(inv.vatAmount),
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.paidAmount),
        }));

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                companyName: user.companyName,
            },
            orders: {
                total: totalOrders,
                totalAmount,
                avgOrderValue,
            },
            ordersByMonth,
            topProducts,
            contracts: serializeContracts,
            pendingInvoices: serializeInvoices,
            ecoStats,
            deliveryStats,
        });
    } catch (error) {
        console.error('GET /api/corporate/dashboard error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
