import { NextRequest, NextResponse } from 'next/server';
import { addTaskComment } from '@/lib/domain/taskService';

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/tasks/:id/comments — Izoh qo'shish */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();

        if (!body.body?.trim()) {
            return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
        }

        const comment = await addTaskComment(
            parseInt(id, 10),
            body.authorId ?? 1, // Default to admin user
            body.body.trim(),
        );

        return NextResponse.json(comment, { status: 201 });
    } catch (err) {
        console.error('[API Task Comments POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
