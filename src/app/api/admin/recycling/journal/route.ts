import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    buildMonthlyJournalView,
    monthRange,
} from '@/lib/domain/recycling/journal';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
    const authError = await verifyAdminAuth(req);
    if (authError) return authError;

    try {
        const { searchParams } = new URL(req.url);
        const month = searchParams.get('month');
        const supervisorId = searchParams.get('supervisorId');
        const pointId = searchParams.get('pointId');
        const { rawMonth, from, to, daysInMonth } = monthRange(month);

        const baseFilter: { supervisorId?: number; pointId?: number } = {};
        if (supervisorId) baseFilter.supervisorId = Number(supervisorId);
        if (pointId) baseFilter.pointId = Number(pointId);

        const [intakes, presses, sales, expenses, cashLogs] = await Promise.all([
            prisma.recycleManualIntake.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.recyclePressLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.recycleSalesLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.recycleExpenseLog.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.recycleDailyCash.findMany({
                where: { ...baseFilter, date: { gte: from, lt: to } },
                orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            }),
        ]);

        const monthlyJournal = buildMonthlyJournalView({
            rawMonth,
            daysInMonth,
            intakes,
            presses,
            sales,
            expenses,
            cashLogs,
        });

        return NextResponse.json({
            month: rawMonth,
            daysInMonth,
            ...monthlyJournal,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_MONTH') {
            return NextResponse.json({ error: 'Noto\'g\'ri month formati. YYYY-MM bo\'lishi kerak.' }, { status: 400 });
        }
        console.error('[Recycle Journal GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
