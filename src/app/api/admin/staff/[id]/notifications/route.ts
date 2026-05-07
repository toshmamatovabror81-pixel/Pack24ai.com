import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/admin/staff/:id/notifications — Bildirishnoma sozlamalarini o'zgartirish */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const userId = parseInt(id, 10);
        const body = await req.json();

        const data: Record<string, boolean> = {};
        if (typeof body.telegramNotify === 'boolean') data.telegramNotify = body.telegramNotify;
        if (typeof body.smsNotify === 'boolean') data.smsNotify = body.smsNotify;

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true, name: true,
                telegramNotify: true, smsNotify: true,
            },
        });

        return NextResponse.json(user);
    } catch (err) {
        console.error('[API Staff Notifications PATCH]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
