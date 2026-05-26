import type { MoneyInput } from '@/lib/money';
import { toNumber } from '@/lib/money';

export function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildReportsDateRange(
    periodParam: string | null,
    fromParam: string | null,
    toParam: string | null,
    now = new Date()
) {
    const requestedDays = parseInt(periodParam ?? '30', 10);
    const usingCustomRange = Boolean(fromParam && toParam);

    const from = fromParam ? new Date(fromParam) : new Date(now);
    if (!fromParam) from.setDate(from.getDate() - requestedDays);
    if (Number.isNaN(from.getTime())) {
        throw new Error('INVALID_FROM');
    }
    from.setHours(0, 0, 0, 0);

    const toExclusive = toParam ? new Date(toParam) : new Date(now);
    if (Number.isNaN(toExclusive.getTime())) {
        throw new Error('INVALID_TO');
    }
    toExclusive.setHours(0, 0, 0, 0);
    toExclusive.setDate(toExclusive.getDate() + 1);

    if (toExclusive <= from) {
        throw new Error('INVALID_RANGE');
    }

    const days = usingCustomRange
        ? Math.max(1, Math.ceil((toExclusive.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
        : requestedDays;

    const prevTo = new Date(from);
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - days);

    return {
        from,
        toExclusive,
        days,
        prevFrom,
        prevTo,
        usingCustomRange,
    };
}

type OrderLike = {
    totalAmount: MoneyInput | null;
    status: string;
    contactPhone?: string | null;
};

export function calculateOrderSummaries(
    periodOrders: OrderLike[],
    prevPeriodOrders: OrderLike[],
    repeatCount: number
) {
    const currentCount = periodOrders.length;
    const currentRevenue = periodOrders.reduce((sum, order) => sum + toNumber(order.totalAmount), 0);
    const currentCompleted = periodOrders.filter((order) => order.status === 'delivered').length;
    const currentCancelled = periodOrders.filter((order) => order.status === 'cancelled').length;
    const currentConversion = currentCount > 0
        ? Math.round((currentCompleted / currentCount) * 100)
        : 0;

    const previousCount = prevPeriodOrders.length;
    const previousRevenue = prevPeriodOrders.reduce((sum, order) => sum + toNumber(order.totalAmount), 0);
    const previousCompleted = prevPeriodOrders.filter((order) => order.status === 'delivered').length;
    const previousConversion = previousCount > 0
        ? Math.round((previousCompleted / previousCount) * 100)
        : 0;

    const uniquePhones = new Set(
        periodOrders
            .map((order) => order.contactPhone)
            .filter((value): value is string => Boolean(value))
    ).size;

    return {
        current: {
            count: currentCount,
            revenue: currentRevenue,
            completed: currentCompleted,
            cancelled: currentCancelled,
            conversion: currentConversion,
            aov: currentCount > 0 ? Math.round(currentRevenue / currentCount) : 0,
            cancelRate: currentCount > 0 ? Math.round((currentCancelled / currentCount) * 100) : 0,
            repeatRate: uniquePhones > 0 ? Math.round((repeatCount / uniquePhones) * 100) : 0,
        },
        previous: {
            count: previousCount,
            revenue: previousRevenue,
            completed: previousCompleted,
            conversion: previousConversion,
        },
        trends: {
            ordersGrowth: pctChange(currentCount, previousCount),
            revenueGrowth: pctChange(currentRevenue, previousRevenue),
            conversionChange: pctChange(currentConversion, previousConversion),
        },
    };
}
