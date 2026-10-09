import 'server-only';
import { prisma } from '@/lib/db';
import { dayRange, monthRange, summarize, tashkentKey, type DayTotals, type JournalRows, type JournalScope } from './shared';

/**
 * Admin jurnal ma'lumotlari — sana ORALIG'I bilan (Toshkent kuni), poydevor dailySummary/dayEntries/monthGrid o'rniga.
 * Sabab: collections.ts acceptAtBase() `date` ga vaqt belgisi yozadi, poydevor esa aniq tenglik bilan qidiradi va u qatorlarni ko'rmaydi
 * (oy jadvalida esa bir kun uchun bir nechta guruh bo'lib, oxirgisi qoladi). Punkt ko'rinishida ochilish — masullar yig'indisi.
 */

const scopeWhere = (s: JournalScope) => ('supervisorId' in s ? { supervisorId: s.supervisorId } : { pointId: s.pointId });
const SUP = { supervisor: { select: { name: true } } };

/** Bir kun yozuvlari (masul nomi bilan) */
export async function dayEntriesRange(scope: JournalScope, day: Date) {
  const where = { ...scopeWhere(scope), date: dayRange(day) };
  const [intake, press, expense, sales, cash] = await Promise.all([
    prisma.recycleManualIntake.findMany({ where, orderBy: { id: 'asc' }, include: SUP }),
    prisma.recyclePressLog.findMany({ where, orderBy: { id: 'asc' }, include: SUP }),
    prisma.recycleExpenseLog.findMany({ where, orderBy: { id: 'asc' }, include: SUP }),
    prisma.recycleSalesLog.findMany({ where, orderBy: { id: 'asc' }, include: SUP }),
    prisma.recycleDailyCash.findMany({ where, orderBy: { id: 'asc' }, include: SUP }),
  ]);
  return { intake, press, expense, sales, cash };
}

const emptyRows = (): JournalRows => ({ intake: [], press: [], expense: [], sales: [], cash: [] });

/** Oy jadvali: har kun uchun yig'indi (bo'sh kunlar ham); vaqt belgili qatorlar Toshkent kuniga tushadi */
export async function monthGridRange(scope: JournalScope, year: number, month: number): Promise<DayTotals[]> {
  const where = { ...scopeWhere(scope), date: monthRange(year, month) };
  const [intakes, presses, expenses, sales, cash] = await Promise.all([
    prisma.recycleManualIntake.findMany({ where, select: { date: true, weightKg: true, totalAmount: true } }),
    prisma.recyclePressLog.findMany({ where, select: { date: true, pressedKg: true, baleCount: true } }),
    prisma.recycleExpenseLog.findMany({ where, select: { date: true, expenseAmount: true, advanceAmount: true } }),
    prisma.recycleSalesLog.findMany({ where, select: { date: true, weightKg: true, totalAmount: true } }),
    prisma.recycleDailyCash.findMany({ where, orderBy: { id: 'asc' }, select: { date: true, supervisorId: true, openingBalance: true } }),
  ]);
  const buckets = new Map<string, JournalRows>();
  const bucket = (d: Date) => {
    const k = tashkentKey(d);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = emptyRows()));
    return b;
  };
  for (const r of intakes) bucket(r.date).intake.push(r);
  for (const r of presses) bucket(r.date).press.push(r);
  for (const r of expenses) bucket(r.date).expense.push(r);
  for (const r of sales) bucket(r.date).sales.push(r);
  for (const r of cash) bucket(r.date).cash.push(r);
  const from = Date.UTC(year, month - 1, 1);
  const to = Date.UTC(year, month, 1);
  const days: DayTotals[] = [];
  for (let t = from; t < to; t += 86_400_000) {
    const d = new Date(t);
    days.push(summarize(d, buckets.get(d.toISOString().slice(0, 10)) ?? emptyRows()));
  }
  return days;
}
