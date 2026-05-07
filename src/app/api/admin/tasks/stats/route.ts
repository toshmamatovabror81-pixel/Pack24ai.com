import { NextRequest, NextResponse } from 'next/server';
import { getTaskStats } from '@/lib/domain/taskService';
import type { TaskDepartment } from '@/lib/domain/taskService';

/** GET /api/admin/tasks/stats — Vazifa statistikasi */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const department = url.searchParams.get('department') as TaskDepartment | null;

        const stats = await getTaskStats(department || undefined);
        return NextResponse.json(stats);
    } catch (err) {
        console.error('[API Tasks Stats]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
