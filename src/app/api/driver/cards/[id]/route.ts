/**
 * DELETE /api/driver/cards/[id]
 * PUT /api/driver/cards/[id] — default qilish
 *
 * Authorization: Bearer <driver-token>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const auth = { driverId: guard.driverId };

    const { id } = await params;
    const cardId = Number(id);

    // Avval barcha kartalardan default'ni olib tashlash
    await prisma.driverCard.updateMany({
        where: { driverId: auth.driverId },
        data: { isDefault: false },
    });

    // Tanlangan kartani default qilish
    const card = await prisma.driverCard.update({
        where: { id: cardId, driverId: auth.driverId },
        data: { isDefault: true },
    });

    return NextResponse.json(card);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const auth = { driverId: guard.driverId };

    const { id } = await params;
    await prisma.driverCard.update({
        where: { id: Number(id), driverId: auth.driverId },
        data: { isActive: false },
    });

    return NextResponse.json({ success: true });
}
