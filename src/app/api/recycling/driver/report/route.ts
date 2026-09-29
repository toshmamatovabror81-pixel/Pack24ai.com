/**
 * GET /api/recycling/driver/report
 * 
 * Haydovchi kunlik/haftalik hisoboti.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const [today, week, total] = await Promise.all([
            prisma.recycleCollection.aggregate({
                where: { driverId: auth.driverId, collectedAt: { gte: todayStart } },
                _count: true,
                _sum: { actualWeight: true, totalAmount: true },
            }),
            prisma.recycleCollection.aggregate({
                where: { driverId: auth.driverId, collectedAt: { gte: weekStart } },
                _count: true,
                _sum: { actualWeight: true, totalAmount: true },
            }),
            prisma.recycleCollection.aggregate({
                where: { driverId: auth.driverId },
                _count: true,
                _sum: { actualWeight: true, totalAmount: true },
            }),
        ]);

        // Haftalik kunlik statistika
        const dailyStats = await prisma.recycleCollection.groupBy({
            by: ['collectedAt'],
            where: { driverId: auth.driverId, collectedAt: { gte: weekStart } },
            _sum: { actualWeight: true },
            _count: true,
        });

        return NextResponse.json({
            success: true,
            today: {
                count: today._count,
                weight: today._sum.actualWeight || 0,
                revenue: today._sum.totalAmount || 0,
            },
            week: {
                count: week._count,
                weight: week._sum.actualWeight || 0,
                revenue: week._sum.totalAmount || 0,
            },
            total: {
                count: total._count,
                weight: total._sum.actualWeight || 0,
                revenue: total._sum.totalAmount || 0,
            },
            dailyStats,
        });
    } catch (error) {
        console.error('[Driver Report]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
