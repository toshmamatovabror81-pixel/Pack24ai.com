import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createBotEvent } from '@/lib/telegram/botEvents';
import { normalizeStaffPhone } from '@/lib/telegram/botAccessRequests';

// 5-raqamli unikal kod generatsiya
async function generateDriverCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
        const code = String(Math.floor(10000 + Math.random() * 90000)); // 10000-99999
        const existsDrv = await prisma.driver.findUnique({ where: { registrationCode: code } });
        const existsSup = await prisma.supervisor.findUnique({ where: { registrationCode: code } });
        if (!existsDrv && !existsSup) return code;
    }
    throw new Error('Kod generatsiya qilib bo\'lmadi');
}

// GET /api/admin/recycling/drivers — Barcha haydovchilar
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisorId');
        const pointId = searchParams.get('pointId');
        const status = searchParams.get('status');

        const where: Record<string, unknown> = {};
        if (supervisorId) where.supervisorId = Number(supervisorId);
        if (pointId) where.pointId = Number(pointId);
        if (status) where.status = status;

        const [drivers, supervisorPhones] = await Promise.all([
            prisma.driver.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    supervisor: true,
                    point: true,
                    _count: { select: { collections: true, assignedRequests: true } },
                },
            }),
            prisma.supervisor.findMany({ select: { phone: true } }),
        ]);

        const supPhoneSet = new Set(supervisorPhones.map((s) => s.phone));
        const result = drivers.map((d) => ({ ...d, isSupervisor: supPhoneSet.has(d.phone) }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Drivers GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// POST /api/admin/recycling/drivers — Yangi haydovchi
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.name?.trim() || !body.phone?.trim()) {
            return NextResponse.json({ error: 'Ism va telefon majburiy' }, { status: 400 });
        }

        const registrationCode = await generateDriverCode();

        const driver = await prisma.driver.create({
            data: {
                name: body.name.trim(),
                phone: normalizeStaffPhone(body.phone.trim()),
                telegramId: body.telegramId || null,
                telegramName: body.telegramName || null,
                supervisorId: body.supervisorId ? Number(body.supervisorId) : null,
                pointId: body.pointId ? Number(body.pointId) : null,
                vehicleInfo: body.vehicleInfo || null,
                status: body.status || 'active',
                registrationCode,
            },
            include: { supervisor: true, point: true },
        });

        await createBotEvent({
            sourceBot: 'platform',
            eventType: 'driver.created',
            entityType: 'driver',
            entityId: driver.id,
            severity: 'success',
            title: 'Driver qo\'shildi',
            message: `${driver.name} admin panel orqali tizimga qo'shildi.`,
            driverId: driver.id,
            supervisorId: driver.supervisorId ?? undefined,
            pointId: driver.pointId ?? undefined,
            notifyAdmins: true,
        });

        return NextResponse.json(driver, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
            return NextResponse.json({ error: 'Bu telefon raqam allaqachon ro\'yxatda' }, { status: 409 });
        }
        console.error('[Drivers POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
