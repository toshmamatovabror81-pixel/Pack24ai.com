import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatPrice, toNumber } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Table } from '@/components/admin/ui';
import { paymentMethodNames } from '@/components/admin/status';

export const metadata = { title: 'Hisobotlar' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('reports');
  const days = Math.min(365, Math.max(1, Number(str((await searchParams).days)) || 30));
  const from = new Date(Date.now() - days * 86400_000);
  const where = { deletedAt: null, createdAt: { gte: from }, status: { not: 'cancelled' as const } };
  const [byDay, bySource, byMethod, topItems, totals] = await Promise.all([
    prisma.$queryRaw<{ day: string; orders: bigint; revenue: string | null; paid: string | null }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS day,
             COUNT(*) AS orders,
             SUM("totalAmount")::text AS revenue,
             SUM(CASE WHEN "paymentStatus" = 'paid' THEN "totalAmount" ELSE 0 END)::text AS paid
      FROM "Order" WHERE "deletedAt" IS NULL AND status <> 'cancelled' AND "createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1 DESC`,
    prisma.order.groupBy({ by: ['utmSource', 'utmMedium'], where, _count: { _all: true }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } } }),
    prisma.order.groupBy({ by: ['paymentMethod'], where, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: where }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 15 }),
    prisma.order.aggregate({ where, _count: { _all: true }, _sum: { totalAmount: true } }),
  ]);
  const products = await prisma.product.findMany({ where: { id: { in: topItems.map((t) => t.productId) } }, select: { id: true, name: true } });
  const pname = new Map(products.map((p) => [p.id, p.name]));
  const sum = (v: Parameters<typeof formatPrice>[0]) => formatPrice(v, "so'm");
  return (
    <>
      <PageHeader title="Hisobotlar">
        <form className="flex gap-2">
          <select name="days" defaultValue={days} className="input w-auto py-2">
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} kun</option>)}
          </select>
          <button className="btn-ghost px-3 py-2 text-sm">Ko&apos;rsatish</button>
        </form>
      </PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-sm text-slate-500">Buyurtmalar</p><p className="text-xl font-bold">{totals._count._all}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Summa</p><p className="text-xl font-bold">{sum(totals._sum.totalAmount)}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">O&apos;rtacha chek</p><p className="text-xl font-bold">{sum(totals._count._all ? toNumber(totals._sum.totalAmount) / totals._count._all : 0)}</p></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Manba bo&apos;yicha (UTM)</h2>
          <Table head={['Manba', 'Kanal', 'Buyurtma', 'Summa']} empty={!bySource.length}>
            {bySource.map((s) => (
              <tr key={`${s.utmSource}-${s.utmMedium}`}>
                <td className="px-4 py-2">{s.utmSource ?? "To'g'ridan-to'g'ri / qidiruv"}</td>
                <td className="px-4 py-2">{s.utmMedium ?? '—'}</td>
                <td className="px-4 py-2">{s._count._all}</td>
                <td className="px-4 py-2">{sum(s._sum.totalAmount)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">To&apos;lov usuli</h2>
          <Table head={['Usul', 'Buyurtma', 'Summa']} empty={!byMethod.length}>
            {byMethod.map((m) => (
              <tr key={m.paymentMethod ?? 'none'}>
                <td className="px-4 py-2">{m.paymentMethod ? paymentMethodNames[m.paymentMethod] : '—'}</td>
                <td className="px-4 py-2">{m._count._all}</td>
                <td className="px-4 py-2">{sum(m._sum.totalAmount)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Ko&apos;p sotilgan mahsulotlar</h2>
          <Table head={['Mahsulot', 'Soni']} empty={!topItems.length}>
            {topItems.map((t) => (
              <tr key={t.productId}><td className="px-4 py-2">{pname.get(t.productId) ?? `#${t.productId}`}</td><td className="px-4 py-2">{t._sum.quantity}</td></tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Kunlar bo&apos;yicha</h2>
          <Table head={['Kun', 'Buyurtma', 'Summa', "To'langan"]} empty={!byDay.length}>
            {byDay.map((d) => (
              <tr key={d.day}><td className="px-4 py-2">{d.day}</td><td className="px-4 py-2">{Number(d.orders)}</td><td className="px-4 py-2">{sum(d.revenue)}</td><td className="px-4 py-2">{sum(d.paid)}</td></tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}
