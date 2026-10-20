import Link from 'next/link';
import type { Prisma, WorkOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Pager, Table } from '@/components/admin/ui';
import { workOrderStatusNames } from '@/components/admin/production/names';
import { ProgressBar, isOverdue, productionStageBadge, workOrderStatusBadge } from '@/components/admin/production/badges';

export const metadata = { title: 'Ishlab chiqarish' };
const PER_PAGE = 30;

export default async function ProductionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('production');
  const sp = await searchParams;
  const status = str(sp.status) as WorkOrderStatus | undefined;
  const q = str(sp.q)?.trim();
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.WorkOrderWhereInput = {};
  if (status && Object.hasOwn(workOrderStatusNames, status)) where.status = status;
  if (q) where.OR = [{ orderNo: { contains: q, mode: 'insensitive' } }, { clientName: { contains: q, mode: 'insensitive' } }];
  const [orders, total] = await Promise.all([
    prisma.workOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.workOrder.count({ where }),
  ]);
  const now = new Date();
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, ...extra })) if (v) p.set(k, String(v));
    return `/admin/production?${p}`;
  };
  return (
    <>
      <PageHeader title={`Ishlab chiqarish (${total})`} action={{ href: '/admin/production/new', label: '+ Yangi buyurtma' }} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="№ yoki mijoz" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {Object.entries(workOrderStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
      </form>
      <Table head={['№', 'Mijoz', 'Mahsulot', 'Soni', 'Muddat', 'Bosqich', 'Progress', 'Holat', '']} empty={!orders.length}>
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><Link href={`/admin/production/${o.id}`} className="font-mono font-semibold text-brand-500">{o.orderNo}</Link></td>
            <td className="px-4 py-3">{o.clientName}</td>
            <td className="px-4 py-3">{o.productName}{o.size && <><br /><span className="text-xs text-slate-500">{o.size}</span></>}</td>
            <td className="px-4 py-3">{o.quantity}</td>
            <td className={`whitespace-nowrap px-4 py-3 ${isOverdue(o.deadline, o.status, now) ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{formatDate(o.deadline, 'uz')}</td>
            <td className="px-4 py-3">{productionStageBadge(o.currentStage)}</td>
            <td className="px-4 py-3"><ProgressBar value={o.progress} /></td>
            <td className="px-4 py-3">{workOrderStatusBadge(o.status)}</td>
            <td className="px-4 py-3 text-right"><Link href={`/admin/production/${o.id}`} className="text-sm text-brand-500 hover:underline">Ochish →</Link></td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => qs({ page: n })} />
    </>
  );
}
