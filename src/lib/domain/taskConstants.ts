// ─── Task Domain Constants ──────────────────────────────────────────────────
// Bu fayl faqat konstantalar va tiplarni o'z ichiga oladi — Prisma importlari yo'q.
// Frontend (client) komponentlari uchun xavfsiz import.

export const TASK_DEPARTMENTS = [
    'warehouse',
    'logistics',
    'production',
    'household',
    'general',
] as const;
export type TaskDepartment = (typeof TASK_DEPARTMENTS)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'review', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DEPARTMENT_LABELS: Record<TaskDepartment, string> = {
    warehouse: 'Omborxona',
    logistics: 'Logistika',
    production: 'Ishlab chiqarish',
    household: 'Xo\'jalik ishlari',
    general: 'Umumiy',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: 'Past',
    normal: 'O\'rtacha',
    high: 'Yuqori',
    urgent: 'Shoshilinch',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
    pending: 'Kutilmoqda',
    in_progress: 'Jarayonda',
    review: 'Tekshiruvda',
    completed: 'Bajarildi',
    cancelled: 'Bekor qilindi',
};

// Status transitions (valid next states)
const STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
    pending: ['in_progress', 'cancelled'],
    in_progress: ['review', 'completed', 'cancelled'],
    review: ['completed', 'in_progress'],
    completed: [],
    cancelled: [],
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
