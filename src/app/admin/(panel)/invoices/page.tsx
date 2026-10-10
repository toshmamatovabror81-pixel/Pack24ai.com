import Link from 'next/link';
import type { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate, formatPrice, toNumber } from '@/lib/format';
import { invoiceStatusWhere } from '@/lib/invoiceStatus';
import { str } from '@/lib/params';
import { PageHeader, Pager, Table } from '@/components/admin/ui';
import { effectiveInvoiceStatus, invoiceStatusBadge, invoiceStatusNames } from '@/components/admin/finance/status';

export const metadata = { title: 'Hisob-fakturalar' };
const PER_PAGE = 30;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('finance');
  const sp = await searchParams;
  const status = str(sp.status) as InvoiceStatus | undefined;
  const contract = Number(str(sp.contract)) || undefined;
  const q = str(sp.q)?.trim();
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const now = new Date();
  const and: Prisma.CorporateInvoiceWhereInput[] = [];
  // "Muddati o'tgan" bazada saqlanmaydi: filtr ham nishon (effectiveInvoiceStatus) bilan bir xil chegaradan hisoblanadi
  if (status && status in invoiceStatusNames) and.push(invoiceStatusWhere(status, now));
  if (contract) and.push({ contractId: contract });
  if (q) {
    and.push({
      OR: [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { order: { OR: [{ companyName: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }] } },
        ...(Number.isSafeInteger(Number(q)) && Number(q) < 2 ** 31 ? [{ orderId: Number(q) }] : []),
      ],
    });
  }
  const where: Prisma.CorporateInvoiceWhereInput = { AND: and };
  const [invoices, total, open] = await Promise.all([
    prisma.corporateInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { order: { select: { id: true, customerName: true, companyName: true } }, contract: { select: { id: true, contractNo: true } } },
    }),
    prisma.corporateInvoice.count({ where }),
    prisma.corporateInvoice.aggregate({ where: { status: { in: ['issued', 'partial', 'overdue'] } }, _sum: { totalAmount: true, paidAmount: true } }),
  ]);
  const unpaid = toNumber(open._sum.totalAmount) - toNumber(open._sum.paidAmount);
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, contract, q, ...extra })) if (v) p.set(k, String(v));
    return `/admin/invoices?${p}`;
  };
  return (
    <>
      <PageHeader title={`Hisob-fakturalar (${total})`}>
        <span className="text-sm text-slate-500">To'lanmagan: <b className="text-slate-800">{formatPrice(unpaid, "so'm")}</b></span>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        {contract && <input type="hidden" name="contract" value={contract} />}
        <input name="q" defaultValue={q} placeholder="Raqam, buyurtma yoki kompaniya" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {Object.entries(invoiceStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
        {contract && <Link href="/admin/invoices" className="btn-ghost px-4 py-2 text-sm">Shartnoma filtrini olib tashlash</Link>}
      </form>
      <Table head={['№', 'Sana', 'Buyurtma', 'Kompaniya', 'Shartnoma', 'Summa', "To'lov muddati", "To'langan", 'Holat']} empty={!invoices.length}>
        {invoices.map((inv) => {
          const overdue = effectiveInvoiceStatus(inv, now) === 'overdue';
          return (
            <tr key={inv.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-2"><Link href={`/admin/invoices/${inv.id}`} className="font-mono font-semibold text-brand-500">{inv.invoiceNo}</Link></td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(inv.createdAt, 'uz')}</td>
              <td className="px-4 py-2"><Link href={`/admin/orders/${inv.orderId}`} className="text-brand-500 hover:underline">#{inv.orderId}</Link></td>
              <td className="px-4 py-2">{inv.order.companyName || inv.order.customerName || '—'}</td>
              <td className="px-4 py-2">{inv.contract ? <Link href={`/admin/contracts/${inv.contract.id}`} className="font-mono text-brand-500 hover:underline">{inv.contract.contractNo}</Link> : <span className="text-slate-400">—</span>}</td>
              <td className="whitespace-nowrap px-4 py-2 font-medium">{formatPrice(inv.totalAmount, "so'm")}</td>
              <td className={`whitespace-nowrap px-4 py-2 ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>{formatDate(inv.dueDate, 'uz')}</td>
              <td className="whitespace-nowrap px-4 py-2">{formatPrice(inv.paidAmount, "so'm")}</td>
              <td className="px-4 py-2">{invoiceStatusBadge(inv)}</td>
            </tr>
          );
        })}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => qs({ page: n })} />
    </>
  );
}
