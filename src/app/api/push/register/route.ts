/**
 * POST /api/push/register
 *
 * Expo Push Token ro'yxatdan o'tkazish.
 * Mobil ilova ishga tushganda tokenni yuboradi.
 *
 * Auth:
 *   - Customer:   `Authorization: Bearer <mobile-token>`  → userId guard'dan keladi.
 *   - Driver:     `Authorization: Bearer <driver-token>` → driverId guard'dan.
 *   - Anonim:     auth header yo'q bo'lsa ham qabul qilamiz, ammo userId/driverId
 *                 mos kelmaydi va keyinchalik bog'lab bo'lmaydi.
 */
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDriverToken } from '@/lib/auth/verifyDriverToken';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';

export async function POST(request: NextRequest) {
    try {
        const { pushToken, platform, appType } = await request.json();

        if (!pushToken) {
            return NextResponse.json({ error: 'pushToken kerak' }, { status: 400 });
        }

        const authHeader = request.headers.get('authorization');
        let resolvedUserId: number | null = null;
        let resolvedDriverId: number | null = null;

        if (authHeader) {
            if (appType === 'driver') {
                const v = await verifyDriverToken(authHeader);
                if (v.ok) resolvedDriverId = v.driverId;
            } else {
                const v = await verifyMobileToken(authHeader);
                if (v.ok) resolvedUserId = v.userId;
            }
        }

        await prisma.pushSubscription.upsert({
            where: { token: pushToken },
            create: {
                token: pushToken,
                userId: resolvedUserId,
                driverId: resolvedDriverId,
                platform: platform || 'unknown',
                appType: appType || 'customer',
                isActive: true,
            },
            update: {
                ...(resolvedUserId ? { userId: resolvedUserId } : {}),
                ...(resolvedDriverId ? { driverId: resolvedDriverId } : {}),
                platform: platform || undefined,
                isActive: true,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Push Register]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
