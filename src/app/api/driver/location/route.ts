/**
 * POST /api/driver/location
 * Haydovchi GPS joylashuvini yangilash (30s interval)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { driverId, lat, lng } = await req.json();
        if (!driverId || lat == null || lng == null) {
            return NextResponse.json({ error: 'driverId, lat, lng talab qilinadi' }, { status: 400 });
        }

        await prisma.driver.update({
            where: { id: Number(driverId) },
            data: {
                lastLat: Number(lat),
                lastLng: Number(lng),
                lastSeenAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true, lat, lng, ts: new Date().toISOString() });
    } catch (error: any) {
        console.error('[driver/location]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

/** GET /api/driver/location?supervisorId=X — Supervisor uchun barcha haydovchilar joylashuvi */
export async function GET(req: NextRequest) {
    const supervisorId = req.nextUrl.searchParams.get('supervisorId');
    const pointId = req.nextUrl.searchParams.get('pointId');

    const where: any = { isOnline: true };
    if (supervisorId) where.supervisorId = Number(supervisorId);
    if (pointId) where.pointId = Number(pointId);

    const drivers = await prisma.driver.findMany({
        where,
        select: {
            id: true, name: true, vehicleInfo: true,
            lastLat: true, lastLng: true, lastSeenAt: true, isOnline: true,
        },
    });

    return NextResponse.json(drivers);
}
