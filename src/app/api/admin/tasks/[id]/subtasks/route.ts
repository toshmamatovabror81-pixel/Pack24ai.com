import { NextRequest, NextResponse } from 'next/server';
import { addSubtask, toggleSubtask, deleteSubtask } from '@/lib/domain/taskService';

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/tasks/:id/subtasks — Subtask qo'shish */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();

        if (!body.title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const subtask = await addSubtask(parseInt(id, 10), body.title.trim());
        return NextResponse.json(subtask, { status: 201 });
    } catch (err) {
        console.error('[API Subtasks POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** PATCH /api/admin/tasks/:id/subtasks — Subtask toggle (done/undone) */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.subtaskId) {
            return NextResponse.json({ error: 'subtaskId is required' }, { status: 400 });
        }
        const subtask = await toggleSubtask(body.subtaskId);
        return NextResponse.json(subtask);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal error';
        if (msg === 'SUBTASK_NOT_FOUND') {
            return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
        }
        console.error('[API Subtasks PATCH]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** DELETE /api/admin/tasks/:id/subtasks — Subtask o'chirish */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const subtaskId = searchParams.get('subtaskId');
        if (!subtaskId) {
            return NextResponse.json({ error: 'subtaskId is required' }, { status: 400 });
        }
        await deleteSubtask(parseInt(subtaskId, 10));
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[API Subtasks DELETE]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
