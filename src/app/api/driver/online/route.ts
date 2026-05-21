/**
 * POST /api/driver/online
 * Authorization: Bearer <driver-token>
 *
 * Haydovchi online/offline holatini yangilash
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    const { isOnline } = await req.json();
    if (typeof isOnline !== 'boolean') {
        return NextResponse.json({ error: 'isOnline boolean bo\'lishi kerak' }, { status: 400 });
    }

    await prisma.driver.update({
        where: { id: guard.driverId },
        data: {
            isOnline,
            lastSeenAt: new Date(),
            status: isOnline ? 'active' : 'inactive',
        },
    });

    return NextResponse.json({ ok: true, isOnline });
}
