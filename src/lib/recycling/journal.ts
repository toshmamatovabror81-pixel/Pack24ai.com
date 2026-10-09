import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';

/**
 * Masul kunlik jurnali: qabul (intake), press, xarajat/avans, kassa ochilishi, sotuv.
 * Sana — faqat kalendar kuni (Toshkent vaqti). Bazada UTC yarim tun sifatida saqlanadi: 2026-10-08 → 2026-10-08T00:00:00Z.
 * Kassa yakuni = ochilish + sotuv − qabul − xarajat − avans.
 */

const TZ_OFFSET_MIN = 5 * 60; // Asia/Tashkent, DST yo'q

/** Hozirgi Toshkent sanasi (UTC yarim tun ko'rinishida) */
export function todayTashkent(now = new Date()): Date {
  const local = new Date(now.getTime() + TZ_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export const dateKey = (d: Date) => d.toISOString().slice(0, 10);
export const dateLabel = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

/** 'bugun' | 'kecha' | 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'DD.MM' → sana, aks holda null */
export function parseJournalDate(text: string, now = new Date()): Date | null {
  const t = text.trim().toLowerCase();
  const today = todayTashkent(now);
  if (!t || t === 'bugun' || t === 'сегодня' || t === 'today') return today;
  if (t === 'kecha' || t === 'вчера' || t === 'yesterday') return new Date(today.getTime() - 86_400_000);
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[./](\d{1,2})$/.exec(t))) [d, m, y] = [Number(match[1]), Number(match[2]), today.getUTCFullYear()];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 ? date : null;
}

export class JournalError extends Error {
  constructor(public code: 'value' | 'date' | 'supervisor', message: string) {
    super(message);
  }
}

const positive = (v: unknown, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new JournalError('value', `${label} noto'g'ri`);
  return n;
};

async function supervisorPoint(supervisorId: number): Promise<number | null> {
  const s = await prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { pointId: true } });
  if (!s) throw new JournalError('supervisor', 'Masul topilmadi');
  return s.pointId;
}

export async function addIntake(supervisorId: number, input: { date: Date; weightKg: number; pricePerKg: number; note?: string | null }) {
  const weightKg = positive(input.weightKg, "Og'irlik");
  const pricePerKg = positive(input.pricePerKg, 'Narx');
  const pointId = await supervisorPoint(supervisorId);
  return prisma.recycleManualIntake.create({ data: { supervisorId, pointId, date: input.date, weightKg, pricePerKg, totalAmount: Math.round(weightKg * pricePerKg), note: input.note?.trim().slice(0, 300) || null } });
}

export async function addPress(supervisorId: number, input: { date: Date; pressedKg: number; baleCount: number; operators?: string | null; note?: string | null }) {
  const pointId = await supervisorPoint(supervisorId);
  return prisma.recyclePressLog.create({ data: { supervisorId, pointId, date: input.date, pressedKg: positive(input.pressedKg, "Og'irlik"), baleCount: Math.floor(positive(input.baleCount, 'Toylar soni')), operators: input.operators?.trim().slice(0, 200) || null, note: input.note?.trim().slice(0, 300) || null } });
}

export async function addExpense(supervisorId: number, input: { date: Date; expenseAmount?: number; advanceAmount?: number; comment?: string | null }) {
  const expenseAmount = positive(input.expenseAmount ?? 0, 'Xarajat');
  const advanceAmount = positive(input.advanceAmount ?? 0, 'Avans');
  if (!expenseAmount && !advanceAmount) throw new JournalError('value', 'Xarajat yoki avans summasi kerak');
  const pointId = await supervisorPoint(supervisorId);
  return prisma.recycleExpenseLog.create({ data: { supervisorId, pointId, date: input.date, expenseAmount, advanceAmount, comment: input.comment?.trim().slice(0, 300) || null } });
}

export async function addSale(supervisorId: number, input: { date: Date; customerName: string; weightKg: number; baleCount?: number; pricePerKg: number; vehicleType?: string | null; plateNumber?: string | null; note?: string | null }) {
  const weightKg = positive(input.weightKg, "Og'irlik");
  const pricePerKg = positive(input.pricePerKg, 'Narx');
  const customerName = input.customerName.trim().slice(0, 150);
  if (customerName.length < 2) throw new JournalError('value', 'Xaridor nomi kerak');
  const pointId = await supervisorPoint(supervisorId);
  return prisma.recycleSalesLog.create({ data: { supervisorId, pointId, date: input.date, customerName, weightKg, baleCount: Math.floor(positive(input.baleCount ?? 0, 'Toylar')), pricePerKg, totalAmount: Math.round(weightKg * pricePerKg), vehicleType: input.vehicleType?.trim().slice(0, 60) || null, plateNumber: input.plateNumber?.trim().slice(0, 20) || null, note: input.note?.trim().slice(0, 300) || null } });
}

