import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { productHref } from '@/lib/catalog';
import { pickText } from '@/lib/i18n/config';
import { Notice, PageHeader } from '@/components/admin/ui';
import { ProductForm } from '../ProductForm';
import { archiveProduct } from '../actions';

export const metadata = { title: 'Mahsulot' };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('products');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { inventory: { include: { warehouse: true } } } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!product) notFound();
  const sp = await searchParams;
  const mainStock = product.inventory.find((i) => i.warehouse.isMain)?.quantity ?? product.inventory[0]?.quantity ?? null;
  return (
    <>
      <PageHeader title={product.name}>
        <Link href={productHref('uz', product.id, pickText(product.nameI18n, 'uz', product.name))} target="_blank" className="btn-ghost px-4 py-2 text-sm">Saytda ↗</Link>
        {product.status !== 'archived' && (
          <form action={archiveProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn-ghost px-4 py-2 text-sm text-accent-600">Arxivga</button>
          </form>
        )}
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi. Saytda bir necha daqiqada yangilanadi.</Notice>
      <Notice show={sp.error === '1'} tone="warn">Nomi (o'zbekcha) va narx majburiy</Notice>
      <ProductForm product={product} categories={categories} stock={mainStock} />
    </>
  );
}
