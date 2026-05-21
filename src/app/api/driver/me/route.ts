/**
 * GET /api/driver/me
 * Authorization: Bearer <driver-token>
 *
 * Token egasiga tegishli haydovchi ma'lumotlarini qaytaradi.
 * Legacy: `?telegramId=XXX` query — admin debug yoki bot uchun, faqat token
 * bo'lmaganda foydalaniladi va ADMIN_SECRET header bilan keladi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    const driver = await prisma.driver.findUnique({
        where: { id: guard.driverId },
        select: {
            id: true, name: true, phone: true, telegramId: true, telegramName: true,
            vehicleInfo: true, status: true, isOnline: true,
            supervisor: { select: { name: true, phone: true } },
            point: { select: { regionUz: true, cityUz: true } },
        },
    });

    if (!driver) return NextResponse.json({ error: 'Haydovchi topilmadi' }, { status: 404 });
    return NextResponse.json(driver);
}
