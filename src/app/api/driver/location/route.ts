/**
 * POST /api/driver/location
 * Authorization: Bearer <driver-token>
 *
 * Haydovchi GPS joylashuvini yangilash (30-60s interval)
 * SSE orqali admin xaritaga real-time broadcast qiladi
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/platform/eventBus';
import { requireDriver, requireAdmin, AuthError } from '@/lib/auth/guards';
import type { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
    try {
        const guard = await requireDriver(req);
        if (!guard.ok) return guard.response;

        const { lat, lng } = await req.json();
        if (lat == null || lng == null) {
            return NextResponse.json({ error: 'lat, lng talab qilinadi' }, { status: 400 });
        }

        const driver = await prisma.driver.update({
            where: { id: guard.driverId },
            data: {
                lastLat: Number(lat),
                lastLng: Number(lng),
                lastSeenAt: new Date(),
            },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                pointId: true,
                point: { select: { regionUz: true, color: true } },
            },
        });

        // ── SSE broadcast — admin logistika xaritasiga real-time ──
        eventBus.publish({
            type: 'driver.gps_update',
            title: 'GPS yangilandi',
            message: `${driver.name} joylashuvi yangilandi`,
            severity: 'info',
            driverId: driver.id,
            pointId: driver.pointId ?? undefined,
            timestamp: new Date().toISOString(),
            source: 'driver',
        });

        return NextResponse.json({ ok: true, lat, lng, ts: new Date().toISOString() });
    } catch (error: unknown) {
        console.error('[driver/location]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

/** GET /api/driver/location?supervisorId=X — admin-only, barcha haydovchilar joylashuvi */
export async function GET(req: NextRequest) {
    try {
        await requireAdmin(req);

        const supervisorId = req.nextUrl.searchParams.get('supervisorId');
        const pointId = req.nextUrl.searchParams.get('pointId');

        const where: Prisma.DriverWhereInput = { isOnline: true };
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
    } catch (error) {
        if (error instanceof AuthError) {
            return error.toResponse();
        }
        console.error('[GET driver/location]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
