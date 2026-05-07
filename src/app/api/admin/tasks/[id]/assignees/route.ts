import { NextRequest, NextResponse } from 'next/server';
import { assignUser, removeAssignee } from '@/lib/domain/taskService';

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/tasks/:id/assignees — Xodim biriktirish */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();

        if (!body.userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const assignee = await assignUser(
            parseInt(id, 10),
            body.userId,
            body.role || 'assignee',
        );

        return NextResponse.json(assignee, { status: 201 });
    } catch (err) {
        console.error('[API Assignees POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** DELETE /api/admin/tasks/:id/assignees — Xodim olib tashlash */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        await removeAssignee(parseInt(id, 10), parseInt(userId, 10));
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[API Assignees DELETE]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
