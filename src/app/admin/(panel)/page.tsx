import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { formatDate, formatPrice, toNumber, displayPhone } from '@/lib/format';
import { Badge, Notice, PageHeader, Table } from '@/components/admin/ui';
import { orderStatusBadge, paymentBadge } from '@/components/admin/status';

export const metadata = { title: 'Boshqaruv paneli' };

function startOfTashkentDay(offsetDays = 0) {
  const now = new Date(Date.now() + 5 * 3600_000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 5 * 3600_000 - offsetDays * 86400_000);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireStaff('dashboard');
  const sp = await searchParams;
  const today = startOfTashkentDay();
  const month = startOfTashkentDay(29);
  const live = { deletedAt: null, status: { not: 'cancelled' as const } };
  const [todayOrders, todayRevenue, monthRevenue, monthOrders, newLeads, recent, lowStock] = await Promise.all([
    prisma.order.count({ where: { ...live, createdAt: { gte: today } } }),
    prisma.order.aggregate({ where: { ...live, createdAt: { gte: today }, paymentStatus: 'paid' }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { ...live, createdAt: { gte: month }, paymentStatus: 'paid' }, _sum: { totalAmount: true } }),
    prisma.order.count({ where: { ...live, createdAt: { gte: month } } }),
    prisma.lead.count({ where: { status: 'new_' } }),
    prisma.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 }),
    can(user.role, 'products') ? prisma.inventory.findMany({ where: { quantity: { lt: 10 } }, include: { product: { select: { id: true, name: true } } }, take: 8 }) : [],
  ]);
  const cards = [
    { label: 'Bugungi buyurtmalar', value: String(todayOrders) },
    { label: "Bugun to'langan", value: formatPrice(todayRevenue._sum.totalAmount, "so'm") },
    { label: "30 kunda to'langan", value: formatPrice(monthRevenue._sum.totalAmount, "so'm") },
    { label: '30 kunda buyurtmalar', value: String(monthOrders) },
    { label: 'Yangi arizalar', value: String(newLeads), href: '/admin/leads' },
  ];
  return (
    <>
      <PageHeader title="Boshqaruv paneli" />
      <Notice show={sp.denied === '1'} tone="warn">Bu bo'limga ruxsatingiz yo'q.</Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <div className="card p-4">
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-1 text-xl font-bold">{c.value}</p>
            </div>
          );
          return c.href ? <Link key={c.label} href={c.href}>{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Oxirgi buyurtmalar</h2>
      <Table head={['#', 'Sana', 'Mijoz', 'Summa', 'Holat', "To'lov"]} empty={!recent.length}>
        {recent.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-500">#{o.id}</Link></td>
            <td className="px-4 py-3 text-slate-500">{formatDate(o.createdAt, 'uz', true)}</td>
            <td className="px-4 py-3">{o.customerName}<br /><span className="text-xs text-slate-500">{o.contactPhone && displayPhone(o.contactPhone)}</span></td>
            <td className="px-4 py-3 font-medium">{formatPrice(toNumber(o.totalAmount), "so'm")}</td>
            <td className="px-4 py-3">{orderStatusBadge(o.status)}</td>
            <td className="px-4 py-3">{paymentBadge(o.paymentStatus)}</td>
          </tr>
        ))}
      </Table>
      {lowStock.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Omborda kam qolgan</h2>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <Link key={i.id} href={`/admin/products/${i.product.id}`}><Badge tone="amber">{i.product.name}: {i.quantity}</Badge></Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
