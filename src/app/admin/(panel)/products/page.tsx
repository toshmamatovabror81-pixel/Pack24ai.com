import Link from 'next/link';
import Image from 'next/image';
import type { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatPrice } from '@/lib/format';
import { str } from '@/lib/params';
import { Badge, Notice, PageHeader, Pager, Table } from '@/components/admin/ui';

export const metadata = { title: 'Mahsulotlar' };
const PER_PAGE = 40;
const statusNames: Record<ProductStatus, string> = { active: 'Sotuvda', draft: 'Qoralama', archived: 'Arxiv' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('products');
  const sp = await searchParams;
  const q = str(sp.q)?.trim();
  const cat = Number(str(sp.cat)) || undefined;
  const status = (str(sp.status) as ProductStatus | undefined) ?? undefined;
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }];
  if (cat) where.categoryId = cat;
  where.status = status && status in statusNames ? status : { not: 'archived' };
  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { categoryRel: true, inventory: true } }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const qs = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (cat) p.set('cat', String(cat));
    if (status) p.set('status', status);
    p.set('page', String(n));
    return `/admin/products?${p}`;
  };
  return (
    <>
      <PageHeader title={`Mahsulotlar (${total})`} action={{ href: '/admin/products/new', label: "+ Qo'shish" }} />
      <Notice show={str(sp.archived) === '1'}>Mahsulot arxivga o'tkazildi</Notice>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Nomi yoki artikul" className="input max-w-xs" />
        <select name="cat" defaultValue={cat ?? ''} className="input w-auto">
          <option value="">Barcha kategoriyalar</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Sotuvda va qoralama</option>
          {Object.entries(statusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Filtr</button>
      </form>
      <Table head={['', 'Nomi', 'Kategoriya', 'Narx', 'Qoldiq', 'Holat']} empty={!products.length}>
        {products.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-2"><div className="relative h-10 w-10 overflow-hidden rounded bg-slate-50"><Image src={p.image || '/images/no-image.svg'} alt="" fill sizes="40px" className="object-contain" /></div></td>
            <td className="px-4 py-2"><Link href={`/admin/products/${p.id}`} className="font-medium text-brand-500 hover:underline">{p.name}</Link><br /><span className="text-xs text-slate-500">#{p.id}{p.sku && ` · ${p.sku}`}</span></td>
            <td className="px-4 py-2 text-slate-600">{p.categoryRel?.name ?? p.category ?? '—'}</td>
            <td className="whitespace-nowrap px-4 py-2">{formatPrice(p.price, "so'm")}</td>
            <td className="px-4 py-2">{p.inventory.reduce((s, i) => s + i.quantity, 0)}</td>
            <td className="px-4 py-2"><Badge tone={p.status === 'active' ? 'green' : p.status === 'draft' ? 'amber' : 'slate'}>{statusNames[p.status]}</Badge></td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={qs} />
    </>
  );
}
