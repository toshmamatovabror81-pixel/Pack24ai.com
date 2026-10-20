import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getMainWarehouse } from '@/lib/inventory';
import { PageHeader, Table } from '@/components/admin/ui';
import { stockBadge } from '@/components/admin/inventory/status';
import { runInventoryCount } from '../actions';

export const metadata = { title: 'Inventarizatsiya' };

export default async function InventoryCountPage() {
  await requireStaff('inventory');
  const [settings, main] = await Promise.all([getSettings(), getMainWarehouse()]);
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, inventory: { where: { warehouseId: main.id }, select: { quantity: true } } },
  });
  return (
    <>
      <PageHeader title="Inventarizatsiya">
        <Link href="/admin/inventory" className="btn-ghost px-4 py-2 text-sm">← Ombor</Link>
      </PageHeader>
      <p className="mb-4 text-sm text-slate-500">{main.name}: har bir mahsulot uchun haqiqiy sanalgan miqdorni kiriting. Farqi «Inventarizatsiya» sababi bilan jurnalga yoziladi, o'zgarmaganlari o'tkazib yuboriladi.</p>
      <form action={runInventoryCount}>
        <Table head={['Mahsulot', 'Artikul', 'Hisobda', 'Haqiqiy soni']} empty={!products.length}>
          {products.map((p) => {
            const qty = p.inventory[0]?.quantity ?? 0;
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/admin/products/${p.id}`} className="font-medium text-brand-500 hover:underline">{p.name}</Link><br /><span className="text-xs text-slate-500">#{p.id}</span></td>
                <td className="px-4 py-2 text-slate-600">{p.sku ?? '—'}</td>
                <td className="px-4 py-2">{stockBadge(qty, settings.lowStockThreshold)}</td>
                <td className="px-4 py-2"><input name={`qty.${p.id}`} type="number" min={0} step={1} defaultValue={qty} className="input w-28 py-1.5" /></td>
              </tr>
            );
          })}
        </Table>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary px-5 py-2 text-sm">Saqlash</button>
          <span className="text-xs text-slate-500">{products.length} ta faol mahsulot</span>
        </div>
      </form>
    </>
  );
}
