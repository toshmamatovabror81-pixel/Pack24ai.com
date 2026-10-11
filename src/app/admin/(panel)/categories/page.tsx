import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { pickText } from '@/lib/i18n/config';
import { Badge, Notice, PageHeader, Table } from '@/components/admin/ui';

export const metadata = { title: 'Kategoriyalar' };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireStaff('products');
  const [cats, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.product.groupBy({ by: ['categoryId'], where: { status: 'active' }, _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return (
    <>
      <PageHeader title={`Kategoriyalar (${cats.length})`} action={{ href: '/admin/categories/new', label: "+ Qo'shish" }} />
      <Notice show={(await searchParams).deleted === '1'}>O'chirildi</Notice>
      <Table head={['Tartib', 'Nomi', 'Manzil', 'Mahsulotlar', 'SEO matn', 'Holat']} empty={!cats.length}>
        {cats.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-500">{c.sortOrder}</td>
            <td className="px-4 py-2"><Link href={`/admin/categories/${c.id}`} className="font-medium text-brand-500 hover:underline">{c.name}</Link><br /><span className="text-xs text-slate-500">{pickText(c.nameI18n, 'ru')}</span></td>
            <td className="px-4 py-2 font-mono text-xs">/catalog/{c.slug}</td>
            <td className="px-4 py-2">{count.get(c.id) ?? 0}</td>
            <td className="px-4 py-2">{pickText(c.descriptionI18n, 'uz') ? <Badge tone="green">Bor</Badge> : <Badge tone="amber">Yo'q</Badge>}</td>
            <td className="px-4 py-2">{c.isActive ? <Badge tone="green">Faol</Badge> : <Badge>Yashirin</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
