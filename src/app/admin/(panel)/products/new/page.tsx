import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Notice, PageHeader } from '@/components/admin/ui';
import { ProductForm } from '../ProductForm';

export const metadata = { title: 'Yangi mahsulot' };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff('products');
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return (
    <>
      <PageHeader title="Yangi mahsulot" />
      <Notice show={(await searchParams).error === '1'} tone="warn">Nomi (o'zbekcha) va narx majburiy</Notice>
      <ProductForm categories={categories} />
    </>
  );
}
