import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export const STAFF_DEPARTMENTS = [
    'warehouse', 'logistics', 'production', 'household', 'sales', 'management',
] as const;
export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

export const STAFF_ROLES = ['admin', 'staff', 'manager', 'user'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const DEPARTMENT_LABELS: Record<StaffDepartment, string> = {
    warehouse: 'Omborxona',
    logistics: 'Logistika',
    production: 'Ishlab chiqarish',
    household: 'Xo\'jalik ishlari',
    sales: 'Sotuv',
    management: 'Boshqaruv',
};

// ─── Filters ─────────────────────────────────────────────────────────────────

interface StaffFilters {
    search?: string;
    department?: StaffDepartment;
    role?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

const STAFF_SELECT = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    department: true,
    position: true,
    telegramId: true,
    telegramVerifiedAt: true,
    telegramNotify: true,
    smsNotify: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            taskAssignments: true,
            tasksCreated: true,
        },
    },
} satisfies Prisma.UserSelect;

// ─── CRUD ────────────────────────────────────────────────────────────────────

/** Xodimlar ro'yxati (filtrlangan) */
export async function getStaff(filters: StaffFilters = {}) {
    const { search, department, role, isActive, page = 1, limit = 50 } = filters;

    const where: Prisma.UserWhereInput = {
        role: { not: 'user' }, // faqat xodimlar (user bo'lmagan)
    };

    if (department) where.department = department;
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
            { position: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [staff, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: STAFF_SELECT,
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    return { staff, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Bitta xodim to'liq ma'lumot */
export async function getStaffById(id: number) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            ...STAFF_SELECT,
            taskAssignments: {
                include: {
                    task: { select: { id: true, title: true, status: true, publicCode: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    });
}

/** Yangi xodim yaratish */
export async function createStaff(data: {
    name: string;
    phone: string;
    email?: string;
    role?: string;
    department?: string;
    position?: string;
    password: string;
}) {
    // Simple hash for now (in production use bcrypt)
    const { default: bcryptModule } = await import('bcryptjs');
    const passwordHash = await bcryptModule.hash(data.password, 10);

    return prisma.user.create({
        data: {
            name: data.name,
            phone: data.phone,
            email: data.email || null,
            role: data.role || 'staff',
            department: data.department || null,
            position: data.position || null,
            passwordHash,
        },
        select: STAFF_SELECT,
    });
}

/** Xodim ma'lumotlarini yangilash */
export async function updateStaff(id: number, data: {
    name?: string;
    phone?: string;
    email?: string | null;
    role?: string;
    department?: string | null;
    position?: string | null;
    isActive?: boolean;
    telegramNotify?: boolean;
    smsNotify?: boolean;
    password?: string;
}) {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.telegramNotify !== undefined) updateData.telegramNotify = data.telegramNotify;
    if (data.smsNotify !== undefined) updateData.smsNotify = data.smsNotify;

    if (data.password) {
        const { default: bcryptModule } = await import('bcryptjs');
        updateData.passwordHash = await bcryptModule.hash(data.password, 10);
    }

    return prisma.user.update({
        where: { id },
        data: updateData,
        select: STAFF_SELECT,
    });
}

/** Xodimni o'chirish */
export async function deleteStaff(id: number) {
    return prisma.user.delete({ where: { id } });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getStaffStats() {
    const [total, active, withTelegram, byDept] = await Promise.all([
        prisma.user.count({ where: { role: { not: 'user' } } }),
        prisma.user.count({ where: { role: { not: 'user' }, isActive: true } }),
        prisma.user.count({ where: { role: { not: 'user' }, telegramId: { not: null } } }),
        prisma.user.groupBy({
            by: ['department'],
            where: { role: { not: 'user' }, isActive: true },
            _count: true,
        }),
    ]);

    return {
        total,
        active,
        inactive: total - active,
        withTelegram,
        byDepartment: byDept.map(d => ({
            department: d.department || 'unassigned',
            count: d._count,
        })),
    };
}
