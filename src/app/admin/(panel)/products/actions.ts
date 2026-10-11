'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { bool, i18nFrom, num, optText, text } from '@/lib/formData';
import { setStock } from '@/lib/inventory';

/** "Kalit: qiymat" qatorlari -> JSON obyekt */
function parseSpecs(raw: string) {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && v) out[k.slice(0, 80)] = v.slice(0, 200);
    }
  }
  return out;
}

/** "100: 1200" qatorlari -> [{minQty, price}] */
function parseTierLines(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.split(/[:=]/).map((x) => x.replace(/\s/g, '')))
    .map(([q, p]) => ({ minQty: Math.floor(Number(q)), price: Number(p) }))
    .filter((t) => t.minQty > 1 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

export async function saveProduct(fd: FormData) {
  const user = await requireStaff('products');
  const id = Number(fd.get('id')) || null;
  const nameI18n = i18nFrom(fd, 'name');
  const price = num(fd, 'price');
  if (!nameI18n.uz || price == null || price < 0) redirect(id ? `/admin/products/${id}?error=1` : '/admin/products/new?error=1');
  const categoryId = Number(fd.get('categoryId')) || null;
  const category = categoryId ? await prisma.category.findUnique({ where: { id: categoryId }, select: { slug: true } }) : null;
  const status = (['active', 'draft', 'archived'] as const).find((s) => s === fd.get('status')) ?? 'active';
  const gallery = text(fd, 'gallery', 5000).split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\/|^\//.test(s)).slice(0, 12);
  const descriptionI18n = i18nFrom(fd, 'description');
  const data: Prisma.ProductUncheckedCreateInput = {
    name: nameI18n.uz,
    nameI18n,
    description: descriptionI18n.uz ?? null,
    descriptionI18n,
    price,
    originalPrice: num(fd, 'originalPrice'),
    sku: optText(fd, 'sku', 80),
    categoryId,
    category: category?.slug ?? null,
    image: text(fd, 'image', 1000),
    gallery,
    specifications: parseSpecs(text(fd, 'specs', 5000)),
    priceTiers: parseTierLines(text(fd, 'tiers', 2000)),
    minQuantity: Math.max(1, Math.floor(num(fd, 'minQuantity') ?? 1)),
    inStock: bool(fd, 'inStock'),
    isFeatured: bool(fd, 'isFeatured'),
    status: status as ProductStatus,
  };
  const saved = id ? await prisma.product.update({ where: { id }, data }) : await prisma.product.create({ data });

  const stock = num(fd, 'stock');
  if (stock != null) {
    // Qoldiq ombor jurnali orqali yoziladi, shunda /admin/inventory/movements da ko'rinadi
    await setStock({ productId: saved.id, quantity: Math.max(0, Math.floor(stock)), reason: 'Mahsulot kartasi', createdBy: user.name });
    revalidatePath('/admin/inventory');
  }
  revalidateTag('products');
  revalidatePath('/[lang]', 'layout');
  redirect(`/admin/products/${saved.id}?saved=1`);
}

export async function archiveProduct(fd: FormData) {
  await requireStaff('products');
  const id = Number(fd.get('id'));
  await prisma.product.update({ where: { id }, data: { status: 'archived' } });
  revalidateTag('products');
  revalidatePath('/[lang]', 'layout');
  redirect('/admin/products?archived=1');
}
