/**
 * Money helpers — Prisma Decimal ↔ number boundary.
 *
 * DB: Decimal(18,2) | API/client: number (backward-compatible JSON)
 */
import { Prisma } from '@prisma/client';

export type MoneyInput = number | string | Prisma.Decimal | null | undefined;

const MONEY_FIELDS = new Set([
    'price',
    'originalPrice',
    'totalAmount',
    'pricePerKg',
    'driverRatePerKg',
    'amount',
    'paymentToDriver',
    'paymentToCustomer',
    'expenseAmount',
    'advanceAmount',
    'openingBalance',
    'creditLimit',
    'subtotal',
    'vatAmount',
    'paidAmount',
]);

export function toDecimal(v: MoneyInput): Prisma.Decimal {
    if (v == null) return new Prisma.Decimal(0);
    if (v instanceof Prisma.Decimal) return v;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!Number.isFinite(n)) return new Prisma.Decimal(0);
    return new Prisma.Decimal(n);
}

export function toNumber(v: MoneyInput): number {
    if (v == null) return 0;
    if (v instanceof Prisma.Decimal) return v.toNumber();
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
}

export function mul(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
    return toDecimal(a).mul(toDecimal(b));
}

export function add(...vals: MoneyInput[]): Prisma.Decimal {
    return vals.reduce<Prisma.Decimal>(
        (sum, v) => sum.add(toDecimal(v)),
        new Prisma.Decimal(0),
    );
}

/** O'zbek so'm — butun songa yaxlitlash */
export function roundUZS(v: MoneyInput): Prisma.Decimal {
    return new Prisma.Decimal(Math.round(toNumber(v)));
}

/** Telegram/UI formatlash */
export function fmtMoneyUZS(v: MoneyInput): string {
    return toNumber(v).toLocaleString('uz-UZ');
}

/** Prisma natijalarini JSON-safe qilish (Decimal → number) */
export function serializeMoney<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Prisma.Decimal) {
        return obj.toNumber() as T;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => serializeMoney(item)) as T;
    }
    if (typeof obj !== 'object') return obj;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (MONEY_FIELDS.has(key) && value instanceof Prisma.Decimal) {
            result[key] = value.toNumber();
        } else if (value !== null && typeof value === 'object') {
            result[key] = serializeMoney(value);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}
