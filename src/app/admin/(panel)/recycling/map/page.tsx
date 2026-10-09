import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, toNumber } from '@/lib/format';
import { str } from '@/lib/params';
import { ACTIVE_STATUSES, materialLabels, statusLabels } from '@/lib/recycling/statuses';
import { PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { AdminMap } from '@/components/admin/recycling/AdminMap';
import { ONLINE_WINDOW_MS } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';
import { colorHex } from '@/components/admin/recycling/pointColors';
import type { AdminMapData } from '@/components/admin/recycling/mapTypes';

export const metadata = { title: 'Xarita' };
export const dynamic = 'force-dynamic';

/** Ariza belgisi rangi holat bo'yicha: yangi — qizil, masulda — sariq, haydovchida — ko'k */
const STATUS_HEX: Record<string, string> = { new_: '#dc2626', dispatched: '#f59e0b', assigned: '#2563eb', en_route: '#2563eb', arrived: '#0891b2', collecting: '#7c3aed' };

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const pointId = Number(str(sp.point)) || undefined;
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [allPoints, requests, drivers, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, include: { supervisors: { where: { isActive: true }, select: { name: true } } } }),
    prisma.recycleRequest.findMany({
      where: { status: { in: ACTIVE_STATUSES }, pickupLat: { not: null }, pickupLng: { not: null }, ...(pointId ? { pointId } : {}) },
      include: { point: { select: { cityUz: true } }, assignedDriver: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.driver.findMany({
      where: { isOnline: true, status: { not: 'inactive' }, lastSeenAt: { gte: since }, lastLat: { not: null }, lastLng: { not: null }, ...(pointId ? { pointId } : {}) },
      orderBy: { lastSeenAt: 'desc' },
    }),
    recyclingBadges(),
  ]);
  const points = pointId ? allPoints.filter((p) => p.id === pointId) : allPoints;
  const data: AdminMapData = {
    points: points.filter((p) => p.lat != null && p.lng != null).map((p) => ({
      id: p.id, name: p.cityUz, address: p.address, lat: p.lat!, lng: p.lng!, hex: colorHex(p.color),
      pricePerKg: toNumber(p.pricePerKg), driverRatePerKg: toNumber(p.driverRatePerKg), status: p.status, isAccepting: p.isAccepting,
      supervisors: p.supervisors.map((s) => s.name),
    })),
    requests: requests.map((r) => ({
      id: r.id, name: r.name, phone: displayPhone(r.phone), lat: r.pickupLat!, lng: r.pickupLng!, volume: r.volume,
      material: r.material ? materialLabels.uz[r.material] : null, status: r.status, statusLabel: statusLabels.uz[r.status],
      hex: STATUS_HEX[r.status] ?? '#64748b', driver: r.assignedDriver?.name ?? null, point: r.point.cityUz,
    })),
    drivers: drivers.map((d) => ({
      id: d.id, name: d.name, phone: displayPhone(d.phone), vehicle: d.vehicleInfo, lat: d.lastLat!, lng: d.lastLng!,
      lastSeen: d.lastSeenAt ? formatDate(d.lastSeenAt, 'uz', true) : '—', status: d.status,
    })),
  };
  const noCoords = points.filter((p) => p.lat == null || p.lng == null);
  return (
    <>
      <PageHeader title="Xarita">
        <form className="flex items-center gap-2">
          <select name="point" defaultValue={pointId ?? ''} className="input w-auto py-2">
            <option value="">Barcha punktlar</option>
            {allPoints.map((p) => <option key={p.id} value={p.id}>{p.cityUz}</option>)}
          </select>
          <button className="btn-ghost px-3 py-2 text-sm">Ko'rsatish</button>
          {pointId && <Link href="/admin/recycling/map" className="btn-ghost px-3 py-2 text-sm">Hammasi</Link>}
        </form>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow" /> Punkt + 10 km doira ({data.points.length})</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-red-600 shadow" /> Yangi ariza</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow" /> Masulda</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow" /> Haydovchi tayinlangan / yo'lda</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-cyan-600 shadow" /> Yetib keldi</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white bg-violet-600 shadow" /> Yig'ilmoqda</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] shadow">🚛</span> Onlayn haydovchi — oxirgi 2 soat ({data.drivers.length})</span>
        <span className="text-slate-500">Faol arizalar (koordinatali): {data.requests.length}</span>
      </div>
      {noCoords.length > 0 && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Koordinatasiz punktlar xaritada ko'rinmaydi: {noCoords.map((p) => <Link key={p.id} href={`/admin/recycling/points/${p.id}`} className="underline">{p.cityUz}</Link>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}</p>}
      <AdminMap data={data} />
    </>
  );
}
