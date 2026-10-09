import 'server-only';
import { prisma } from '@/lib/db';

export { dayEnd, parseDayStart, tashkentDayStart } from './dates';

/** RecyclingNav uchun: yangi arizalar soni */
export async function recyclingBadges(): Promise<Record<string, number>> {
  const n = await prisma.recycleRequest.count({ where: { status: 'new_' } }).catch(() => 0);
  return { '/admin/recycling': n };
}

/** Punktga bog'langan yozuvlar: arizalar, xodimlar, jurnal, so'rovlar — bittasi bo'lsa ham punkt o'chirilmaydi (SetNull bilan tarix punktsiz qolmasin) */
export const POINT_LINK_COUNTS = { requests: true, supervisors: true, drivers: true, invitedDrivers: true, botAccessRequests: true, intakeLogs: true, pressLogs: true, expenseLogs: true, cashLogs: true, salesLogs: true, journalCorrectionRequests: true } as const;
export const pointLinkedCount = (c: Record<keyof typeof POINT_LINK_COUNTS, number>) => Object.values(c).reduce((a, b) => a + b, 0);
