/**
 * GET /api/driver/me?telegramId=XXX
 * Haydovchi ma'lumotlarini telegramId orqali olish
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const telegramId = req.nextUrl.searchParams.get('telegramId');
    if (!telegramId) return NextResponse.json({ error: 'telegramId talab qilinadi' }, { status: 400 });

    const driver = await prisma.driver.findFirst({
        where: { telegramId },
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
