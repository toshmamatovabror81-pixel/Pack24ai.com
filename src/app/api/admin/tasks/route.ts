import { NextRequest, NextResponse } from 'next/server';
import { getTasks, createTask, getStaffUsers } from '@/lib/domain/taskService';
import type { TaskDepartment, TaskPriority, TaskStatus } from '@/lib/domain/taskService';

/** GET /api/admin/tasks — Filtrlangan vazifalar ro'yxati */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const status = url.searchParams.get('status');
        const department = url.searchParams.get('department') as TaskDepartment | null;
        const priority = url.searchParams.get('priority') as TaskPriority | null;
        const assigneeId = url.searchParams.get('assigneeId');
        const search = url.searchParams.get('search');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const withStaff = url.searchParams.get('withStaff') === 'true';

        const statusFilter = status
            ? (status.includes(',') ? status.split(',') as TaskStatus[] : status as TaskStatus)
            : undefined;

        const result = await getTasks({
            status: statusFilter,
            department: department || undefined,
            priority: priority || undefined,
            assigneeId: assigneeId ? parseInt(assigneeId, 10) : undefined,
            search: search || undefined,
            page,
            limit,
        });

        // Optional: include staff list for assignee picker
        const staff = withStaff ? await getStaffUsers() : undefined;

        return NextResponse.json({ ...result, staff });
    } catch (err) {
        console.error('[API Tasks GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** POST /api/admin/tasks — Yangi vazifa yaratish */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const task = await createTask({
            title: body.title.trim(),
            description: body.description?.trim() ?? '',
            department: body.department,
            priority: body.priority,
            dueAt: body.dueAt,
            estimatedMinutes: body.estimatedMinutes,
            orderId: body.orderId,
            createdById: body.createdById,
            assigneeIds: body.assigneeIds,
            subtasks: body.subtasks,
        });

        return NextResponse.json(task, { status: 201 });
    } catch (err) {
        console.error('[API Tasks POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