/** Kunlik kassa ochilishi: bitta masul uchun kuniga bitta (upsert) */
export async function setDailyCash(supervisorId: number, input: { date: Date; openingBalance: number; note?: string | null }) {
  const openingBalance = positive(input.openingBalance, 'Ochilish summasi');
  const pointId = await supervisorPoint(supervisorId);
  return prisma.recycleDailyCash.upsert({
    where: { supervisorId_date: { supervisorId, date: input.date } },
    create: { supervisorId, pointId, date: input.date, openingBalance, note: input.note?.trim().slice(0, 300) || null },
    update: { openingBalance, note: input.note?.trim().slice(0, 300) || null },
  });
}

export type DaySummary = {
  date: Date;
  opening: number | null;
  intakeKg: number; intakeSum: number; intakeCount: number;
  pressedKg: number; bales: number;
  expense: number; advance: number;
  salesKg: number; salesSum: number; salesCount: number;
  closing: number | null;
};

type Scope = { supervisorId: number } | { pointId: number };
const scopeWhere = (s: Scope) => ('supervisorId' in s ? { supervisorId: s.supervisorId } : { pointId: s.pointId });
/** Kun — [yarim tun, keyingi yarim tun) oralig'i: vaqt belgisi bilan yozilgan eski qatorlar ham shu kunga tushadi */
const dayRange = (date: Date) => ({ gte: date, lt: new Date(date.getTime() + 86_400_000) });

/** Punkt bo'yicha kassa ochilishi — har masulning (birinchi) ochilishi yig'indisi; masul bo'yicha — o'zi */
function openingOf(rows: { supervisorId: number; openingBalance: unknown }[]): number | null {
  if (!rows.length) return null;
  const seen = new Map<number, number>();
  for (const c of rows) if (!seen.has(c.supervisorId)) seen.set(c.supervisorId, toNumber(c.openingBalance as number));
  return [...seen.values()].reduce((a, b) => a + b, 0);
}

/** Bir kunlik yig'indilar (masul yoki punkt bo'yicha) */
export async function dailySummary(scope: Scope, date: Date): Promise<DaySummary> {
  const where = { ...scopeWhere(scope), date: dayRange(date) };
  const [intake, press, expense, sales, cash] = await Promise.all([
    prisma.recycleManualIntake.aggregate({ where, _sum: { weightKg: true, totalAmount: true }, _count: true }),
    prisma.recyclePressLog.aggregate({ where, _sum: { pressedKg: true, baleCount: true } }),
    prisma.recycleExpenseLog.aggregate({ where, _sum: { expenseAmount: true, advanceAmount: true } }),
    prisma.recycleSalesLog.aggregate({ where, _sum: { weightKg: true, totalAmount: true }, _count: true }),
    prisma.recycleDailyCash.findMany({ where, orderBy: { id: 'asc' } }),
  ]);
  const opening = openingOf(cash);
  const intakeSum = toNumber(intake._sum.totalAmount);
  const exp = toNumber(expense._sum.expenseAmount);
  const adv = toNumber(expense._sum.advanceAmount);
  const salesSum = toNumber(sales._sum.totalAmount);
  return {
    date, opening,
    intakeKg: intake._sum.weightKg ?? 0, intakeSum, intakeCount: intake._count,
    pressedKg: press._sum.pressedKg ?? 0, bales: press._sum.baleCount ?? 0,
    expense: exp, advance: adv,
    salesKg: sales._sum.weightKg ?? 0, salesSum, salesCount: sales._count,
    closing: opening == null ? null : Math.round(opening + salesSum - intakeSum - exp - adv),
  };
}

