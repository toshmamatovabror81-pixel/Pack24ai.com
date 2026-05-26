import type { MoneyInput } from '@/lib/money';
import { toNumber } from '@/lib/money';

export interface DailyJournalSummaryInput {
    openingBalance?: MoneyInput | null;
    intakes: Array<{ weightKg: number; totalAmount: MoneyInput }>;
    presses: Array<{ pressedKg: number; baleCount: number }>;
    expenses: Array<{ expenseAmount: MoneyInput; advanceAmount: MoneyInput }>;
    salesRows: Array<{ weightKg: number; baleCount: number; totalAmount: MoneyInput }>;
}

export interface DailyJournalSummary {
    intakeCount: number;
    intakeWeight: number;
    intakeAmount: number;
    pressCount: number;
    pressedKg: number;
    baleCount: number;
    expenseCount: number;
    expenseAmount: number;
    advanceAmount: number;
    salesCount: number;
    soldWeight: number;
    soldBales: number;
    soldAmount: number;
    openingBalance: number;
    closingBalance: number;
}

export type DailyIntakeRow = {
    dateLabel: string;
    weightKg: number;
    totalAmount: number;
    pricePerKg: number;
};

export type DailyPressRow = {
    dateLabel: string;
    pressedKg: number;
    baleCount: number;
    operators: string;
};

export type DailySalesRow = {
    dateLabel: string;
    customers: string;
    weightKg: number;
    baleCount: number;
    pricePerKg: number;
    totalAmount: number;
    vehicles: string;
    plateNumbers: string;
};

export type DailyExpenseRow = {
    dateLabel: string;
    expenseAmount: number;
    advanceAmount: number;
    comments: string;
};

export type DailyCashRow = {
    dateLabel: string;
    openingBalance: number;
    intakeAmount: number;
    salesAmount: number;
    expenseAmount: number;
    advanceAmount: number;
    closingBalance: number;
};

export function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Kirish nuqtasi kuni (mahalliy server vaqti) — "kecha" tanlovi uchun */
export function startOfYesterday(reference: Date = new Date()): Date {
    const d = startOfDay(reference);
    d.setDate(d.getDate() - 1);
    return d;
}

export function endOfDay(date: Date): Date {
    const d = startOfDay(date);
    d.setDate(d.getDate() + 1);
    return d;
}

export function parseJournalDate(input: string): Date | null {
    const value = input.trim().toLowerCase();
    if (value === 'bugun' || value === 'today') return startOfDay(new Date());

    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(value)) {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const local = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
    const match = value.match(local);
    if (!match) return null;

    const [, dd, mm, yyyy] = match;
    const date = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function humanJournalDate(date: Date): string {
    return date.toLocaleDateString('ru-RU');
}

export function calculateDailyJournalSummary(input: DailyJournalSummaryInput): DailyJournalSummary {
    const intakeWeight = input.intakes.reduce((sum, row) => sum + row.weightKg, 0);
    const intakeAmount = input.intakes.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
    const pressedKg = input.presses.reduce((sum, row) => sum + row.pressedKg, 0);
    const baleCount = input.presses.reduce((sum, row) => sum + row.baleCount, 0);
    const expenseAmount = input.expenses.reduce((sum, row) => sum + toNumber(row.expenseAmount), 0);
    const advanceAmount = input.expenses.reduce((sum, row) => sum + toNumber(row.advanceAmount), 0);
    const openingBalance = toNumber(input.openingBalance);
    const soldWeight = input.salesRows.reduce((sum, row) => sum + row.weightKg, 0);
    const soldBales = input.salesRows.reduce((sum, row) => sum + row.baleCount, 0);
    const soldAmount = input.salesRows.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
    const closingBalance = openingBalance + soldAmount - intakeAmount - expenseAmount - advanceAmount;

    return {
        intakeCount: input.intakes.length,
        intakeWeight,
        intakeAmount,
        pressCount: input.presses.length,
        pressedKg,
        baleCount,
        expenseCount: input.expenses.length,
        expenseAmount,
        advanceAmount,
        salesCount: input.salesRows.length,
        soldWeight,
        soldBales,
        soldAmount,
        openingBalance,
        closingBalance,
    };
}

export function formatDailyJournalMessage(
    summary: DailyJournalSummary,
    date: Date,
    fmtNumber: (value: number) => string
): string {
    return (
        `📘 <b>Kunlik jurnal — ${humanJournalDate(date)}</b>\n\n` +
        `📥 Qabul: <b>${summary.intakeCount}</b> ta yozuv | ⚖️ <b>${fmtNumber(Math.round(summary.intakeWeight))} kg</b>\n` +
        `💵 Makulatura xaridi: <b>${fmtNumber(Math.round(summary.intakeAmount))} so'm</b>\n\n` +
        `🏭 Press: <b>${summary.pressCount}</b> ta yozuv | ⚖️ <b>${fmtNumber(Math.round(summary.pressedKg))} kg</b>\n` +
        `📦 Toylar soni: <b>${fmtNumber(summary.baleCount)}</b>\n\n` +
        `🚛 Sotuv: <b>${summary.salesCount}</b> ta yozuv | ⚖️ <b>${fmtNumber(Math.round(summary.soldWeight))} kg</b>\n` +
        `💰 Sotuv summasi: <b>${fmtNumber(Math.round(summary.soldAmount))} so'm</b>\n\n` +
        `💸 Xarajatlar: <b>${fmtNumber(Math.round(summary.expenseAmount))} so'm</b>\n` +
        `💼 Avans: <b>${fmtNumber(Math.round(summary.advanceAmount))} so'm</b>\n\n` +
        `🏦 Kassa boshlandi: <b>${fmtNumber(Math.round(summary.openingBalance))} so'm</b>\n` +
        `🧾 Qoldiq: <b>${fmtNumber(Math.round(summary.closingBalance))} so'm</b>\n\n` +
        `<i>Formula: kassa + sotuv - makulatura xaridi - xarajat - avans</i>`
    );
}

export function monthRange(monthParam?: string | null, now = new Date()) {
    const rawMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const from = new Date(`${rawMonth}-01T00:00:00`);
    if (Number.isNaN(from.getTime())) {
        throw new Error('INVALID_MONTH');
    }

    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);

    const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    return { rawMonth, from, to, daysInMonth };
}

