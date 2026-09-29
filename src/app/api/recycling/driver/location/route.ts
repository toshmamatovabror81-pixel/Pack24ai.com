/**
 * POST /api/recycling/driver/location
 * 
 * Haydovchi GPS joylashuvini yangilaydi.
 * Mobil ilova background'dan har 30 sekundda yuboradi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDriverToken as verifySharedDriverToken } from '@/lib/auth/verifyDriverToken';

// Haydovchi tokeni umumiy verifyDriverToken orqali tekshiriladi (DRIVER_TOKEN_SECRET).
// Kalit o'rnatilmagan bo'lsa so'rov rad etiladi.
async function verifyDriverToken(authHeader: string | null): Promise<{ driverId: number } | null> {
    try {
        const result = await verifySharedDriverToken(authHeader);
        return result.ok ? { driverId: result.driverId } : null;
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyDriverToken(req.headers.get('authorization'));
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { latitude, longitude } = await req.json();

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return NextResponse.json({ error: 'latitude/longitude kerak' }, { status: 400 });
        }

        await prisma.driver.update({
            where: { id: auth.driverId },
            data: {
                lastLat: latitude,
                lastLng: longitude,
                lastSeenAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Driver Location]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