/** Oy jadvali: har kun uchun yig'indi (bo'sh kunlar ham) */
export async function monthGrid(scope: Scope, year: number, month: number): Promise<DaySummary[]> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const where = { ...scopeWhere(scope), date: { gte: from, lt: to } };
  const [intakes, presses, expenses, sales, cash] = await Promise.all([
    prisma.recycleManualIntake.groupBy({ by: ['date'], where, _sum: { weightKg: true, totalAmount: true }, _count: true }),
    prisma.recyclePressLog.groupBy({ by: ['date'], where, _sum: { pressedKg: true, baleCount: true } }),
    prisma.recycleExpenseLog.groupBy({ by: ['date'], where, _sum: { expenseAmount: true, advanceAmount: true } }),
    prisma.recycleSalesLog.groupBy({ by: ['date'], where, _sum: { weightKg: true, totalAmount: true }, _count: true }),
    prisma.recycleDailyCash.findMany({ where, orderBy: { id: 'asc' } }),
  ]);
  // Bir kunga bir nechta guruh tushishi mumkin (vaqt belgili eski qatorlar) — kalit bo'yicha qo'shib boramiz
  const acc = new Map<string, { intakeKg: number; intakeSum: number; intakeCount: number; pressedKg: number; bales: number; expense: number; advance: number; salesKg: number; salesSum: number; salesCount: number }>();
  const get = (k: string) => {
    let v = acc.get(k);
    if (!v) { v = { intakeKg: 0, intakeSum: 0, intakeCount: 0, pressedKg: 0, bales: 0, expense: 0, advance: 0, salesKg: 0, salesSum: 0, salesCount: 0 }; acc.set(k, v); }
    return v;
  };
  for (const i of intakes) { const v = get(dateKey(i.date)); v.intakeKg += i._sum.weightKg ?? 0; v.intakeSum += toNumber(i._sum.totalAmount); v.intakeCount += i._count; }
  for (const p of presses) { const v = get(dateKey(p.date)); v.pressedKg += p._sum.pressedKg ?? 0; v.bales += p._sum.baleCount ?? 0; }
  for (const e of expenses) { const v = get(dateKey(e.date)); v.expense += toNumber(e._sum.expenseAmount); v.advance += toNumber(e._sum.advanceAmount); }
  for (const s of sales) { const v = get(dateKey(s.date)); v.salesKg += s._sum.weightKg ?? 0; v.salesSum += toNumber(s._sum.totalAmount); v.salesCount += s._count; }
  const cashByDay = new Map<string, typeof cash>();
  for (const c of cash) { const k = dateKey(c.date); cashByDay.set(k, [...(cashByDay.get(k) ?? []), c]); }
  const days: DaySummary[] = [];
  for (let d = new Date(from); d < to; d = new Date(d.getTime() + 86_400_000)) {
    const k = dateKey(d);
    const v = acc.get(k);
    const opening = openingOf(cashByDay.get(k) ?? []);
    const intakeSum = v?.intakeSum ?? 0, exp = v?.expense ?? 0, adv = v?.advance ?? 0, salesSum = v?.salesSum ?? 0;
    days.push({
      date: new Date(d), opening,
      intakeKg: Math.round((v?.intakeKg ?? 0) * 100) / 100, intakeSum, intakeCount: v?.intakeCount ?? 0,
      pressedKg: Math.round((v?.pressedKg ?? 0) * 100) / 100, bales: v?.bales ?? 0,
      expense: exp, advance: adv,
      salesKg: Math.round((v?.salesKg ?? 0) * 100) / 100, salesSum, salesCount: v?.salesCount ?? 0,
      closing: opening == null ? null : Math.round(opening + salesSum - intakeSum - exp - adv),
    });
  }
  return days;
}

export type JournalKind = 'intake' | 'press' | 'expense' | 'sales' | 'cash';
export const journalKindLabels: Record<JournalKind, string> = { intake: 'Qabul', press: 'Press', expense: 'Xarajat / avans', sales: 'Sotuv', cash: 'Kassa ochilishi' };

/** Bir kun yozuvlari (admin tahriri va bot ko'rinishi uchun) */
export async function dayEntries(scope: Scope, date: Date) {
  const where = { ...scopeWhere(scope), date: dayRange(date) };
  const [intake, press, expense, sales, cash] = await Promise.all([
    prisma.recycleManualIntake.findMany({ where, orderBy: { id: 'asc' }, include: { supervisor: { select: { name: true } } } }),
    prisma.recyclePressLog.findMany({ where, orderBy: { id: 'asc' }, include: { supervisor: { select: { name: true } } } }),
    prisma.recycleExpenseLog.findMany({ where, orderBy: { id: 'asc' }, include: { supervisor: { select: { name: true } } } }),
    prisma.recycleSalesLog.findMany({ where, orderBy: { id: 'asc' }, include: { supervisor: { select: { name: true } } } }),
    prisma.recycleDailyCash.findMany({ where, orderBy: { id: 'asc' }, include: { supervisor: { select: { name: true } } } }),
  ]);
  return { intake, press, expense, sales, cash };
}

export const decimal = (v: Prisma.Decimal | number | null | undefined) => toNumber(v as number);
