import { NextRequest, NextResponse } from 'next/server';
import { getTaskById, updateTask, deleteTask } from '@/lib/domain/taskService';

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/admin/tasks/:id — Bitta vazifa to'liq ma'lumot */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const task = await getTaskById(parseInt(id, 10));
        if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(task);
    } catch (err) {
        console.error('[API Task GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** PATCH /api/admin/tasks/:id — Vazifani yangilash */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();
        const task = await updateTask(parseInt(id, 10), body);
        return NextResponse.json(task);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal error';
        if (msg === 'TASK_NOT_FOUND') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (msg.startsWith('INVALID_TRANSITION')) {
            return NextResponse.json({ error: msg }, { status: 400 });
        }
        console.error('[API Task PATCH]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** DELETE /api/admin/tasks/:id — Vazifani o'chirish */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        await deleteTask(parseInt(id, 10));
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[API Task DELETE]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
