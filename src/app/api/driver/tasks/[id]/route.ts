import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyDriverToken } from '@/lib/auth/verifyDriverToken';
import { ADMIN_AUTH_COOKIE, ADMIN_AUTH_HEADER, validateAdminToken } from '@/lib/adminAuthShared';

async function isAdminRequest(req: NextRequest): Promise<boolean> {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return false;

    const cookie = req.cookies.get(ADMIN_AUTH_COOKIE)?.value;
    if (cookie) {
        const v = await validateAdminToken(cookie, adminSecret);
        if (v.valid) return true;
    }

    const header = req.headers.get(ADMIN_AUTH_HEADER);
    if (header) {
        const v = await validateAdminToken(header, adminSecret);
        if (v.valid) return true;
    }

    return false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: rawId } = await params;
        const taskId = parseInt(rawId, 10);
        if (isNaN(taskId)) return NextResponse.json({ error: 'Noto\'g\'ri ID' }, { status: 400 });

        const task = await prisma.recycleRequest.findUnique({
            where: { id: taskId },
            include: {
                point: true,
                user: { select: { id: true, name: true, phone: true } },
                collections: { select: { actualWeight: true, totalAmount: true, createdAt: true } },
            }
        });

        if (!task) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

        // Admin panel — to'liq ma'lumot
        if (await isAdminRequest(req)) {
            return NextResponse.json(task);
        }

        // Haydovchi — faqat o'ziga tayinlangan ariza
        const authHeader = req.headers.get('authorization');
        const driverAuth = await verifyDriverToken(authHeader);

        if (!driverAuth.ok) {
            return NextResponse.json({ error: driverAuth.error }, { status: 401 });
        }

        if (task.assignedDriverId !== driverAuth.driverId) {
            return NextResponse.json({ error: 'Bu ariza sizga tayinlanmagan' }, { status: 403 });
        }

        return NextResponse.json(task);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server xatosi';
        return NextResponse.json({ error: 'Server xatosi', detail: message }, { status: 500 });
    }
}
