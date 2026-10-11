'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { bool, i18nFrom, num, optText, text } from '@/lib/formData';
import { slugify } from '@/lib/slug';

export async function saveCategory(fd: FormData) {
  await requireStaff('products');
  const id = Number(fd.get('id')) || null;
  const nameI18n = i18nFrom(fd, 'name');
  if (!nameI18n.uz) redirect(id ? `/admin/categories/${id}?error=name` : '/admin/categories/new?error=name');
  const slug = slugify(text(fd, 'slug', 80) || nameI18n.uz);
  const clash = await prisma.category.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash || !slug) redirect(id ? `/admin/categories/${id}?error=slug` : '/admin/categories/new?error=slug');
  const data = {
    name: nameI18n.uz,
    nameI18n,
    slug,
    descriptionI18n: i18nFrom(fd, 'description'),
    image: optText(fd, 'image', 1000),
    sortOrder: Math.floor(num(fd, 'sortOrder') ?? 0),
    isActive: bool(fd, 'isActive'),
  };
  const saved = id
    ? await prisma.$transaction(async (tx) => {
        const old = await tx.category.findUnique({ where: { id } });
        const c = await tx.category.update({ where: { id }, data });
        // Eski matnli kategoriya maydonini ham yangilaymiz (eski slug bilan bog'langan mahsulotlar)
        if (old && old.slug !== slug) await tx.product.updateMany({ where: { categoryId: id }, data: { category: slug } });
        return c;
      })
    : await prisma.category.create({ data });
  revalidateTag('categories');
  revalidatePath('/[lang]', 'layout');
  redirect(`/admin/categories/${saved.id}?saved=1`);
}

export async function deleteCategory(fd: FormData) {
  await requireStaff('products');
  const id = Number(fd.get('id'));
  const used = await prisma.product.count({ where: { categoryId: id, status: { not: 'archived' } } });
  if (used > 0) redirect(`/admin/categories/${id}?error=used`);
  await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.category.delete({ where: { id } });
  revalidateTag('categories');
  redirect('/admin/categories?deleted=1');
}
