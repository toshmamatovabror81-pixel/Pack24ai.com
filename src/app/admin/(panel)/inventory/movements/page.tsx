import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Pager, Table } from '@/components/admin/ui';
import { movementTypeBadge } from '@/components/admin/inventory/status';

export const metadata = { title: 'Ombor harakatlari' };
const PER_PAGE = 50;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('inventory');
  const sp = await searchParams;
  const productId = Number(str(sp.product)) || undefined;
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.StockMovementWhereInput = productId ? { productId } : {};
  const [movements, total, product] = await Promise.all([
    prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { product: { select: { id: true, name: true, sku: true } } } }),
    prisma.stockMovement.count({ where }),
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true } }) : null,
  ]);
  const qs = (n: number) => `/admin/inventory/movements?${new URLSearchParams({ ...(productId ? { product: String(productId) } : {}), page: String(n) })}`;
  return (
    <>
      <PageHeader title={`Ombor harakatlari (${total})`}>
        {product && <Link href="/admin/inventory/movements" className="btn-ghost px-4 py-2 text-sm">{product.name} ✕</Link>}
        <Link href="/admin/inventory" className="btn-ghost px-4 py-2 text-sm">← Ombor</Link>
      </PageHeader>
      <Table head={['Sana', 'Mahsulot', 'Turi', 'Soni', 'Sabab', 'Kim']} empty={!movements.length}>
        {movements.map((m) => (
          <tr key={m.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(m.createdAt, 'uz', true)}</td>
            <td className="px-4 py-2"><Link href={`/admin/inventory/movements?product=${m.product.id}`} className="font-medium text-brand-500 hover:underline">{m.product.name}</Link>{m.product.sku && <><br /><span className="text-xs text-slate-500">{m.product.sku}</span></>}</td>
            <td className="px-4 py-2">{movementTypeBadge(m.type)}</td>
            <td className={`whitespace-nowrap px-4 py-2 font-medium ${m.type === 'IN' ? 'text-emerald-700' : m.type === 'OUT' ? 'text-red-600' : ''}`}>{m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : ''}{m.quantity}</td>
            <td className="px-4 py-2">{m.reason ?? '—'}</td>
            <td className="px-4 py-2 text-slate-600">{m.createdBy ?? '—'}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={qs} />
    </>
  );
}
