import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createBotEvent } from '@/lib/telegram/botEvents';
import { normalizeStaffPhone } from '@/lib/telegram/botAccessRequests';

// 5-raqamli unikal kod generatsiya
async function generateSupervisorCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
        const code = String(Math.floor(10000 + Math.random() * 90000)); // 10000-99999
        // Haydovchi va masul kodlari bir-biriga to'g'ri kelmasligini tekshirish
        const existsSup = await prisma.supervisor.findUnique({ where: { registrationCode: code } });
        const existsDrv = await prisma.driver.findUnique({ where: { registrationCode: code } });
        if (!existsSup && !existsDrv) return code;
    }
    throw new Error('Kod generatsiya qilib bo\'lmadi');
}

// GET /api/admin/recycling/supervisors — Barcha masul shaxslar
export async function GET() {
    try {
        const supervisors = await prisma.supervisor.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                point: true,
                _count: { select: { drivers: true, requests: true } },
            },
        });
        return NextResponse.json(supervisors);
    } catch (error) {
        console.error('[Supervisors GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// POST /api/admin/recycling/supervisors — Yangi masul yaratish
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.name?.trim() || !body.phone?.trim()) {
            return NextResponse.json({ error: 'Ism va telefon majburiy' }, { status: 400 });
        }

        const registrationCode = await generateSupervisorCode();

        const supervisor = await prisma.supervisor.create({
            data: {
                name: body.name.trim(),
                phone: normalizeStaffPhone(body.phone.trim()),
                telegramId: body.telegramId || null,
                telegramName: body.telegramName || null,
                pointId: body.pointId ? Number(body.pointId) : null,
                isActive: body.isActive ?? true,
                registrationCode,
            },
            include: { point: true },
        });

        await createBotEvent({
            sourceBot: 'platform',
            eventType: 'supervisor.created',
            entityType: 'supervisor',
            entityId: supervisor.id,
            severity: 'success',
            title: 'Admin/Supervisor qo\'shildi',
            message: `${supervisor.name} admin panel orqali tizimga qo'shildi.`,
            supervisorId: supervisor.id,
            pointId: supervisor.pointId ?? undefined,
            notifyAdmins: true,
        });

        return NextResponse.json(supervisor, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
            return NextResponse.json({ error: 'Bu telefon raqam allaqachon ro\'yxatda' }, { status: 409 });
        }
        console.error('[Supervisors POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
