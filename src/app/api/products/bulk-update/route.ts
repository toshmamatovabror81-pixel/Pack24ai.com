import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { roundUZS, toNumber } from '@/lib/money';

// POST /api/products/bulk-update
// Body: { category: string, percentage: number }
// category = 'all' yoki kategoriya nomi
// percentage = foiz o'zgarish (+10, -5 va h.k.)
export async function POST(req: NextRequest) {
    const authError = await verifyAdminAuth(req);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { category, percentage } = body;

        if (typeof percentage !== 'number' || isNaN(percentage)) {
            return NextResponse.json({ error: 'percentage (number) majburiy' }, { status: 400 });
        }

        const where = category && category !== 'all'
            ? { category: category as string }
            : {};

        // Bitta query bilan barcha mahsulotlarni olamiz
        const products = await prisma.product.findMany({
            where,
            select: { id: true, price: true },
        });

        if (products.length === 0) {
            return NextResponse.json({ updated: 0 });
        }

        // Bitta transaction bilan hammasini yangilaymiz (N+1 muammosiz)
        const updates = await prisma.$transaction(
            products.map((p) =>
                prisma.product.update({
                    where: { id: p.id },
                    data: {
                        price: roundUZS(toNumber(p.price) * (1 + percentage / 100)),
                    },
                })
            )
        );

        return NextResponse.json({
            success: true,
            updated: updates.length,
            category: category || 'all',
            percentage,
        });
    } catch (error) {
        console.error('[POST /api/products/bulk-update]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
