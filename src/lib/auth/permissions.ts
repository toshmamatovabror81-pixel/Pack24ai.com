import type { Role } from './session';

export type Section =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'customers'
  | 'leads'
  | 'marketing'
  | 'content'
  | 'reports'
  | 'production' // ishlab chiqarish (WorkOrder)
  | 'finance' // shartnoma, hisob-faktura
  | 'inventory' // ombor qoldig'i
  | 'staff'
  | 'settings';

const ACCESS: Record<Exclude<Role, 'user'>, Section[] | 'all'> = {
  admin: 'all',
  manager: ['dashboard', 'orders', 'products', 'customers', 'leads', 'marketing', 'content', 'reports', 'production', 'finance', 'inventory'],
  staff: ['dashboard', 'orders', 'leads', 'production'],
};

export function can(role: Role, section: Section): boolean {
  if (role === 'user') return false;
  const allowed = ACCESS[role];
  return allowed === 'all' || allowed.includes(section);
}

export const roleNames: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Menejer',
  staff: 'Xodim',
  user: 'Mijoz',
};
