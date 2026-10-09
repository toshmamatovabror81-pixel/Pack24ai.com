import { requireStaff } from '@/lib/auth';
import { driverLeaderboard, financeOverview } from '@/lib/recycling/finance';
import { resolvePeriod } from '../period';

export const dynamic = 'force-dynamic';

/** Moliya ko'rinishi CSV (Excel uchun BOM + ';' ajratgich) */
export async function GET(req: Request) {
  await requireStaff('recycling');
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = resolvePeriod(sp);
  const period = { from: p.from, to: p.to, pointId: p.pointId };
  const [o, leaders] = await Promise.all([financeOverview(period), driverLeaderboard(period, 50)]);
  const rows: (string | number)[][] = [
    ['Davr', `${p.fromStr} — ${p.toStr}`],
    ['Punkt', p.pointId ? (o.byPoint[0]?.name ?? String(p.pointId)) : 'Barchasi'],
    [],
    ['Arizalar', 'Jami', o.requests.total], ['Arizalar', 'Yakunlangan', o.requests.completed], ['Arizalar', 'Bekor', o.requests.cancelled], ['Arizalar', 'Jarayonda', o.requests.active],
    ["Yig'ilgan", 'Soni', o.collections.count], ["Yig'ilgan", 'Kg', o.collections.kg], ["Yig'ilgan", 'Effektiv kg', o.collections.effectiveKg], ["Yig'ilgan", "Jami so'm", o.collections.amount],
    ["Yig'ilgan", "Mijozga to'langan", o.collections.paidToCustomer], ["Yig'ilgan", "Haydovchiga to'langan", o.collections.paidToDriver],
    ['Haydovchilar', 'Daromad', o.drivers.earned], ['Haydovchilar', 'Yechilgan', o.drivers.withdrawn], ['Haydovchilar', "Kutilayotgan so'rovlar", o.drivers.pendingWithdrawals], ['Haydovchilar', 'Bonus', o.drivers.bonus],
    ['Jurnal', 'Qabul kg', o.journal.intakeKg], ['Jurnal', "Qabul so'm", o.journal.intakeSum], ['Jurnal', 'Press kg', o.journal.pressedKg], ['Jurnal', 'Toylar', o.journal.bales],
    ['Jurnal', 'Xarajat', o.journal.expense], ['Jurnal', 'Avans', o.journal.advance], ['Jurnal', 'Sotuv kg', o.journal.salesKg], ['Jurnal', "Sotuv so'm", o.journal.salesSum],
    [],
    ['Punkt', 'Arizalar', 'Kg', "So'm"],
    ...o.byPoint.map((b) => [b.name, b.requests, b.kg, b.amount]),
    [],
    ['Haydovchi', 'Telefon', 'Punkt', 'Safarlar', 'Kg', "So'm"],
    ...leaders.map((l) => [l.driver?.name ?? '—', l.driver?.phone ?? '', l.driver?.point?.cityUz ?? '', l.trips, l.kg, l.amount]),
  ];
  const cell = (v: string | number) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  return new Response(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="moliya-${p.fromStr}-${p.toStr}.csv"` },
  });
}
