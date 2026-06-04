import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProductStatus } from '@prisma/client';
import { serializeMoney } from '@/lib/money';

/**
 * GET /api/search?q=...
 * Lightweight product search for voice order & quick-search.
 * No auth required. Returns top 10 active products.
 */
export async function GET(request: NextRequest) {
    try {
        const q = request.nextUrl.searchParams.get('q')?.trim();

        if (!q || q.length < 2) {
            return NextResponse.json([]);
        }

        const products = await prisma.product.findMany({
            where: {
                status: ProductStatus.active,
                name: { contains: q, mode: 'insensitive' },
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                price: true,
                image: true,
                category: true,
                inStock: true,
            },
        });

        const serialized = products.map((p) => serializeMoney(p));

        return NextResponse.json(serialized, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
