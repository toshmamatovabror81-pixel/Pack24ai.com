import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatPrice } from '@/lib/format';
import { str } from '@/lib/params';
import { ACTIVE_STATUSES } from '@/lib/recycling/statuses';
import { Badge, Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Qabul punktlari' };
export const dynamic = 'force-dynamic';

export default async function PointsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [points, active, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: [{ status: 'asc' }, { id: 'asc' }], include: { _count: { select: { supervisors: { where: { isActive: true } }, drivers: { where: { status: { not: 'inactive' } } } } } } }),
    prisma.recycleRequest.groupBy({ by: ['pointId'], where: { status: { in: ACTIVE_STATUSES } }, _count: { _all: true } }),
    recyclingBadges(),
  ]);
  const activeByPoint = new Map(active.map((a) => [a.pointId, a._count._all]));
  return (
    <>
      <PageHeader title={`Qabul punktlari (${points.length})`} action={{ href: '/admin/recycling/points/new', label: '➕ Yangi punkt' }} />
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.deleted) === '1'}>Punkt o'chirildi</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      <Table head={['Punkt', 'Manzil', 'Telefon', 'Narx', 'Haydovchi stavkasi', 'Ish vaqti', 'Holat', 'Qabul', 'Masullar', 'Haydovchilar', 'Faol arizalar', '']} empty={!points.length}>
        {points.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <Link href={`/admin/recycling/points/${p.id}`} className="flex items-center gap-2 font-semibold text-brand-500"><span className={`inline-block h-3 w-3 rounded-full ${p.color}`} />{p.cityUz}</Link>
              <span className="text-xs text-slate-500">{p.regionUz}{p.lat == null && ' · koordinata yo\'q'}</span>
            </td>
            <td className="px-4 py-3 text-slate-600">{p.address ?? '—'}</td>
            <td className="whitespace-nowrap px-4 py-3">{displayPhone(p.phone)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium">{formatPrice(p.pricePerKg, "so'm")}/kg</td>
            <td className="whitespace-nowrap px-4 py-3">{formatPrice(p.driverRatePerKg, "so'm")}/kg</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{p.workingHours}</td>
            <td className="px-4 py-3">{p.status === 'active' ? <Badge tone="green">Faol</Badge> : <Badge tone="slate">Rejada</Badge>}</td>
            <td className="px-4 py-3">{p.isAccepting ? <Badge tone="green">Ha</Badge> : <Badge tone="red">To'xtatilgan</Badge>}</td>
            <td className="px-4 py-3 text-center">{p._count.supervisors || <span className="text-amber-600">0</span>}</td>
            <td className="px-4 py-3 text-center">{p._count.drivers}</td>
            <td className="px-4 py-3 text-center">{activeByPoint.get(p.id) ?? 0}</td>
            <td className="px-4 py-3"><Link href={`/admin/recycling/points/${p.id}`} className="btn-ghost px-3 py-1 text-xs">Ochish</Link></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
