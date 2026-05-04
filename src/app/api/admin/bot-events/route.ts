import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function readPositiveIntegerParam(value: string | null, fieldName: string) {
    if (!value) return undefined;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${fieldName} musbat butun son bo'lishi kerak`);
    }

    return parsed;
}

function readDateBoundaryParam(
    value: string | null,
    fieldName: string,
    boundary: 'start' | 'end',
) {
    if (!value) return undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${fieldName} YYYY-MM-DD formatda bo'lishi kerak`);
    }

    const iso = boundary === 'start'
        ? `${value}T00:00:00.000Z`
        : `${value}T23:59:59.999Z`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${fieldName} noto'g'ri sana`);
    }

    return parsed;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sourceBot = searchParams.get('sourceBot');
        const eventType = searchParams.get('eventType');
        const entityType = searchParams.get('entityType');
        const entityId = readPositiveIntegerParam(searchParams.get('entityId'), 'entityId');
        const from = readDateBoundaryParam(searchParams.get('from'), 'from', 'start');
        const to = readDateBoundaryParam(searchParams.get('to'), 'to', 'end');
        const severity = searchParams.get('severity');
        const status = searchParams.get('status');
        const q = searchParams.get('q')?.trim();
        const take = Math.min(Number(searchParams.get('take') || 50), 100);

        const where: {
            sourceBot?: string;
            eventType?: string;
            entityType?: string;
            entityId?: number;
            createdAt?: {
                gte?: Date;
                lte?: Date;
            };
            severity?: string;
            status?: string;
            OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; message?: { contains: string; mode: 'insensitive' } }>;
        } = {};

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = from;
            if (to) where.createdAt.lte = to;
        }
        if (sourceBot && sourceBot !== 'all') where.sourceBot = sourceBot;
        if (eventType && eventType !== 'all') where.eventType = eventType;
        if (entityType && entityType !== 'all') where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (severity && severity !== 'all') where.severity = severity;
        if (status && status !== 'all') where.status = status;
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { message: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [items, total, unread, critical, sourceGroups, eventTypeGroups, entityTypeGroups] = await Promise.all([
            prisma.botEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
            }),
            prisma.botEvent.count({ where }),
            prisma.botEvent.count({
                where: {
                    ...where,
                    status: 'new',
                },
            }),
            prisma.botEvent.count({
                where: {
                    ...where,
                    severity: { in: ['warning', 'error'] },
                },
            }),
            prisma.botEvent.groupBy({
                by: ['sourceBot'],
                _count: { _all: true },
                where,
            }),
            prisma.botEvent.groupBy({
                by: ['eventType'],
                _count: { _all: true },
                where,
                orderBy: {
                    eventType: 'asc',
                },
            }),
            prisma.botEvent.groupBy({
                by: ['entityType'],
                _count: { _all: true },
                where: {
                    ...where,
                    entityType: where.entityType ?? { not: null },
                },
                orderBy: {
                    entityType: 'asc',
                },
            }),
        ]);

        return NextResponse.json({
            items,
            summary: {
                total,
                unread,
                critical,
                bySource: sourceGroups.map((row) => ({
                    sourceBot: row.sourceBot,
                    count: row._count._all,
                })),
                byEventType: eventTypeGroups.map((row) => ({
                    eventType: row.eventType,
                    count: row._count._all,
                })),
                byEntityType: entityTypeGroups
                    .filter((row) => row.entityType)
                    .map((row) => ({
                        entityType: row.entityType as string,
                        count: row._count._all,
                    })),
            },
        });
    } catch (error) {
        if (
            error instanceof Error &&
            (
                error.message.includes('musbat butun son') ||
                error.message.includes('YYYY-MM-DD') ||
                error.message.includes('noto\'g\'ri sana')
            )
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('[BotEvents GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
