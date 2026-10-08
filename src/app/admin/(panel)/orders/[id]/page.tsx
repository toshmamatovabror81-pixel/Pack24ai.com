import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { orderStatusBadge, orderStatusNames, paymentBadge, paymentMethodNames, paymentNames } from '@/components/admin/status';
import { invoiceStatusBadge } from '@/components/admin/finance/status';
import { updateOrder } from '../actions';
import { createInvoiceForOrder } from '../../invoices/actions';

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireStaff('orders');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } }, user: { select: { id: true, name: true } }, paymeTransactions: true, workOrders: { orderBy: { createdAt: 'desc' }, select: { id: true, orderNo: true, productName: true } }, corporateInvoices: { where: { status: { not: 'cancelled' } }, take: 1 } },
  });
  if (!order) notFound();
  const saved = (await searchParams).saved === '1';
  const manualPayment = order.paymentMethod === 'cash' || order.paymentMethod === 'bank_transfer' || !order.paymentMethod;
  const utm = [order.utmSource, order.utmMedium, order.utmCampaign, order.utmContent, order.utmTerm].filter(Boolean).join(' / ');
  const invoice = order.corporateInvoices[0];
  return (
    <>
      <PageHeader title={`Buyurtma #${order.id}`}>
        <Link href="/admin/orders" className="btn-ghost px-4 py-2 text-sm">← Ro'yxat</Link>
      </PageHeader>
      <Notice show={saved}>Saqlandi</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Table head={['Mahsulot', 'Artikul', 'Soni', 'Narx', 'Jami']}>
            {order.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-3"><Link href={`/admin/products/${it.product.id}`} className="text-brand-500 hover:underline">{it.product.name}</Link></td>
                <td className="px-4 py-3 text-slate-500">{it.product.sku ?? '—'}</td>
                <td className="px-4 py-3">{it.quantity}</td>
                <td className="px-4 py-3">{formatPrice(it.price, "so'm")}</td>
                <td className="px-4 py-3 font-medium">{formatPrice(toNumber(it.price) * it.quantity, "so'm")}</td>
              </tr>
            ))}
          </Table>
          <div className="card space-y-1 p-4 text-sm">
            {order.subtotal && <p className="flex justify-between"><span>Mahsulotlar</span><span>{formatPrice(order.subtotal, "so'm")}</span></p>}
            {toNumber(order.discountAmount) > 0 && <p className="flex justify-between text-emerald-700"><span>Chegirma {order.promoCode && `(${order.promoCode})`}</span><span>−{formatPrice(order.discountAmount, "so'm")}</span></p>}
            <p className="flex justify-between"><span>Yetkazib berish</span><span>{formatPrice(order.deliveryFee, "so'm")}</span></p>
            <p className="flex justify-between text-lg font-bold"><span>Jami</span><span>{formatPrice(order.totalAmount, "so'm")}</span></p>
          </div>
          <div className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-slate-500">Mijoz</p><p className="font-medium">{order.customerName ?? '—'}</p>{order.user && <Link href={`/admin/customers/${order.user.id}`} className="text-xs text-brand-500">Kabinet: {order.user.name}</Link>}</div>
            {(order.companyName || order.companyInn) && <div><p className="text-slate-500">Kompaniya</p><p className="font-medium">{order.companyName ?? '—'}</p>{order.companyInn && <p className="text-xs text-slate-500">STIR: {order.companyInn}</p>}</div>}
            <div><p className="text-slate-500">Telefon</p>{order.contactPhone ? <a href={`tel:+${order.contactPhone}`} className="font-medium text-brand-500">{displayPhone(order.contactPhone)}</a> : '—'}</div>
            <div><p className="text-slate-500">Yetkazish</p><p>{order.deliveryMethod === 'pickup' ? 'Olib ketish' : order.shippingAddress ?? '—'}</p></div>
            <div><p className="text-slate-500">Izoh</p><p className="whitespace-pre-line">{order.comment ?? '—'}</p></div>
            <div><p className="text-slate-500">Yaratilgan</p><p>{formatDate(order.createdAt, 'uz', true)}</p></div>
            <div><p className="text-slate-500">Manba</p><p>{order.source ?? '—'}{utm && ` · ${utm}`}</p>{order.landingPage && <p className="break-all text-xs text-slate-500">{order.landingPage}</p>}</div>
          </div>
        </div>
        <aside className="space-y-4">
          <form action={updateOrder} className="card space-y-3 p-4">
            <input type="hidden" name="id" value={order.id} />
            <p className="flex items-center justify-between text-sm">Holat {orderStatusBadge(order.status)}</p>
            <select name="status" defaultValue={order.status} className="input">
              {Object.entries(orderStatusNames).filter(([k]) => k !== 'draft').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <p className="flex items-center justify-between text-sm">To'lov ({order.paymentMethod ? paymentMethodNames[order.paymentMethod] : '—'}) {paymentBadge(order.paymentStatus)}</p>
            {manualPayment ? (
              <select name="paymentStatus" defaultValue={order.paymentStatus} className="input">
                {(['pending', 'paid', 'refunded'] as const).map((k) => <option key={k} value={k}>{paymentNames[k]}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500">Onlayn to'lov holatini to'lov tizimi o'zi yangilaydi.</p>
            )}
            <button className="btn-primary w-full py-2">Saqlash</button>
          </form>
          {(can(user.role, 'finance') || can(user.role, 'production')) && (
            <div className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">Hujjatlar</p>
              {can(user.role, 'finance') && (invoice ? (
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-brand-500 hover:underline">{invoice.invoiceNo}</Link>
                  {invoiceStatusBadge(invoice)}
                  <Link href={`/admin/docs/invoice/${invoice.id}`} target="_blank" className="ml-auto text-brand-500 hover:underline">Chop etish ↗</Link>
                </p>
              ) : (
                <form action={createInvoiceForOrder}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button className="btn-ghost w-full py-2 text-sm">Hisob-faktura yaratish</button>
                </form>
              ))}
              {can(user.role, 'production') && (
                <>
                  <Link href={`/admin/production/new?order=${order.id}`} className="btn-ghost block w-full py-2 text-center text-sm">Ishlab chiqarish buyurtmasi</Link>
                  {order.workOrders.map((w) => (
                    <p key={w.id}><Link href={`/admin/production/${w.id}`} className="text-brand-500 hover:underline">{w.orderNo}</Link> <span className="text-xs text-slate-500">· {w.productName}</span></p>
                  ))}
                </>
              )}
            </div>
          )}
          {order.paymeTransactions.length > 0 && (
            <div className="card p-4 text-xs">
              <p className="mb-2 font-semibold">Payme tranzaksiyalari</p>
              {order.paymeTransactions.map((t) => <p key={t.id} className="break-all">{t.id}: holat {t.state}, {t.amount / 100} so'm</p>)}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
