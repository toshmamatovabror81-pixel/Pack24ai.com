/**
 * POST /api/driver/online
 * Haydovchi online/offline holatini yangilash
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const { driverId, isOnline } = await req.json();
    if (!driverId) return NextResponse.json({ error: 'driverId talab qilinadi' }, { status: 400 });

    await prisma.driver.update({
        where: { id: driverId },
        data: {
            isOnline,
            lastSeenAt: new Date(),
            status: isOnline ? 'active' : 'inactive',
        },
    });

    return NextResponse.json({ ok: true, isOnline });
}
