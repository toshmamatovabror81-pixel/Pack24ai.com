import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { BotAccessStatus, BotAccessRole } from '@prisma/client';
import { createOrReuseBotAccessRequest } from '@/lib/telegram/botAccessRequests';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'pending';
        const role = searchParams.get('role') || 'all';

        const where: Prisma.BotAccessRequestWhereInput = {};
        if (status !== 'all') where.status = status as BotAccessStatus;
        if (role !== 'all') where.role = role as BotAccessRole;

        const [items, summary] = await Promise.all([
            prisma.botAccessRequest.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: {
                    requestedPoint: true,
                    requestedSupervisor: true,
                    createdSupervisor: true,
                    createdDriver: true,
                },
            }),
            prisma.botAccessRequest.groupBy({
                by: ['role', 'status'],
                _count: { _all: true },
            }),
        ]);

        return NextResponse.json({ items, summary });
    } catch (error) {
        console.error('[BotAccessRequests GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            role?: 'supervisor' | 'driver';
            name?: string;
            phone?: string;
            telegramId?: string | null;
            telegramName?: string | null;
            vehicleInfo?: string | null;
            requestedPointId?: number | string | null;
            requestedSupervisorId?: number | string | null;
        };

        if (!body.role || !['supervisor', 'driver'].includes(body.role)) {
            return NextResponse.json({ error: 'Role noto\'g\'ri' }, { status: 400 });
        }
        if (!body.name?.trim() || !body.phone?.trim()) {
            return NextResponse.json({ error: 'Ism va telefon majburiy' }, { status: 400 });
        }

        const result = await createOrReuseBotAccessRequest({
            role: body.role,
            name: body.name,
            phone: body.phone,
            telegramId: body.telegramId || null,
            telegramName: body.telegramName || null,
            vehicleInfo: body.vehicleInfo || null,
            requestedPointId: body.requestedPointId ? Number(body.requestedPointId) : null,
            requestedSupervisorId: body.requestedSupervisorId ? Number(body.requestedSupervisorId) : null,
            sourceBot: 'platform',
        });

        if (result.kind === 'existing') {
            return NextResponse.json({ error: 'Bu telefon allaqachon tizimda mavjud' }, { status: 409 });
        }

        return NextResponse.json(result.request, { status: result.kind === 'created' ? 201 : 200 });
    } catch (error) {
        console.error('[BotAccessRequests POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
