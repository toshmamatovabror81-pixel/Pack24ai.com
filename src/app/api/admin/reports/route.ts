import { NextRequest, NextResponse } from 'next/server';
import { buildReportsDateRange } from '@/lib/domain/admin/reports';
import { fetchAdminReportData } from '@/lib/domain/admin/reportsData';
import { verifyAdminAuth } from '@/lib/adminAuth';

// ─── GET /api/admin/reports — Analitika va hisobotlar ────────────────────────
export async function GET(req: NextRequest) {
    const authError = await verifyAdminAuth(req);
    if (authError) return authError;

    try {
        const { searchParams } = new URL(req.url);
        const dateRange = buildReportsDateRange(
            searchParams.get('period'),
            searchParams.get('from'),
            searchParams.get('to'),
        );

        const data = await fetchAdminReportData(dateRange);
        return NextResponse.json(data);
    } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_FROM') {
            return NextResponse.json({ error: 'Noto\'g\'ri from sana' }, { status: 400 });
        }

        if (error instanceof Error && error.message === 'INVALID_TO') {
            return NextResponse.json({ error: 'Noto\'g\'ri to sana' }, { status: 400 });
        }

        if (error instanceof Error && error.message === 'INVALID_RANGE') {
            return NextResponse.json({ error: '`to` sanasi `from` dan katta bo\'lishi kerak' }, { status: 400 });
        }

        console.error('[API/admin/reports]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
