import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateUniqueTelegramRegistrationCode } from '@/lib/telegram/registrationCodes';

async function generateSupervisorCode(): Promise<string> {
    return generateUniqueTelegramRegistrationCode();
}

// POST /api/admin/recycling/drivers/[id]/promote
// Haydovchini masul hodim (Supervisor) sifatida ro'yxatga olish
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const driverId = Number(id);

    if (isNaN(driverId)) {
        return NextResponse.json({ error: 'Noto\'g\'ri ID' }, { status: 400 });
    }

    try {
        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
            include: { point: true },
        });

        if (!driver) {
            return NextResponse.json({ error: 'Haydovchi topilmadi' }, { status: 404 });
        }

        // Telefon raqam allaqachon Supervisor jadvalida bormi?
        const existing = await prisma.supervisor.findUnique({
            where: { phone: driver.phone },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Bu haydovchi allaqachon masul hodim sifatida ro\'yxatda' },
                { status: 409 },
            );
        }

        // TelegramId ham tekshiramiz (agar ulangan bo'lsa)
        if (driver.telegramId) {
            const existingByTg = await prisma.supervisor.findUnique({
                where: { telegramId: driver.telegramId },
            });
            if (existingByTg) {
                return NextResponse.json(
                    { error: 'Bu Telegram ID allaqachon boshqa masulga biriktirilgan' },
                    { status: 409 },
                );
            }
        }

        const registrationCode = await generateSupervisorCode();

        const supervisor = await prisma.supervisor.create({
            data: {
                name: driver.name,
                phone: driver.phone,
                telegramId: driver.telegramId || null,
                telegramName: driver.telegramName || null,
                pointId: driver.pointId || null,
                isActive: true,
                registrationCode,
            },
            include: { point: true },
        });

        return NextResponse.json(
            {
                ok: true,
                message: `${driver.name} masul hodim sifatida ro'yxatga olindi`,
                supervisor,
            },
            { status: 201 },
        );
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            'code' in error &&
            (error as { code: string }).code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Bu telefon raqam allaqachon masullar ro\'yxatida' },
                { status: 409 },
            );
        }
        console.error('[Driver Promote POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
