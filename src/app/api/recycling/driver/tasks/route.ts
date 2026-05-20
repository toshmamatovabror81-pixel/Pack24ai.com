/**
 * GET /api/recycling/driver/tasks
 * 
 * Haydovchiga tayinlangan faol arizalarni qaytaradi.
 * Authorization: Bearer <token>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecycleRequestStatus } from '@prisma/client';
import crypto from 'crypto';

const TOKEN_SECRET = process.env.ADMIN_SECRET || 'pack24-driver-secret';

function verifyDriverToken(authHeader: string | null): { driverId: number } | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const [payloadB64, hmac] = token.split('.');
    if (!payloadB64 || !hmac) return null;

    try {
        const payload = Buffer.from(payloadB64, 'base64').toString();
        const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
        if (hmac !== expected) return null;
        const data = JSON.parse(payload);
        return { driverId: data.driverId };
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const auth = verifyDriverToken(req.headers.get('authorization'));
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
