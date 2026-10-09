import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDriver } from '@/lib/auth/driver';
import { driverHistory } from '@/lib/recycling/driverTasks';
import { statusLabels, statusTone } from '@/lib/recycling/statuses';
import { formatDate, formatPrice, toNumber } from '@/lib/format';
import { Badge } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tarix' };

const sum = (v: unknown) => formatPrice(v as number, "so'm");

export default async function DriverHistoryPage() {
  const d = await requireDriver();
  const tasks = await driverHistory(d.id, 50);
  const ids = tasks.map((t) => t.id);
  const collections = ids.length ? await prisma.recycleCollection.findMany({ where: { requestId: { in: ids } }, orderBy: { id: 'desc' } }) : [];
  const byRequest = new Map<number, (typeof collections)[number]>();
  for (const c of collections) if (!byRequest.has(c.requestId)) byRequest.set(c.requestId, c);
  const earnings = collections.length
    ? await prisma.driverTransaction.findMany({ where: { driverId: d.id, type: 'earning', collectionId: { in: collections.map((c) => c.id) } }, select: { collectionId: true, amount: true } })
    : [];
  const earningByCollection = new Map(earnings.map((e) => [e.collectionId, toNumber(e.amount)]));
  const totalKg = collections.reduce((s, c) => s + c.actualWeight, 0);
  const totalEarn = earnings.reduce((s, e) => s + toNumber(e.amount), 0);

  return (
    <>
      <h1 className="mb-3 text-lg font-bold">Tarix</h1>
      {tasks.length > 0 && (
        <div className="card mb-3 grid grid-cols-3 divide-x divide-slate-100 p-3 text-center text-sm">
          <div><p className="text-xs text-slate-500">Topshiriq</p><p className="font-bold">{tasks.length}</p></div>
          <div><p className="text-xs text-slate-500">Jami kg</p><p className="font-bold">{Math.round(totalKg * 10) / 10}</p></div>
          <div><p className="text-xs text-slate-500">Daromad</p><p className="font-bold text-emerald-700">{sum(totalEarn)}</p></div>
        </div>
      )}
      {tasks.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">Hali yakunlangan topshiriq yo'q</div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const c = byRequest.get(t.id);
            const earn = c ? earningByCollection.get(c.id) : undefined;
            return (
              <li key={t.id}>
                <Link href={`/driver/tasks/${t.id}`} className="card block space-y-1.5 p-3 text-sm">
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-bold text-brand-500">#{t.id} · {t.name}</span>
                    <Badge tone={statusTone[t.status]}>{statusLabels.uz[t.status]}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(c?.collectedAt ?? t.collectedAt ?? t.updatedAt, 'uz', true)}</p>
                  {c ? (
                    <p className="flex flex-wrap justify-between gap-x-3 text-slate-700">
                      <span>⚖️ {c.actualWeight} kg{c.discountPercent > 0 ? ` (−${c.discountPercent}%)` : ''}</span>
                      <span>💰 {sum(c.totalAmount)}</span>
                      <span className="font-semibold text-emerald-700">+{sum(earn ?? 0)}</span>
                    </p>
                  ) : (
                    <p className="text-slate-500">Tortish kiritilmagan</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
