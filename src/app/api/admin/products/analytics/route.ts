import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/money';

// ─── GET /api/admin/products/analytics ───────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const period = parseInt(searchParams.get('period') ?? '30');
        const from = new Date();
        from.setDate(from.getDate() - period);

        // 1. Umumiy
        const [totalProducts, activeProducts, outOfStock] = await Promise.all([
            prisma.product.count(),
            prisma.product.count({ where: { status: 'active' } }),
            prisma.product.count({ where: { inStock: false } }),
        ]);

        // 2. Kategoriya bo'yicha daromad
        const categoryRevenue = await prisma.$queryRaw<{
            category: string;
            revenue: number;
            sold: number;
        }[]>`
            SELECT
                COALESCE(p.category, 'Boshqa') as category,
                COALESCE(SUM(oi.price * oi.quantity), 0)::float as revenue,
                COALESCE(SUM(oi.quantity), 0)::int as sold
            FROM "OrderItem" oi
            JOIN "Product" p ON p.id = oi."productId"
            JOIN "Order" o ON o.id = oi."orderId"
            WHERE o."createdAt" >= ${from}
              AND o.status NOT IN ('draft', 'cancelled')
            GROUP BY p.category
            ORDER BY revenue DESC
            LIMIT 10
        `;

        // 3. Eng ko'p sotilgan mahsulotlar (davr uchun)
        const topSold = await prisma.$queryRaw<{
            product_id: number;
            name: string;
            image: string | null;
            price: number;
            total_sold: number;
            revenue: number;
        }[]>`
            SELECT
                p.id as product_id,
                p.name,
                p.image,
                p.price::float,
                COALESCE(SUM(oi.quantity), 0)::int as total_sold,
                COALESCE(SUM(oi.price * oi.quantity), 0)::float as revenue
            FROM "OrderItem" oi
            JOIN "Product" p ON p.id = oi."productId"
            JOIN "Order" o ON o.id = oi."orderId"
            WHERE o."createdAt" >= ${from}
              AND o.status NOT IN ('draft', 'cancelled')
            GROUP BY p.id, p.name, p.image, p.price
            ORDER BY total_sold DESC
            LIMIT 10
        `;

        // 4. Eng kam sotilgan (lekin mavjud)
        const leastSold = await prisma.$queryRaw<{
            product_id: number;
            name: string;
            price: number;
            total_sold: number;
        }[]>`
            SELECT
                p.id as product_id,
                p.name,
                p.price::float,
                COALESCE(sub.total_sold, 0)::int as total_sold
            FROM "Product" p
            LEFT JOIN (
                SELECT oi."productId", SUM(oi.quantity) as total_sold
                FROM "OrderItem" oi
                JOIN "Order" o ON o.id = oi."orderId"
                WHERE o."createdAt" >= ${from}
                  AND o.status NOT IN ('draft', 'cancelled')
                GROUP BY oi."productId"
            ) sub ON sub."productId" = p.id
            WHERE p.status = 'active'
            ORDER BY total_sold ASC
            LIMIT 10
        `;

        // 5. Kunlik sotuvlar (mahsulot soni)
        const dailySales = await prisma.$queryRaw<{
            date: string;
            sold: number;
            revenue: number;
        }[]>`
            SELECT
                DATE(o."createdAt")::text as date,
                COALESCE(SUM(oi.quantity), 0)::int as sold,
                COALESCE(SUM(oi.price * oi.quantity), 0)::float as revenue
            FROM "OrderItem" oi
            JOIN "Order" o ON o.id = oi."orderId"
            WHERE o."createdAt" >= NOW() - INTERVAL '14 days'
              AND o.status NOT IN ('draft', 'cancelled')
            GROUP BY DATE(o."createdAt")
            ORDER BY date ASC
        `;

        // 6. Narx segmentlari
        const priceSegments = await prisma.$queryRaw<{
            segment: string;
            count: number;
        }[]>`
            SELECT
                CASE
                    WHEN price < 50000 THEN 'Arzon (< 50K)'
                    WHEN price >= 50000 AND price < 200000 THEN 'O''rtacha (50K-200K)'
                    WHEN price >= 200000 AND price < 1000000 THEN 'Qimmat (200K-1M)'
                    ELSE 'Premium (1M+)'
                END as segment,
                COUNT(*)::int as count
            FROM "Product"
            WHERE status = 'active'
            GROUP BY segment
            ORDER BY MIN(price)
        `;

        return NextResponse.json({
            summary: {
                totalProducts,
                activeProducts,
                outOfStock,
                avgPrice: 0, // Will compute if needed
            },
            categoryRevenue: categoryRevenue.map(c => ({
                category: c.category,
                revenue: toNumber(c.revenue),
                sold: Number(c.sold),
            })),
            topSold: topSold.map(p => ({
                id: p.product_id,
                name: p.name,
                image: p.image,
                price: toNumber(p.price),
                totalSold: Number(p.total_sold),
                revenue: toNumber(p.revenue),
            })),
            leastSold: leastSold.map(p => ({
                id: p.product_id,
                name: p.name,
                price: toNumber(p.price),
                totalSold: Number(p.total_sold),
            })),
            dailySales: dailySales.map(d => ({
                date: d.date?.slice(5) ?? '',
                sold: Number(d.sold),
                revenue: toNumber(d.revenue),
            })),
            priceSegments: priceSegments.map(s => ({
                segment: s.segment,
                count: Number(s.count),
            })),
        });
    } catch (error) {
        console.error('[API/admin/products/analytics]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
