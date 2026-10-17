import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { PageHeader, Table } from '@/components/admin/ui';
import { leadStatusBadge, leadTypeNames, orderStatusBadge, paymentBadge } from '@/components/admin/status';

export const metadata = { title: 'Mijoz' };

/** [id]: telefon raqam (998...) yoki kabinet ID */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('customers');
  const raw = (await params).id.replace(/\D/g, '');
  if (!raw) notFound();
  const user = raw.length >= 12
    ? await prisma.user.findUnique({ where: { phone: raw } })
    : await prisma.user.findUnique({ where: { id: Number(raw) } });
  const phone = raw.length >= 12 ? raw : user?.phone;
  if (!phone) notFound();
  const [orders, leads] = await Promise.all([
    prisma.order.findMany({ where: { deletedAt: null, OR: [{ contactPhone: phone }, ...(user ? [{ userId: user.id }] : [])] }, orderBy: { createdAt: 'desc' } }),
    prisma.lead.findMany({ where: { phone }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (!user && !orders.length && !leads.length) notFound();
  return (
    <>
      <PageHeader title={user?.name ?? orders[0]?.customerName ?? displayPhone(phone)} />
      <div className="card mb-4 grid gap-3 p-4 text-sm sm:grid-cols-4">
        <div><p className="text-slate-500">Telefon</p><a href={`tel:+${phone}`} className="font-medium text-brand-500">{displayPhone(phone)}</a></div>
        <div><p className="text-slate-500">Kompaniya</p><p>{user?.companyName ?? '—'}</p></div>
        <div><p className="text-slate-500">Kabinet</p><p>{user ? `ochilgan ${formatDate(user.createdAt, 'uz')}` : "yo'q (mehmon)"}</p></div>
        <div><p className="text-slate-500">Manzil</p><p>{user?.address ?? orders.find((o) => o.shippingAddress)?.shippingAddress ?? '—'}</p></div>
      </div>
      <h2 className="mb-2 font-semibold">Buyurtmalar ({orders.length})</h2>
      <Table head={['#', 'Sana', 'Summa', 'Holat', "To'lov"]} empty={!orders.length}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="px-4 py-2"><Link href={`/admin/orders/${o.id}`} className="text-brand-500">#{o.id}</Link></td>
            <td className="px-4 py-2">{formatDate(o.createdAt, 'uz', true)}</td>
            <td className="px-4 py-2">{formatPrice(o.totalAmount, "so'm")}</td>
            <td className="px-4 py-2">{orderStatusBadge(o.status)}</td>
            <td className="px-4 py-2">{paymentBadge(o.paymentStatus)}</td>
          </tr>
        ))}
      </Table>
      {leads.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Arizalar ({leads.length})</h2>
          <Table head={['#', 'Sana', 'Turi', 'Holat']}>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2"><Link href={`/admin/leads?open=${l.id}`} className="text-brand-500">#{l.id}</Link></td>
                <td className="px-4 py-2">{formatDate(l.createdAt, 'uz', true)}</td>
                <td className="px-4 py-2">{leadTypeNames[l.type]}</td>
                <td className="px-4 py-2">{leadStatusBadge(l.status)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
