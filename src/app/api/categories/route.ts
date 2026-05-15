import { NextResponse } from 'next/server';
import { initialCategories } from '@/lib/store/initialCategories';
import { prisma } from '@/lib/prisma';

// ── GET /api/categories ──────────────────────────────────────────────────
// Mobil ilova va frontend uchun kategoriyalar ro'yxatini qaytaradi
// Mahsulot sonini bazadan dinamik hisoblab qaytaradi
export async function GET() {
    try {
        // Bazadan barcha kategoriya slug'lari bo'yicha mahsulot sonini olish
        const productCounts = await prisma.product.groupBy({
            by: ['category'],
            _count: { id: true },
            where: { status: 'active' },
        });

        // Slug → count xarita
        const countMap: Record<string, number> = {};
        for (const row of productCounts) {
            if (row.category) {
                countMap[row.category] = row._count.id;
            }
        }

        const categories = initialCategories
            .filter(c => c.isActive)
            .map(cat => {
                // Parent kategoriya uchun umumiy son (o'zi + bolalari)
                const directCount = countMap[cat.slug] || 0;
                const childSlugs = cat.children?.map(ch => ch.slug) || [];
                const childrenTotal = childSlugs.reduce((sum, s) => sum + (countMap[s] || 0), 0);
                const totalCount = directCount + childrenTotal;

                return {
                    id: cat.id,
                    slug: cat.slug,
                    name: cat.name,
                    icon: cat.icon,
                    productCount: totalCount,
                    children: cat.children?.filter(ch => ch.isActive).map(ch => ({
                        id: ch.id,
                        slug: ch.slug,
                        name: ch.name,
                        icon: ch.icon,
                        productCount: countMap[ch.slug] || 0,
                    })) || [],
                };
            });

        return NextResponse.json(categories, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('[GET /api/categories] Error:', error);
        return NextResponse.json({ error: 'Kategoriyalarni olishda xato' }, { status: 500 });
    }
}
