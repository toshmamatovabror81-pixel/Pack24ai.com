/**
 * GET /api/driver/tasks?driverId=X
 * Haydovchiga tayinlangan faol arizalar
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const driverId = parseInt(req.nextUrl.searchParams.get('driverId') || '0');
    if (!driverId) return NextResponse.json({ error: 'driverId talab qilinadi' }, { status: 400 });

    const tasks = await prisma.recycleRequest.findMany({
        where: {
            assignedDriverId: driverId,
            status: { in: ['assigned', 'en_route', 'arrived', 'collecting'] as any },
        },
        orderBy: { assignedAt: 'desc' },
        select: {
            id: true, name: true, phone: true, material: true, volume: true,
            volumeSize: true, address: true, pickupLat: true, pickupLng: true,
            status: true, createdAt: true, assignedAt: true, pickupType: true,
            point: { select: { regionUz: true, cityUz: true, phone: true, lat: true, lng: true } },
            collections: { select: { actualWeight: true, totalAmount: true } },
        },
    });

    return NextResponse.json(tasks);
}
