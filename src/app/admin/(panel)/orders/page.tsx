import Link from 'next/link';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice, normalizePhone } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Pager, Table } from '@/components/admin/ui';
import { orderStatusBadge, orderStatusNames, paymentBadge, paymentMethodNames } from '@/components/admin/status';

export const metadata = { title: 'Buyurtmalar' };
const PER_PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('orders');
  const sp = await searchParams;
  const status = str(sp.status) as OrderStatus | undefined;
  const q = str(sp.q)?.trim();
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.OrderWhereInput = { deletedAt: null };
  if (status && status in orderStatusNames) where.status = status;
  if (q) {
    const phone = normalizePhone(q);
    where.OR = [
      ...(Number.isSafeInteger(Number(q)) && Number(q) < 2 ** 31 ? [{ id: Number(q) }] : []),
      { customerName: { contains: q, mode: 'insensitive' } },
      { contactPhone: { contains: phone ?? (q.replace(/\D/g, '') || q) } },
    ];
  }
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, ...extra })) if (v) p.set(k, String(v));
    return `/admin/orders?${p}`;
  };
  return (
    <>
      <PageHeader title={`Buyurtmalar (${total})`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Raqam, ism yoki telefon" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {Object.entries(orderStatusNames).filter(([k]) => k !== 'draft').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
      </form>
      <Table head={['#', 'Sana', 'Mijoz', 'Mahsulot', 'Summa', "To'lov", 'Holat', 'Manba']} empty={!orders.length}>
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-500">#{o.id}</Link></td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(o.createdAt, 'uz', true)}</td>
            <td className="px-4 py-3">{o.customerName}<br /><span className="text-xs text-slate-500">{o.contactPhone && displayPhone(o.contactPhone)}</span></td>
            <td className="px-4 py-3">{o._count.items}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium">{formatPrice(o.totalAmount, "so'm")}</td>
            <td className="px-4 py-3">{paymentBadge(o.paymentStatus)}<br /><span className="text-xs text-slate-500">{o.paymentMethod && paymentMethodNames[o.paymentMethod]}</span></td>
            <td className="px-4 py-3">{orderStatusBadge(o.status)}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{o.utmSource ?? o.source ?? '—'}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => qs({ page: n })} />
    </>
  );
}
