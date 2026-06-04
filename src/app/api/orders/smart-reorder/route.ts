import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { toNumber } from '@/lib/money';

// ─── GET /api/orders/smart-reorder — Aqlli qayta buyurtma tavsiyalari ────────
export async function GET(req: NextRequest) {
    try {
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

        // Oxirgi 6 oydagi yetkazib berilgan buyurtmalar
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const deliveredOrders = await prisma.order.findMany({
            where: {
                OR: [
                    { userId: sessionUserId },
                    ...(session?.user?.phone ? [{ contactPhone: session.user.phone }] : []),
                ],
                status: 'delivered',
                createdAt: { gte: sixMonthsAgo },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, image: true, price: true },
                        },
                    },
                },
            },
        });

        if (deliveredOrders.length === 0) {
            return NextResponse.json({
                lastOrderDate: null,
                averageIntervalDays: 0,
                suggestedReorderDate: null,
                isReorderDue: false,
                frequentProducts: [],
                totalOrderCount: 0,
                totalSpent: 0,
            });
        }

        // ── Buyurtmalar orasidagi o'rtacha interval ──
        const orderDates = deliveredOrders
            .map(o => new Date(o.createdAt).getTime())
            .sort((a, b) => a - b);

        let averageIntervalDays = 0;
        if (orderDates.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < orderDates.length; i++) {
                const diffMs = orderDates[i] - orderDates[i - 1];
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                intervals.push(diffDays);
            }
            averageIntervalDays = Math.round(
                intervals.reduce((sum, d) => sum + d, 0) / intervals.length
            );
        }

        // ── Oxirgi buyurtma va tavsiya etilgan sana ──
        const lastOrderDate = new Date(deliveredOrders[0].createdAt);
        const suggestedReorderDate = new Date(lastOrderDate);
        suggestedReorderDate.setDate(
            suggestedReorderDate.getDate() + (averageIntervalDays || 30)
        );

        const now = new Date();
        const daysSinceLastOrder = Math.round(
            (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const isReorderDue = now >= suggestedReorderDate;

        // ── Eng ko'p buyurtma qilingan mahsulotlar ──
        const productStats = new Map<
            number,
            {
                productId: number;
                name: string;
                image: string;
                totalQuantity: number;
                totalSpend: number;
                orderCount: number;
                lastPrice: number;
                quantities: number[];
            }
        >();

        for (const order of deliveredOrders) {
            for (const item of order.items) {
                if (!item.product) continue;
                const pid = item.product.id;
                const price = toNumber(item.price);
                const existing = productStats.get(pid);

                if (existing) {
                    existing.totalQuantity += item.quantity;
                    existing.totalSpend += price * item.quantity;
                    existing.orderCount += 1;
                    existing.lastPrice = price;
                    existing.quantities.push(item.quantity);
                } else {
                    productStats.set(pid, {
                        productId: pid,
                        name: item.product.name,
                        image: item.product.image,
                        totalQuantity: item.quantity,
                        totalSpend: price * item.quantity,
                        orderCount: 1,
                        lastPrice: price,
                        quantities: [item.quantity],
                    });
                }
            }
        }

        // Eng ko'p buyurtma qilinganlarni saralash
        const sortedProducts = Array.from(productStats.values())
            .sort((a, b) => b.orderCount - a.orderCount || b.totalQuantity - a.totalQuantity)
            .slice(0, 10);

        const frequentProducts = sortedProducts.map(p => {
            const avgQty = Math.round(p.totalQuantity / p.orderCount);

            // Talab o'sishini hisoblash (oxirgi 2 buyurtma asosida)
            let suggestedQuantity = avgQty;
            let suggestion = '';

            if (p.quantities.length >= 2) {
                const recentQty = p.quantities[p.quantities.length - 1];
                const prevQty = p.quantities[p.quantities.length - 2];
                const growthPercent = Math.round(
                    ((recentQty - prevQty) / prevQty) * 100
                );

                if (growthPercent > 10) {
                    suggestedQuantity = Math.round(avgQty * (1 + growthPercent / 100));
                    suggestion = `Talab ${growthPercent}% o'sgan, ${suggestedQuantity} dona tavsiya qilamiz`;
                } else if (growthPercent < -10) {
                    suggestedQuantity = Math.max(1, Math.round(avgQty * 0.9));
                    suggestion = `Talab kamaygan, ${suggestedQuantity} dona tavsiya qilamiz`;
                } else {
                    suggestion = `O'rtacha ${avgQty} dona buyurtma qilasiz`;
                }
            } else {
                suggestion = `O'rtacha ${avgQty} dona buyurtma qilasiz`;
            }

            // Qayta buyurtma vaqti kelganini eslatish
            if (isReorderDue && !suggestion.includes('vaqti')) {
                suggestion += '. Qayta buyurtma vaqti keldi!';
            }

            return {
                productId: p.productId,
                name: p.name,
                image: p.image,
                averageQuantity: avgQty,
                suggestedQuantity,
                lastPrice: p.lastPrice,
                totalOrdered: p.orderCount,
                suggestion,
            };
        });

        // ── Jami statistika ──
        const totalSpent = deliveredOrders.reduce(
            (sum, o) => sum + toNumber(o.totalAmount),
            0
        );

        return NextResponse.json({
            lastOrderDate: lastOrderDate.toISOString().split('T')[0],
            averageIntervalDays,
            suggestedReorderDate: suggestedReorderDate.toISOString().split('T')[0],
            isReorderDue,
            frequentProducts,
            totalOrderCount: deliveredOrders.length,
            totalSpent,
        });
    } catch (error) {
        console.error('GET /api/orders/smart-reorder error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
