/**
 * User roles — typed source-of-truth
 *
 * Prisma schema'da hali `String`, lekin bu fayl runtime validatsiya
 * va TypeScript type-safety uchun yagona manba sifatida ishlatiladi.
 *
 * P2.4 da Prisma enum'ga o'tkaziladi.
 */

// ── User.role ─────────────────────────────────────────────────────────────

export const USER_ROLES = ['user', 'admin', 'staff', 'manager'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Role display labels (Uzbek) */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
    user: 'Foydalanuvchi',
    admin: 'Administrator',
    staff: 'Xodim',
    manager: 'Menejer',
};

/** Check if a string is a valid UserRole */
export function isValidUserRole(value: unknown): value is UserRole {
    return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

// ── User.customerType ─────────────────────────────────────────────────────

export const CUSTOMER_TYPES = ['individual', 'corporate', 'wholesale', 'dealer'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
    individual: 'Jismoniy shaxs',
    corporate: 'Yuridik shaxs',
    wholesale: 'Ulgurji',
    dealer: 'Diler',
};

export function isValidCustomerType(value: unknown): value is CustomerType {
    return typeof value === 'string' && (CUSTOMER_TYPES as readonly string[]).includes(value);
}

// ── User.customerGroup ────────────────────────────────────────────────────

export const CUSTOMER_GROUPS = ['standard', 'vip', 'new', 'inactive', 'blocked'] as const;
export type CustomerGroup = (typeof CUSTOMER_GROUPS)[number];

export const CUSTOMER_GROUP_LABELS: Record<CustomerGroup, string> = {
    standard: 'Standart',
    vip: 'VIP',
    new: 'Yangi',
    inactive: 'Faol emas',
    blocked: 'Bloklangan',
};

export function isValidCustomerGroup(value: unknown): value is CustomerGroup {
    return typeof value === 'string' && (CUSTOMER_GROUPS as readonly string[]).includes(value);
}

// ── User.ecoLevel ─────────────────────────────────────────────────────────

export const ECO_LEVELS = ['seed', 'sprout', 'sapling', 'tree', 'forest', 'guardian', 'legend'] as const;
export type EcoLevel = (typeof ECO_LEVELS)[number];

export const ECO_LEVEL_LABELS: Record<EcoLevel, string> = {
    seed: '🌱 Urug\'',
    sprout: '🌿 Ko\'chat',
    sapling: '🌳 Nihal',
    tree: '🌲 Daraxt',
    forest: '🌲🌲 O\'rmon',
    guardian: '🛡️ Himoyachi',
    legend: '⭐ Afsona',
};
