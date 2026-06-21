import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/adminAuth';

function dayRange(dateParam?: string | null) {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        throw new Error('INVALID_DATE');
    }

    const from = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(from.getTime())) {
        throw new Error('INVALID_DATE');
    }

    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    return { from, to, rawDate: dateParam };
}

export async function GET(req: NextRequest) {
    const authError = await verifyAdminAuth(req);
    if (authError) return authError;

    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const supervisorId = searchParams.get('supervisorId');
        const pointId = searchParams.get('pointId');
        const { from, to, rawDate } = dayRange(date);

        const baseFilter: { supervisorId?: number; pointId?: number } = {};
        if (supervisorId) baseFilter.supervisorId = Number(supervisorId);
        if (pointId) baseFilter.pointId = Number(pointId);

        const [intakes, presses, sales, expenses, cashLogs] = await Promise.all([
            prisma.recycleManualIntake.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: { createdAt: 'asc' },
                include: {
                    supervisor: { select: { id: true, name: true } },
                    point: { select: { id: true, regionUz: true } },
                },
            }),
            prisma.recyclePressLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: { createdAt: 'asc' },
                include: {
                    supervisor: { select: { id: true, name: true } },
                    point: { select: { id: true, regionUz: true } },
                },
            }),
            prisma.recycleSalesLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: { createdAt: 'asc' },
                include: {
                    supervisor: { select: { id: true, name: true } },
                    point: { select: { id: true, regionUz: true } },
                },
            }),
            prisma.recycleExpenseLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: { createdAt: 'asc' },
                include: {
                    supervisor: { select: { id: true, name: true } },
                    point: { select: { id: true, regionUz: true } },
                },
            }),
            prisma.recycleDailyCash.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: { createdAt: 'asc' },
                include: {
                    supervisor: { select: { id: true, name: true } },
                    point: { select: { id: true, regionUz: true } },
                },
            }),
        ]);

        return NextResponse.json({
            date: rawDate,
            intakes,
            presses,
            sales,
            expenses,
            cashLogs,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_DATE') {
            return NextResponse.json({ error: 'Noto\'g\'ri date formati. YYYY-MM-DD bo\'lishi kerak.' }, { status: 400 });
        }
        console.error('[Recycle Journal Day GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
