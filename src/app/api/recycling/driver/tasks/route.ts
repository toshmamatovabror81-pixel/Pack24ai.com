/**
 * GET /api/recycling/driver/tasks
 * 
 * Haydovchiga tayinlangan faol arizalarni qaytaradi.
 * Authorization: Bearer <token>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecycleRequestStatus } from '@prisma/client';
import { verifyDriverToken as verifySharedDriverToken } from '@/lib/auth/verifyDriverToken';

// Haydovchi tokeni umumiy verifyDriverToken orqali tekshiriladi (DRIVER_TOKEN_SECRET).
// Kalit o'rnatilmagan bo'lsa so'rov rad etiladi.
async function verifyDriverToken(authHeader: string | null): Promise<{ driverId: number } | null> {
    try {
        const result = await verifySharedDriverToken(authHeader);
        return result.ok ? { driverId: result.driverId } : null;
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const auth = await verifyDriverToken(req.headers.get('authorization'));
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const tasks = await prisma.recycleRequest.findMany({
            where: {
                assignedDriverId: auth.driverId,
                status: { in: [RecycleRequestStatus.assigned, RecycleRequestStatus.en_route, RecycleRequestStatus.arrived, RecycleRequestStatus.collecting] },
            },
            include: {
                point: { select: { id: true, regionUz: true, pricePerKg: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Bugungi statistika
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayStats = await prisma.recycleCollection.aggregate({
            where: {
                driverId: auth.driverId,
                collectedAt: { gte: todayStart },
            },
            _count: true,
            _sum: { actualWeight: true, totalAmount: true },
        });

        return NextResponse.json({
            success: true,
            tasks,
            todayStats: {
                count: todayStats._count,
                weight: todayStats._sum.actualWeight || 0,
                revenue: todayStats._sum.totalAmount || 0,
            },
        });
    } catch (error) {
        console.error('[Driver Tasks]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
