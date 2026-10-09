import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, normalizePhone } from '@/lib/format';
import { str } from '@/lib/params';
import { ACTIVE_STATUSES, isRequestStatus, materialLabels, REQUEST_STATUSES, statusLabels } from '@/lib/recycling/statuses';
import { PageHeader, Pager, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { RequestStatusBadge, StatCard } from '@/components/admin/recycling/badges';
import { dayEnd, parseDayStart, tashkentDayStart } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Makulatura arizalari' };
export const dynamic = 'force-dynamic';
const PER_PAGE = 20;

export default async function RecyclingRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const statusRaw = str(sp.status);
  const status = isRequestStatus(statusRaw) ? statusRaw : undefined;
  const pointId = Number(str(sp.point)) || undefined;
  const q = str(sp.q)?.trim();
  const fromRaw = str(sp.from);
  const toRaw = str(sp.to);
  const from = parseDayStart(fromRaw);
  const to = parseDayStart(toRaw);
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const where: Prisma.RecycleRequestWhereInput = {};
  if (status) where.status = status;
  if (pointId) where.pointId = pointId;
  if (q) {
    const digits = q.replace(/\D/g, '');
    const idNum = /^#?\d+$/.test(q) && Number(digits) < 2 ** 31 ? Number(digits) : null;
    // "#12" — faqat raqam bo'yicha; aks holda raqam, ism yoki telefon
    where.OR = q.startsWith('#') && idNum ? [{ id: idNum }] : [
      ...(idNum ? [{ id: idNum }] : []),
      { name: { contains: q, mode: 'insensitive' } },
      ...(digits.length >= 3 ? [{ phone: { contains: normalizePhone(q) ?? digits } }] : []),
    ];
  }
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: dayEnd(to) } : {}) };

  const todayStart = tashkentDayStart();
  const [requests, total, points, newCount, activeCount, doneToday, weighedToday] = await Promise.all([
    prisma.recycleRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { point: true, supervisor: true, assignedDriver: true } }),
    prisma.recycleRequest.count({ where }),
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true } }),
    prisma.recycleRequest.count({ where: { status: 'new_' } }),
    prisma.recycleRequest.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.recycleRequest.count({ where: { status: 'completed', completedAt: { gte: todayStart } } }),
    prisma.recycleCollection.aggregate({ where: { collectedAt: { gte: todayStart } }, _sum: { actualWeight: true } }),
  ]);

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, point: pointId, q, from: fromRaw, to: toRaw, ...extra })) if (v) p.set(k, String(v));
    return `/admin/recycling?${p}`;
  };
  const filtered = !!(status || pointId || q || from || to);

  return (
    <>
      <PageHeader title="Makulatura" action={{ href: '/admin/recycling/requests/new', label: '➕ Yangi ariza' }} />
      <RecyclingNav badges={{ '/admin/recycling': newCount }} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Yangi arizalar" value={newCount} tone={newCount ? 'red' : 'slate'} hint="masulga yo'naltirilmagan" />
        <StatCard label="Jarayonda" value={activeCount} tone="blue" hint="yangi → yig'ilmoqda" />
        <StatCard label="Bugun yakunlandi" value={doneToday} tone="green" />
        <StatCard label="Bugun tortildi" value={`${Math.round((weighedToday._sum.actualWeight ?? 0) * 10) / 10} kg`} tone="amber" />
      </div>
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="#ID, ism yoki telefon" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusLabels.uz[s]}</option>)}
        </select>
        <select name="point" defaultValue={pointId ?? ''} className="input w-auto">
          <option value="">Barcha punktlar</option>
          {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz}</option>)}
        </select>
        <label className="text-xs text-slate-500">Dan<input type="date" name="from" defaultValue={fromRaw} className="input w-auto py-2" /></label>
        <label className="text-xs text-slate-500">Gacha<input type="date" name="to" defaultValue={toRaw} className="input w-auto py-2" /></label>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
        {filtered && <Link href="/admin/recycling" className="btn-ghost px-3 py-2 text-sm">Tozalash</Link>}
        <span className="ml-auto text-sm text-slate-500">Jami: <b>{total}</b></span>
      </form>
      <Table head={['#', 'Sana', 'Mijoz', 'Punkt', 'Material / kg', 'Turi', 'Masul', 'Haydovchi', 'Holat', '']} empty={!requests.length}>
        {requests.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><Link href={`/admin/recycling/requests/${r.id}`} className="font-semibold text-brand-500">#{r.id}</Link></td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(r.createdAt, 'uz', true)}</td>
            <td className="px-4 py-3">{r.name}<br /><a href={`tel:+${r.phone}`} className="text-xs text-brand-500">{displayPhone(r.phone)}</a></td>
            <td className="px-4 py-3">{r.point.cityUz}</td>
            <td className="px-4 py-3">{r.material ? materialLabels.uz[r.material] : '—'}{r.volume != null && <span className="text-slate-500"> · ~{r.volume} kg</span>}</td>
            <td className="px-4 py-3">{r.pickupType === 'pickup' ? '🚚 Olib ketish' : '🏭 Bazaga'}</td>
            <td className="px-4 py-3">{r.supervisor ? <Link href={`/admin/recycling/supervisors/${r.supervisor.id}`} className="hover:underline">{r.supervisor.name}</Link> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3">{r.assignedDriver ? <Link href={`/admin/recycling/drivers/${r.assignedDriver.id}`} className="hover:underline">{r.assignedDriver.name}</Link> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
            <td className="px-4 py-3"><Link href={`/admin/recycling/requests/${r.id}`} className="btn-ghost px-3 py-1 text-xs">Ochish</Link></td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => qs({ page: n })} />
    </>
  );
}
