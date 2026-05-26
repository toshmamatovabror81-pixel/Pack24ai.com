import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
        const limit  = Math.min(50, parseInt(searchParams.get('limit') || '20'));
        const status = searchParams.get('status'); // 'pending' | 'completed' | 'failed' | null (all)
        const skip   = (page - 1) * limit;

        const where = {
            type: 'withdrawal' as const,
            ...(status ? { status } : {}),
        };

        const [payouts, total] = await Promise.all([
            prisma.driverTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    driver: { select: { id: true, name: true, phone: true } },
                    card:   { select: { cardType: true, cardNumber: true } },
                }
            }),
            prisma.driverTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: payouts,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
