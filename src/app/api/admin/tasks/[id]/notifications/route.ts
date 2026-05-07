import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/admin/tasks/:id/notifications — vazifa uchun bildirishnomalar tarixi */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const taskId = parseInt(id, 10);

        const notifications = await prisma.taskNotification.findMany({
            where: { taskId },
            include: {
                user: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(notifications);
    } catch (err) {
        console.error('[API TaskNotifications GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
