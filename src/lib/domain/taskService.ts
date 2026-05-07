import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Re-export constants and types from the browser-safe constants module
export {
    TASK_DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES,
    DEPARTMENT_LABELS, PRIORITY_LABELS, STATUS_LABELS,
    canTransitionTaskStatus,
} from './taskConstants';
export type { TaskDepartment, TaskPriority, TaskStatus } from './taskConstants';
import { canTransitionTaskStatus } from './taskConstants';
import type { TaskDepartment, TaskPriority, TaskStatus } from './taskConstants';


// ─── Filters ─────────────────────────────────────────────────────────────────

export interface TaskFilters {
    status?: TaskStatus | TaskStatus[];
    department?: TaskDepartment;
    priority?: TaskPriority;
    assigneeId?: number;
    search?: string;
    page?: number;
    limit?: number;
}

// ─── Include shape ───────────────────────────────────────────────────────────

const TASK_LIST_INCLUDE = {
    assignees: {
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    },
    subtasks: { orderBy: { sortOrder: 'asc' as const } },
    _count: { select: { comments: true, attachments: true } },
    createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

const TASK_DETAIL_INCLUDE = {
    assignees: {
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    },
    subtasks: { orderBy: { sortOrder: 'asc' as const } },
    comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' as const },
    },
    attachments: { orderBy: { createdAt: 'desc' as const } },
    createdBy: { select: { id: true, name: true } },
    order: { select: { id: true, status: true, customerName: true } },
} satisfies Prisma.TaskInclude;

// ─── Public Code Generator ──────────────────────────────────────────────────