export function fmtDateLabel(date: Date) {
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function uniqueJoin(parts: string[]): string {
    return Array.from(new Set(parts.map((v) => v.trim()).filter(Boolean))).join('; ');
}

function initDayMap<T>(daysInMonth: number, factory: (date: Date) => T, month: string) {
    const map = new Map<number, T>();
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00`);
        map.set(day, factory(date));
    }
    return map;
}

export function buildMonthlyJournalView(params: {
    rawMonth: string;
    daysInMonth: number;
    intakes: Array<{ date: Date; weightKg: number; totalAmount: MoneyInput; pricePerKg?: MoneyInput }>;
    presses: Array<{ date: Date; pressedKg: number; baleCount: number; operators: string | null }>;
    sales: Array<{ date: Date; customerName: string; weightKg: number; baleCount: number; totalAmount: MoneyInput; pricePerKg?: MoneyInput; vehicleType: string | null; plateNumber: string | null }>;
    expenses: Array<{ date: Date; expenseAmount: MoneyInput; advanceAmount: MoneyInput; comment: string | null }>;
    cashLogs: Array<{ date: Date; openingBalance: MoneyInput }>;
}) {
    const intakeByDay = initDayMap<DailyIntakeRow>(params.daysInMonth, (date) => ({
        dateLabel: fmtDateLabel(date),
        weightKg: 0,
        totalAmount: 0,
        pricePerKg: 0,
    }), params.rawMonth);

    const pressByDay = initDayMap<DailyPressRow>(params.daysInMonth, (date) => ({
        dateLabel: fmtDateLabel(date),
        pressedKg: 0,
        baleCount: 0,
        operators: '',
    }), params.rawMonth);

    const salesByDay = initDayMap<DailySalesRow>(params.daysInMonth, (date) => ({
        dateLabel: fmtDateLabel(date),
        customers: '',
        weightKg: 0,
        baleCount: 0,
        pricePerKg: 0,
        totalAmount: 0,
        vehicles: '',
        plateNumbers: '',
    }), params.rawMonth);

    const expenseByDay = initDayMap<DailyExpenseRow>(params.daysInMonth, (date) => ({
        dateLabel: fmtDateLabel(date),
        expenseAmount: 0,
        advanceAmount: 0,
        comments: '',
    }), params.rawMonth);

    const cashByDay = initDayMap<DailyCashRow>(params.daysInMonth, (date) => ({
        dateLabel: fmtDateLabel(date),
        openingBalance: 0,
        intakeAmount: 0,
        salesAmount: 0,
        expenseAmount: 0,
        advanceAmount: 0,
        closingBalance: 0,
    }), params.rawMonth);

    for (const row of params.intakes) {
        const current = intakeByDay.get(row.date.getDate());
        if (!current) continue;
        current.weightKg += row.weightKg;
        current.totalAmount += toNumber(row.totalAmount);
        current.pricePerKg = current.weightKg > 0 ? current.totalAmount / current.weightKg : 0;
    }

    for (const row of params.presses) {
        const current = pressByDay.get(row.date.getDate());
        if (!current) continue;
        current.pressedKg += row.pressedKg;
        current.baleCount += row.baleCount;
        current.operators = uniqueJoin([
            ...current.operators.split(';'),
            ...(row.operators ? row.operators.split(/[+,;]+/) : []),
        ]);
    }

    for (const row of params.sales) {
        const current = salesByDay.get(row.date.getDate());
        if (!current) continue;
        current.weightKg += row.weightKg;
        current.baleCount += row.baleCount;
        current.totalAmount += toNumber(row.totalAmount);
        current.pricePerKg = current.weightKg > 0 ? current.totalAmount / current.weightKg : 0;
        current.customers = uniqueJoin([...current.customers.split(';'), row.customerName]);
        current.vehicles = uniqueJoin([
            ...current.vehicles.split(';'),
            ...(row.vehicleType ? [row.vehicleType] : []),
        ]);
        current.plateNumbers = uniqueJoin([
            ...current.plateNumbers.split(';'),
            ...(row.plateNumber ? [row.plateNumber] : []),
        ]);
    }

    for (const row of params.expenses) {
        const current = expenseByDay.get(row.date.getDate());
        if (!current) continue;
        current.expenseAmount += toNumber(row.expenseAmount);
        current.advanceAmount += toNumber(row.advanceAmount);
        current.comments = uniqueJoin([
            ...current.comments.split(';'),
            ...(row.comment ? [row.comment] : []),
        ]);
    }

    for (const row of params.cashLogs) {
        const current = cashByDay.get(row.date.getDate());
        if (!current) continue;
        current.openingBalance = toNumber(row.openingBalance);
    }

    for (let day = 1; day <= params.daysInMonth; day += 1) {
        const cash = cashByDay.get(day);
        const intake = intakeByDay.get(day);
        const sale = salesByDay.get(day);
        const expense = expenseByDay.get(day);
        if (!cash || !intake || !sale || !expense) continue;

        cash.intakeAmount = intake.totalAmount;
        cash.salesAmount = sale.totalAmount;
        cash.expenseAmount = expense.expenseAmount;
        cash.advanceAmount = expense.advanceAmount;
        cash.closingBalance = cash.openingBalance + cash.salesAmount - cash.intakeAmount - cash.expenseAmount - cash.advanceAmount;
    }

    return {
        intakeRows: Array.from(intakeByDay.entries()).map(([day, value]) => ({ day, ...value })),
        pressRows: Array.from(pressByDay.entries()).map(([day, value]) => ({ day, ...value })),
        salesRows: Array.from(salesByDay.entries()).map(([day, value]) => ({ day, ...value })),
        expenseRows: Array.from(expenseByDay.entries()).map(([day, value]) => ({ day, ...value })),
        cashRows: Array.from(cashByDay.entries()).map(([day, value]) => ({ day, ...value })),
        totals: {
            intakeWeightKg: params.intakes.reduce((sum, row) => sum + row.weightKg, 0),
            intakeAmount: params.intakes.reduce((sum, row) => sum + toNumber(row.totalAmount), 0),
            pressedKg: params.presses.reduce((sum, row) => sum + row.pressedKg, 0),
            pressBales: params.presses.reduce((sum, row) => sum + row.baleCount, 0),
            salesWeightKg: params.sales.reduce((sum, row) => sum + row.weightKg, 0),
            salesBales: params.sales.reduce((sum, row) => sum + row.baleCount, 0),
            salesAmount: params.sales.reduce((sum, row) => sum + toNumber(row.totalAmount), 0),
            expenseAmount: params.expenses.reduce((sum, row) => sum + toNumber(row.expenseAmount), 0),
            advanceAmount: params.expenses.reduce((sum, row) => sum + toNumber(row.advanceAmount), 0),
        },
    };
}
