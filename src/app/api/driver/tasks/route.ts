/**
 * GET /api/driver/tasks
 * Authorization: Bearer <driver-token>
 *
 * Bearer token'dan olingan driverId asosida tayinlangan faol arizalar
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const driverId = guard.driverId;

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
            point: { select: { regionUz: true, cityUz: true, phone: true, lat: true, lng: true, pricePerKg: true } },
            collections: { select: { actualWeight: true, totalAmount: true } },
        },
    });

    return NextResponse.json(tasks);
}