async function generatePublicCode(): Promise<string> {
    const last = await prisma.task.findFirst({
        where: { publicCode: { not: null } },
        orderBy: { id: 'desc' },
        select: { publicCode: true },
    });

    let nextNum = 1;
    if (last?.publicCode) {
        const match = last.publicCode.match(/TSK-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    return `TSK-${String(nextNum).padStart(4, '0')}`;
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/** Filtrlangan vazifalar ro'yxatini olish */
export async function getTasks(filters: TaskFilters = {}) {
    const { status, department, priority, assigneeId, search, page = 1, limit = 50 } = filters;

    const where: Prisma.TaskWhereInput = {};

    if (status) {
        where.status = Array.isArray(status) ? { in: status } : status;
    }
    if (department) where.department = department;
    if (priority) where.priority = priority;
    if (assigneeId) {
        where.assignees = { some: { userId: assigneeId } };
    }
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { publicCode: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [tasks, total] = await Promise.all([
        prisma.task.findMany({
            where,
            include: TASK_LIST_INCLUDE,
            orderBy: [
                { priority: 'desc' },
                { dueAt: 'asc' },
                { createdAt: 'desc' },
            ],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Bitta vazifani to'liq ma'lumot bilan olish */
export async function getTaskById(id: number) {
    return prisma.task.findUnique({
        where: { id },
        include: TASK_DETAIL_INCLUDE,
    });
}

/** Yangi vazifa yaratish */
export async function createTask(data: {
    title: string;
    description?: string;
    department?: TaskDepartment;
    priority?: TaskPriority;
    dueAt?: string | Date | null;
    estimatedMinutes?: number;
    orderId?: number;
    createdById?: number;
    assigneeIds?: number[];
    subtasks?: string[];
}) {
    const publicCode = await generatePublicCode();

    const task = await prisma.task.create({
        data: {
            publicCode,
            title: data.title,
            description: data.description ?? '',
            department: data.department ?? 'general',
            priority: data.priority ?? 'normal',
            dueAt: data.dueAt ? new Date(data.dueAt) : null,
            estimatedMinutes: data.estimatedMinutes,
            orderId: data.orderId,
            createdById: data.createdById,
            assignees: data.assigneeIds?.length
                ? { create: data.assigneeIds.map(userId => ({ userId })) }
                : undefined,
            subtasks: data.subtasks?.length
                ? {
                    create: data.subtasks.map((title, i) => ({
                        title,
                        sortOrder: i,
                    })),
                }
                : undefined,
        },
        include: TASK_DETAIL_INCLUDE,
    });

    return task;
}

/** Vazifani yangilash (status, priority, progress, h.k.) */
export async function updateTask(
    id: number,
    data: {
        title?: string;
        description?: string;
        department?: TaskDepartment;
        priority?: TaskPriority;
        status?: TaskStatus;
        dueAt?: string | Date | null;
        estimatedMinutes?: number | null;
        progress?: number;
        qualityScore?: number | null;
        evaluationNote?: string | null;
    },
) {
    // Status o'zgartirish tekshiruvi
    if (data.status) {
        const current = await prisma.task.findUnique({
            where: { id },
            select: { status: true },
        });
        if (!current) throw new Error('TASK_NOT_FOUND');
        if (!canTransitionTaskStatus(current.status as TaskStatus, data.status)) {
            throw new Error(`INVALID_TRANSITION:${current.status}->${data.status}`);
        }
    }

    const updateData: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === 'completed') {
            updateData.completedAt = new Date();
            updateData.progress = 100;
        }
    }
    if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.qualityScore !== undefined) updateData.qualityScore = data.qualityScore;
    if (data.evaluationNote !== undefined) updateData.evaluationNote = data.evaluationNote;

    return prisma.task.update({
        where: { id },
        data: updateData,
        include: TASK_DETAIL_INCLUDE,
    });
}

/** Vazifani o'chirish */
export async function deleteTask(id: number) {
    return prisma.task.delete({ where: { id } });
}

// ─── Subtask Operations ─────────────────────────────────────────────────────

export async function addSubtask(taskId: number, title: string) {
    const maxOrder = await prisma.taskSubtask.aggregate({
        where: { taskId },
        _max: { sortOrder: true },
    });
    return prisma.taskSubtask.create({
        data: {
            taskId,
            title,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
    });
}

export async function toggleSubtask(subtaskId: number) {
    const sub = await prisma.taskSubtask.findUnique({ where: { id: subtaskId } });
    if (!sub) throw new Error('SUBTASK_NOT_FOUND');

    const updated = await prisma.taskSubtask.update({
        where: { id: subtaskId },
        data: { done: !sub.done },
    });

    // Update parent task progress based on subtask completion
    const allSubtasks = await prisma.taskSubtask.findMany({ where: { taskId: sub.taskId } });
    if (allSubtasks.length > 0) {
        const doneCount = allSubtasks.filter(s => s.id === subtaskId ? !sub.done : s.done).length;
        const progress = Math.round((doneCount / allSubtasks.length) * 100);
        await prisma.task.update({
            where: { id: sub.taskId },
            data: { progress },
        });
    }

    return updated;
}

export async function deleteSubtask(subtaskId: number) {
    return prisma.taskSubtask.delete({ where: { id: subtaskId } });
}

// ─── Comment Operations ─────────────────────────────────────────────────────

export async function addTaskComment(taskId: number, authorId: number, body: string) {
    return prisma.taskComment.create({
        data: { taskId, authorId, body },
        include: { author: { select: { id: true, name: true } } },
    });
}

// ─── Assignee Operations ────────────────────────────────────────────────────

export async function assignUser(taskId: number, userId: number, role = 'assignee') {
    const assignee = await prisma.taskAssignee.upsert({
        where: { taskId_userId: { taskId, userId } },
        create: { taskId, userId, role },
        update: { role },
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });

    // Avtomatik bildirishnoma yuborish (Telegram → SMS → Call eskalatsiyasi)
    try {
        const { notifyAssigneeAboutTask } = await import('@/lib/services/notificationEscalationService');
        await notifyAssigneeAboutTask(taskId, userId);
    } catch (err) {
        console.error('[TaskService] Notification xatolik:', err);
    }

    return assignee;
}

export async function removeAssignee(taskId: number, userId: number) {
    return prisma.taskAssignee.delete({
        where: { taskId_userId: { taskId, userId } },
    });
}

// ─── Attachment Operations ──────────────────────────────────────────────────

export async function addAttachment(taskId: number, data: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    uploadedById?: number;
}) {
    return prisma.taskAttachment.create({
        data: { taskId, ...data },
    });
}

export async function removeAttachment(attachmentId: number) {
    return prisma.taskAttachment.delete({ where: { id: attachmentId } });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getTaskStats(department?: TaskDepartment) {
    const where: Prisma.TaskWhereInput = department ? { department } : {};

    const [pending, inProgress, review, completed, overdue] = await Promise.all([
        prisma.task.count({ where: { ...where, status: 'pending' } }),
        prisma.task.count({ where: { ...where, status: 'in_progress' } }),
        prisma.task.count({ where: { ...where, status: 'review' } }),
        prisma.task.count({ where: { ...where, status: 'completed' } }),
        prisma.task.count({
            where: {
                ...where,
                status: { in: ['pending', 'in_progress'] },
                dueAt: { lt: new Date() },
            },
        }),
    ]);

    return { pending, inProgress, review, completed, overdue, total: pending + inProgress + review + completed };
}

// ─── Users (for assignee picker) ────────────────────────────────────────────

export async function getStaffUsers() {
    return prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, phone: true, role: true },
        orderBy: { name: 'asc' },
    });
}
