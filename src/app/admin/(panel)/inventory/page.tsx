import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getMainWarehouse, lowStockWhere } from '@/lib/inventory';
import { str } from '@/lib/params';
import { Badge, Notice, PageHeader, Pager, Table } from '@/components/admin/ui';
import { movementReasons, stockBadge } from '@/components/admin/inventory/status';
import { adjustInventory } from './actions';

export const metadata = { title: 'Ombor' };
const PER_PAGE = 40;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('inventory');
  const sp = await searchParams;
  const q = str(sp.q)?.trim();
  const low = str(sp.low) === '1';
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [settings, main] = await Promise.all([getSettings(), getMainWarehouse()]);
  const threshold = settings.lowStockThreshold;
  const where: Prisma.ProductWhereInput = low ? lowStockWhere(main.id, threshold) : { status: 'active' };
  if (q) where.AND = [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] }];
  const [products, total, lowCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, name: true, sku: true, inStock: true, inventory: { where: { warehouseId: main.id }, select: { quantity: true } } },
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: lowStockWhere(main.id, threshold) }),
  ]);
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, low: low ? '1' : undefined, ...extra })) if (v) p.set(k, String(v));
    return `/admin/inventory?${p}`;
  };
  const error = str(sp.error);
  const counted = Number(str(sp.counted));
  return (
    <>
      <PageHeader title={`Ombor (${total})`}>
        <Link href="/admin/inventory/movements" className="btn-ghost px-4 py-2 text-sm">Harakatlar tarixi</Link>
        <Link href="/admin/inventory/count" className="btn-primary px-4 py-2 text-sm">Inventarizatsiya</Link>
      </PageHeader>
      <Notice show={str(sp.saved) === '1'}>Qoldiq yangilandi</Notice>
      <Notice show={str(sp.counted) != null}>Inventarizatsiya yakunlandi: {counted || 0} ta mahsulot qoldig'i o'zgartirildi</Notice>
      <Notice show={error === 'stock'} tone="warn">Omborda yetarli qoldiq yo'q — chiqim miqdori qoldiqdan katta bo'lishi mumkin emas</Notice>
      <Notice show={error === 'input'} tone="warn">Miqdorni kiriting (musbat — kirim, manfiy — chiqim)</Notice>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Nomi yoki artikul" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={low} className="h-4 w-4 rounded border-slate-300" />
          Faqat kam qolganlar ({lowCount})
        </label>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
        <span className="ml-auto text-xs text-slate-500">{main.name}{main.location && `, ${main.location}`} · chegara: {threshold} dona</span>
      </form>
      <Table head={['Mahsulot', 'Artikul', 'Qoldiq', 'Sotuvda', "O'zgartirish"]} empty={!products.length}>
        {products.map((p) => {
          const qty = p.inventory[0]?.quantity ?? 0;
          return (
            <tr key={p.id} className={`hover:bg-slate-50 ${str(sp.product) === String(p.id) ? 'bg-amber-50' : ''}`}>
              <td className="px-4 py-2"><Link href={`/admin/products/${p.id}`} className="font-medium text-brand-500 hover:underline">{p.name}</Link><br /><span className="text-xs text-slate-500">#{p.id}</span></td>
              <td className="px-4 py-2 text-slate-600">{p.sku ?? '—'}</td>
              <td className="px-4 py-2">{stockBadge(qty, threshold)} <Link href={`/admin/inventory/movements?product=${p.id}`} className="ml-1 text-xs text-slate-500 hover:underline">tarix</Link></td>
              <td className="px-4 py-2">{p.inStock ? <Badge tone="green">Ha</Badge> : <Badge>Yo'q</Badge>}</td>
              <td className="px-4 py-2">
                <form action={adjustInventory} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="productId" value={p.id} />
                  {q && <input type="hidden" name="q" value={q} />}
                  {low && <input type="hidden" name="low" value="1" />}
                  {page > 1 && <input type="hidden" name="page" value={page} />}
                  <input name="delta" type="number" step={1} required placeholder="± soni" className="input w-24 py-1.5" />
                  <select name="reason" defaultValue="kirim" className="input w-auto py-1.5">
                    {Object.entries(movementReasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn-ghost px-3 py-1.5 text-sm">Saqlash</button>
                </form>
              </td>
            </tr>
          );
        })}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => qs({ page: n })} />
    </>
  );
}
