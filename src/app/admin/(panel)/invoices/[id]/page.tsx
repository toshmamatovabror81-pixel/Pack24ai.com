import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { paymentBadge, paymentMethodNames } from '@/components/admin/status';
import { effectiveInvoiceStatus, invoiceStatusBadge } from '@/components/admin/finance/status';
import { cancelInvoice, linkContract, markPaid, registerPartial } from '../actions';

export const metadata = { title: 'Hisob-faktura' };
const errors: Record<string, string> = {
  amount: "To'lov summasini kiriting",
  over: "To'lov summasi qoldiqdan oshmasligi kerak",
  state: "Bu holatdagi hisob-fakturani o'zgartirib bo'lmaydi",
};

export default async function InvoiceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('finance');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const inv = await prisma.corporateInvoice.findUnique({
    where: { id },
    include: {
      contract: { select: { id: true, contractNo: true, companyName: true, status: true } },
      order: { include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } } },
    },
  });
  if (!inv) notFound();
  const contracts = await prisma.contract.findMany({ where: { OR: [{ status: 'active' }, { id: inv.contractId ?? 0 }] }, orderBy: { companyName: 'asc' }, select: { id: true, contractNo: true, companyName: true } });
  const sp = await searchParams;
  const status = effectiveInvoiceStatus(inv);
  const open = status !== 'paid' && status !== 'cancelled';
  const total = toNumber(inv.totalAmount);
  const paid = toNumber(inv.paidAmount);
  const o = inv.order;
  return (
    <>
      <PageHeader title={`Hisob-faktura ${inv.invoiceNo}`}>
        <Link href="/admin/invoices" className="btn-ghost px-4 py-2 text-sm">← Ro'yxat</Link>
        <Link href={`/admin/docs/invoice/${inv.id}`} target="_blank" className="btn-accent px-4 py-2 text-sm">Chop etish ↗</Link>
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{errors[sp.error ?? ''] ?? 'Xato'}</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-slate-500">Holat</p><p>{invoiceStatusBadge(inv)}</p></div>
            <div><p className="text-slate-500">Buyurtma</p><p><Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-500 hover:underline">#{o.id}</Link> · {formatDate(o.createdAt, 'uz')}</p><p className="text-xs text-slate-500">{o.paymentMethod ? paymentMethodNames[o.paymentMethod] : '—'} · {paymentBadge(o.paymentStatus)}</p></div>
            <div><p className="text-slate-500">Xaridor</p><p className="font-medium">{o.companyName || o.customerName || '—'}</p>{o.companyInn && <p className="text-xs text-slate-500">STIR: {o.companyInn}</p>}{o.contactPhone && <p className="text-xs text-slate-500">{displayPhone(o.contactPhone)}</p>}</div>
            <div><p className="text-slate-500">Shartnoma</p>{inv.contract ? <Link href={`/admin/contracts/${inv.contract.id}`} className="font-medium text-brand-500 hover:underline">{inv.contract.contractNo} · {inv.contract.companyName}</Link> : <p>—</p>}</div>
            <div><p className="text-slate-500">Berilgan sana</p><p>{formatDate(inv.createdAt, 'uz', true)}</p></div>
            <div><p className="text-slate-500">To'lov muddati</p><p className={status === 'overdue' ? 'font-medium text-red-600' : ''}>{formatDate(inv.dueDate, 'uz')}</p></div>
            <div><p className="text-slate-500">To'langan</p><p className="font-medium">{formatPrice(inv.paidAmount, "so'm")}</p>{inv.paidAt && <p className="text-xs text-slate-500">{formatDate(inv.paidAt, 'uz', true)}</p>}</div>
            <div><p className="text-slate-500">Qoldiq</p><p className="font-medium">{formatPrice(Math.max(0, total - paid), "so'm")}</p></div>
          </div>
          <Table head={['Mahsulot', 'Artikul', 'Soni', 'Narx', 'Jami']}>
            {o.items.map((it) => (
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
            {toNumber(o.discountAmount) > 0 && <p className="flex justify-between text-emerald-700"><span>Chegirma {o.promoCode && `(${o.promoCode})`}</span><span>−{formatPrice(o.discountAmount, "so'm")}</span></p>}
            {toNumber(o.deliveryFee) > 0 && <p className="flex justify-between"><span>Yetkazib berish</span><span>{formatPrice(o.deliveryFee, "so'm")}</span></p>}
            <p className="flex justify-between"><span>QQSsiz summa</span><span>{formatPrice(inv.subtotal, "so'm")}</span></p>
            <p className="flex justify-between"><span>QQS {inv.vatPercent}%</span><span>{formatPrice(inv.vatAmount, "so'm")}</span></p>
            <p className="flex justify-between text-lg font-bold"><span>Jami to'lovga</span><span>{formatPrice(inv.totalAmount, "so'm")}</span></p>
          </div>
        </div>
        <aside className="space-y-4">
          {open ? (
            <>
              <form action={markPaid} className="card space-y-2 p-4">
                <input type="hidden" name="id" value={inv.id} />
                <p className="text-sm font-semibold">To'lov</p>
                <p className="text-xs text-slate-500">To'liq to'lov: {formatPrice(inv.totalAmount, "so'm")}{o.paymentMethod === 'bank_transfer' && ". Buyurtmaning to'lov holati ham \"To'langan\" bo'ladi."}</p>
                <button className="btn-primary w-full py-2">To'liq to'landi</button>
              </form>
              <form action={registerPartial} className="card space-y-2 p-4">
                <input type="hidden" name="id" value={inv.id} />
                <label className="block"><span className="label">Qisman to'lov, so'm</span><input name="amount" inputMode="decimal" required placeholder={String(Math.max(0, total - paid))} className="input" /></label>
                <button className="btn-ghost w-full py-2 text-sm">Qisman to'lovni kiritish</button>
              </form>
              <form action={cancelInvoice} className="card p-4">
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-ghost w-full py-2 text-sm text-red-600">Hisob-fakturani bekor qilish</button>
              </form>
            </>
          ) : (
            <div className="card p-4 text-sm text-slate-500">{status === 'paid' ? "Hisob-faktura to'liq to'langan." : 'Hisob-faktura bekor qilingan.'}</div>
          )}
          <form action={linkContract} className="card space-y-2 p-4">
            <input type="hidden" name="id" value={inv.id} />
            <label className="block"><span className="label">Shartnomaga bog'lash</span>
              <select name="contractId" defaultValue={inv.contractId ?? ''} className="input">
                <option value="">— Shartnomasiz —</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo} · {c.companyName}</option>)}
              </select>
            </label>
            <button className="btn-ghost w-full py-2 text-sm">Saqlash</button>
          </form>
        </aside>
      </div>
    </>
  );
}
