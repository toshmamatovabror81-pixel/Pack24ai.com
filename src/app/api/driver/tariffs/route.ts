/**
 * PATCH /api/driver/tariffs
 * Authorization: Bearer <driver-token>
 * Body: { acceptedMaterials: string[] }
 *
 * Haydovchi qabul qiladigan tariflar (Yandex Pro uslubida)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';
import { sanitizeTariffIds, TARIFF_IDS } from '@/lib/tariffs';

export async function PATCH(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Noto\'g\'ri JSON' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('acceptedMaterials' in body)) {
        return NextResponse.json(
            { error: 'acceptedMaterials maydoni majburiy' },
            { status: 400 }
        );
    }

    const raw = (body as { acceptedMaterials: unknown }).acceptedMaterials;
    const cleaned = sanitizeTariffIds(raw);

    try {
        const driver = await prisma.driver.update({
            where: { id: guard.driverId },
            data: { acceptedMaterials: cleaned },
            select: {
                id: true,
                acceptedMaterials: true,
            },
        });

        return NextResponse.json({
            ok: true,
            driver,
            validTariffs: TARIFF_IDS,
        });
    } catch (e) {
        console.error('[driver/tariffs] PATCH error:', e);
        return NextResponse.json(
            { error: 'Tariflar saqlanmadi' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    const driver = await prisma.driver.findUnique({
        where: { id: guard.driverId },
        select: { acceptedMaterials: true },
    });

    return NextResponse.json({
        acceptedMaterials: driver?.acceptedMaterials ?? [],
        validTariffs: TARIFF_IDS,
    });
}
