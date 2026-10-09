import { str } from '@/lib/params';

/** Jurnal sahifalari uchun umumiy yordamchilar (server va action'larda ishlaydi, prisma yo'q) */

export type JournalScope = { supervisorId: number } | { pointId: number };

const posInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** ?supervisorId=.. | ?pointId=.. | ?scope=s:ID|p:ID → masul yoki punkt ko'rinishi */
export function parseScope(sp: Record<string, string | string[] | undefined>): JournalScope | null {
  const sid = posInt(str(sp.supervisorId));
  if (sid) return { supervisorId: sid };
  const pid = posInt(str(sp.pointId));
  if (pid) return { pointId: pid };
  const m = /^([ps]):(\d{1,9})$/.exec(str(sp.scope) ?? '');
  if (m) return m[1] === 's' ? { supervisorId: Number(m[2]) } : { pointId: Number(m[2]) };
  return null;
}

export const scopeParams = (s: JournalScope): Record<string, string> => ('supervisorId' in s ? { supervisorId: String(s.supervisorId) } : { pointId: String(s.pointId) });
export const scopeValue = (s: JournalScope) => ('supervisorId' in s ? `s:${s.supervisorId}` : `p:${s.pointId}`);

export const dayUrl = (s: JournalScope, date: string, extra: Record<string, string> = {}) => `/admin/recycling/journal/day?${new URLSearchParams({ date, ...scopeParams(s), ...extra })}`;
export const monthUrl = (s: JournalScope, month: string) => `/admin/recycling/journal?${new URLSearchParams({ month, ...scopeParams(s) })}`;

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
/** So'm (valyutasiz, jadval uchun qisqa) */
export const money = (v: number | null | undefined) => (v == null ? '—' : nf0.format(Math.round(v)));
/** Kg, 1 kasr */
export const kg = (v: number | null | undefined) => (v == null ? '—' : nf1.format(Math.round(v * 10) / 10));

export const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

/** 'YYYY-MM' → {year, month}; noto'g'ri bo'lsa null */
export function parseMonth(v: string | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(v ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/* ---- Toshkent kuni oralig'i (vaqt belgili qatorlar uchun) ----
 * Jurnal konvensiyasi: date = UTC yarim tun (kanonik). Lekin ba'zi joylar (acceptAtBase, collections.ts) `date` ga vaqt belgisi yozadi.
 * Poydevor dailySummary/dayEntries/monthGrid aniq tenglik bilan ishlaydi va bu qatorlarni ko'rmaydi — shuning uchun admin sahifalari
 * kun oralig'i [kun − 5 soat, kun + 19 soat) bilan ishlaydi: kanonik qator ham, shu Toshkent kuniga tushgan vaqt belgili qator ham kiradi. */
const TZ_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;

/** UTC yarim tun kun → prisma `date` sharti (Toshkent kuni oralig'i) */
export const dayRange = (day: Date) => ({ gte: new Date(day.getTime() - TZ_MS), lt: new Date(day.getTime() + DAY_MS - TZ_MS) });
/** Oy oralig'i (Toshkent kunlari bo'yicha) */
export const monthRange = (year: number, month: number) => ({ gte: new Date(Date.UTC(year, month - 1, 1) - TZ_MS), lt: new Date(Date.UTC(year, month, 1) - TZ_MS) });
/** Qator sanasi → Toshkent kuni kaliti 'YYYY-MM-DD' (kanonik sana o'zgarmaydi) */
export const tashkentKey = (d: Date) => new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);
/** Sana vaqt belgili (kanonik UTC yarim tun emas) — saqlanganda kunga tekislanadi */
export const hasTime = (d: Date) => d.getTime() % DAY_MS !== 0;

type Dec = { toString(): string } | number | string | null | undefined;
const n = (v: Dec) => (v == null ? 0 : typeof v === 'number' ? v : Number(v.toString()) || 0);

export type JournalRows = {
  intake: { weightKg: number; totalAmount: Dec }[];
  press: { pressedKg: number; baleCount: number }[];
  expense: { expenseAmount: Dec; advanceAmount: Dec }[];
  sales: { weightKg: number; totalAmount: Dec }[];
  cash: { supervisorId: number; openingBalance: Dec }[];
};

export type DayTotals = {
  date: Date;
  opening: number | null; openingCount: number;
  intakeKg: number; intakeSum: number; intakeCount: number;
  pressedKg: number; bales: number;
  expense: number; advance: number;
  salesKg: number; salesSum: number; salesCount: number;
  closing: number | null;
};

/** Kun yozuvlaridan yig'indi. Ochilish — har masul uchun bitta (id bo'yicha birinchisi), punktda masullar yig'indisi. Yakun = ochilish + sotuv − qabul − xarajat − avans */
export function summarize(date: Date, r: JournalRows): DayTotals {
  const seen = new Set<number>();
  let opening: number | null = null;
  for (const c of r.cash) {
    if (seen.has(c.supervisorId)) continue;
    seen.add(c.supervisorId);
    opening = (opening ?? 0) + n(c.openingBalance);
  }
  const intakeSum = r.intake.reduce((s, x) => s + n(x.totalAmount), 0);
  const expense = r.expense.reduce((s, x) => s + n(x.expenseAmount), 0);
  const advance = r.expense.reduce((s, x) => s + n(x.advanceAmount), 0);
  const salesSum = r.sales.reduce((s, x) => s + n(x.totalAmount), 0);
  return {
    date, opening, openingCount: seen.size,
    intakeKg: r.intake.reduce((s, x) => s + x.weightKg, 0), intakeSum, intakeCount: r.intake.length,
    pressedKg: r.press.reduce((s, x) => s + x.pressedKg, 0), bales: r.press.reduce((s, x) => s + x.baleCount, 0),
    expense, advance,
    salesKg: r.sales.reduce((s, x) => s + x.weightKg, 0), salesSum, salesCount: r.sales.length,
    closing: opening == null ? null : Math.round(opening + salesSum - intakeSum - expense - advance),
  };
}
