import 'server-only';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';

/** Moliya ko'rinishi (admin): davr bo'yicha yig'ilgan makulatura, to'lovlar, haydovchi daromadi, jurnal yig'indilari. */

export type Period = { from: Date; to: Date; pointId?: number | null };

export type FinanceOverview = {
  requests: { total: number; completed: number; cancelled: number; active: number };
  collections: { count: number; kg: number; effectiveKg: number; amount: number; paidToCustomer: number; paidToDriver: number };
  drivers: { earned: number; withdrawn: number; pendingWithdrawals: number; bonus: number };
  journal: { intakeKg: number; intakeSum: number; pressedKg: number; bales: number; expense: number; advance: number; salesKg: number; salesSum: number };
  byPoint: { pointId: number; name: string; requests: number; kg: number; amount: number }[];
};

export async function financeOverview(p: Period): Promise<FinanceOverview> {
  const range = { gte: p.from, lt: p.to };
  const pointFilter = p.pointId ? { pointId: p.pointId } : {};
  const reqWhere = { createdAt: range, ...pointFilter };
  const colWhere = { createdAt: range, ...(p.pointId ? { request: { pointId: p.pointId } } : {}) };
  const [total, completed, cancelled, active, col, paidC, paidD, earned, withdrawn, pending, bonus, intake, press, expense, sales, points, perPoint] = await Promise.all([
    prisma.recycleRequest.count({ where: reqWhere }),
    prisma.recycleRequest.count({ where: { ...reqWhere, status: 'completed' } }),
    prisma.recycleRequest.count({ where: { ...reqWhere, status: 'cancelled' } }),
    prisma.recycleRequest.count({ where: { ...reqWhere, status: { notIn: ['completed', 'cancelled'] } } }),
    prisma.recycleCollection.aggregate({ where: colWhere, _count: true, _sum: { actualWeight: true, effectiveWeight: true, totalAmount: true } }),
    prisma.recycleCollection.aggregate({ where: colWhere, _sum: { paymentToCustomer: true } }),
    prisma.recycleCollection.aggregate({ where: colWhere, _sum: { paymentToDriver: true } }),
    prisma.driverTransaction.aggregate({ where: { createdAt: range, type: 'earning', status: 'completed', ...(p.pointId ? { driver: { pointId: p.pointId } } : {}) }, _sum: { amount: true } }),
    prisma.driverTransaction.aggregate({ where: { createdAt: range, type: 'withdrawal', status: 'completed', ...(p.pointId ? { driver: { pointId: p.pointId } } : {}) }, _sum: { amount: true } }),
    prisma.driverTransaction.aggregate({ where: { type: 'withdrawal', status: 'pending', ...(p.pointId ? { driver: { pointId: p.pointId } } : {}) }, _sum: { amount: true } }),
    prisma.driverTransaction.aggregate({ where: { createdAt: range, type: 'bonus', status: 'completed', ...(p.pointId ? { driver: { pointId: p.pointId } } : {}) }, _sum: { amount: true } }),
    prisma.recycleManualIntake.aggregate({ where: { date: range, ...pointFilter }, _sum: { weightKg: true, totalAmount: true } }),
    prisma.recyclePressLog.aggregate({ where: { date: range, ...pointFilter }, _sum: { pressedKg: true, baleCount: true } }),
    prisma.recycleExpenseLog.aggregate({ where: { date: range, ...pointFilter }, _sum: { expenseAmount: true, advanceAmount: true } }),
    prisma.recycleSalesLog.aggregate({ where: { date: range, ...pointFilter }, _sum: { weightKg: true, totalAmount: true } }),
    prisma.recyclePoint.findMany({ select: { id: true, cityUz: true, regionUz: true }, orderBy: { id: 'asc' } }),
    prisma.recycleRequest.groupBy({ by: ['pointId'], where: reqWhere, _count: true }),
  ]);
  const colByPoint = await prisma.recycleCollection.findMany({ where: colWhere, select: { actualWeight: true, totalAmount: true, request: { select: { pointId: true } } } });
  const agg = new Map<number, { kg: number; amount: number }>();
  for (const c of colByPoint) {
    const a = agg.get(c.request.pointId) ?? { kg: 0, amount: 0 };
    a.kg += c.actualWeight;
    a.amount += toNumber(c.totalAmount);
    agg.set(c.request.pointId, a);
  }
  const reqByPoint = new Map(perPoint.map((r) => [r.pointId, r._count]));
  return {
    requests: { total, completed, cancelled, active },
    collections: { count: col._count, kg: col._sum.actualWeight ?? 0, effectiveKg: col._sum.effectiveWeight ?? 0, amount: toNumber(col._sum.totalAmount), paidToCustomer: toNumber(paidC._sum.paymentToCustomer), paidToDriver: toNumber(paidD._sum.paymentToDriver) },
    drivers: { earned: toNumber(earned._sum.amount), withdrawn: toNumber(withdrawn._sum.amount), pendingWithdrawals: toNumber(pending._sum.amount), bonus: toNumber(bonus._sum.amount) },
    journal: { intakeKg: intake._sum.weightKg ?? 0, intakeSum: toNumber(intake._sum.totalAmount), pressedKg: press._sum.pressedKg ?? 0, bales: press._sum.baleCount ?? 0, expense: toNumber(expense._sum.expenseAmount), advance: toNumber(expense._sum.advanceAmount), salesKg: sales._sum.weightKg ?? 0, salesSum: toNumber(sales._sum.totalAmount) },
    byPoint: points.map((pt) => ({ pointId: pt.id, name: `${pt.cityUz} (${pt.regionUz})`, requests: reqByPoint.get(pt.id) ?? 0, kg: agg.get(pt.id)?.kg ?? 0, amount: agg.get(pt.id)?.amount ?? 0 })).filter((x) => !p.pointId || x.pointId === p.pointId),
  };
}

/** Haydovchilar reytingi (davr): yig'ilgan kg va daromad */
export async function driverLeaderboard(p: Period, limit = 20) {
  const rows = await prisma.recycleCollection.groupBy({ by: ['driverId'], where: { createdAt: { gte: p.from, lt: p.to }, ...(p.pointId ? { request: { pointId: p.pointId } } : {}) }, _count: true, _sum: { actualWeight: true, totalAmount: true }, orderBy: { _sum: { actualWeight: 'desc' } }, take: limit });
  const drivers = await prisma.driver.findMany({ where: { id: { in: rows.map((r) => r.driverId) } }, select: { id: true, name: true, phone: true, point: { select: { cityUz: true } } } });
  const map = new Map(drivers.map((d) => [d.id, d]));
  return rows.map((r) => ({ driver: map.get(r.driverId) ?? null, trips: r._count, kg: r._sum.actualWeight ?? 0, amount: toNumber(r._sum.totalAmount) }));
}
