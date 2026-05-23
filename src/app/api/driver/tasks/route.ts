/**
 * GET /api/driver/tasks
 * Authorization: Bearer <driver-token>
 *
 * Bearer token'dan olingan driverId asosida tayinlangan faol arizalar.
 * Yandex Pro uslubida — haydovchining acceptedMaterials bo'yicha filtrlanadi.
 *
 * Query params:
 *   ?status=completed — bajarilgan vazifalar tarixi
 *   ?status=active   — faol vazifalar (default)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';
import { aliasesForTariffs, mapLegacyMaterial } from '@/lib/tariffs';

const ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'collecting'];
const COMPLETED_STATUSES = ['done', 'completed', 'collected', 'paid'];

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const driverId = guard.driverId;

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get('status') || 'active').toLowerCase();
    const isCompleted = statusParam === 'completed' || statusParam === 'history';

    const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { acceptedMaterials: true },
    });
    const accepted = driver?.acceptedMaterials ?? [];

    const where: Record<string, unknown> = { assignedDriverId: driverId };

    if (isCompleted) {
        where.status = { in: COMPLETED_STATUSES };
    } else {
        where.status = { in: ACTIVE_STATUSES };
        if (accepted.length > 0) {
            const aliases = aliasesForTariffs(accepted);
            where.OR = [
                { material: null },
                { material: { in: aliases } },
            ];
        }
    }

    const tasks = await prisma.recycleRequest.findMany({
        where: where as never,
        orderBy: isCompleted ? { createdAt: 'desc' } : { assignedAt: 'desc' },
        take: isCompleted ? 50 : undefined,
        select: {
            id: true, name: true, phone: true, material: true, volume: true,
            volumeSize: true, address: true, pickupLat: true, pickupLng: true,
            status: true, createdAt: true, assignedAt: true, pickupType: true,
            point: { select: { regionUz: true, cityUz: true, phone: true, lat: true, lng: true, pricePerKg: true } },
            collections: { select: { actualWeight: true, totalAmount: true } },
        },
    });

    const enriched = tasks.map(t => ({
        ...t,
        tariffId: mapLegacyMaterial(t.material),
    }));

    return NextResponse.json(enriched);
}
