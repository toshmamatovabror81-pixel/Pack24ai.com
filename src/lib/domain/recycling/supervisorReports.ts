import { prisma } from '@/lib/prisma';

export type ReportPeriod = 'today' | 'week' | 'month';

export interface SupervisorReportData {
    totalRequests: number;
    completedRequests: number;
    collectionWeight: number;
    collectionAmount: number;
    activeDrivers: number;
    intakeWeight: number;
    intakeAmount: number;
    pressedKg: number;
    baleCount: number;
    expenseAmount: number;
    advanceAmount: number;
    soldWeight: number;
    soldAmount: number;
    soldBaleCount: number;
}

/**
 * Compute the start-of-range date for a given report period.
 */
export function computeReportFromDate(period: ReportPeriod, now = new Date()): Date {
    const from = new Date(now);
    switch (period) {
        case 'today':
            from.setHours(0, 0, 0, 0);
            break;
        case 'week':
            from.setDate(from.getDate() - 7);
            break;
        case 'month':
            from.setMonth(from.getMonth() - 1);
            break;
    }
    return from;
}

/**
 * Generate a supervisor report for a given period.
 *
 * Runs all Prisma queries and aggregation, returning a plain data object.
 * Does NOT format text or interact with Telegram.
 */
export async function generateSupervisorReport(
    supervisorId: number,
    pointId: number | null,
    period: ReportPeriod,
    now = new Date(),
): Promise<SupervisorReportData> {
    const from = computeReportFromDate(period, now);

    const pointFilter = pointId ? { regionId: pointId } : {};

    const [
        totalRequests,
        completedRequests,
        collections,
        intakeLogs,
        pressLogs,
        expenseLogs,
        salesLogs,
        activeDrivers,
    ] = await Promise.all([
        prisma.recycleRequest.count({
            where: { ...pointFilter, createdAt: { gte: from } },
        }),
        prisma.recycleRequest.count({
            where: { ...pointFilter, status: 'completed', completedAt: { gte: from } },
        }),
        prisma.recycleCollection.findMany({
            where: { createdAt: { gte: from } },
        }),
        prisma.recycleManualIntake.findMany({
            where: { supervisorId, date: { gte: from } },
        }),
        prisma.recyclePressLog.findMany({
            where: { supervisorId, date: { gte: from } },
        }),
        prisma.recycleExpenseLog.findMany({
            where: { supervisorId, date: { gte: from } },
        }),
        prisma.recycleSalesLog.findMany({
            where: { supervisorId, date: { gte: from } },
        }),
        prisma.driver.count({
            where: {
                isOnline: true,
                ...(pointId ? { pointId } : {}),
            },
        }),
    ]);

    return {
        totalRequests,
        completedRequests,
        collectionWeight: collections.reduce((sum, row) => sum + row.actualWeight, 0),
        collectionAmount: collections.reduce((sum, row) => sum + row.totalAmount, 0),
        activeDrivers,
        intakeWeight: intakeLogs.reduce((sum, row) => sum + row.weightKg, 0),
        intakeAmount: intakeLogs.reduce((sum, row) => sum + row.totalAmount, 0),
        pressedKg: pressLogs.reduce((sum, row) => sum + row.pressedKg, 0),
        baleCount: pressLogs.reduce((sum, row) => sum + row.baleCount, 0),
        expenseAmount: expenseLogs.reduce((sum, row) => sum + row.expenseAmount, 0),
        advanceAmount: expenseLogs.reduce((sum, row) => sum + row.advanceAmount, 0),
        soldWeight: salesLogs.reduce((sum, row) => sum + row.weightKg, 0),
        soldAmount: salesLogs.reduce((sum, row) => sum + row.totalAmount, 0),
        soldBaleCount: salesLogs.reduce((sum, row) => sum + row.baleCount, 0),
    };
}
