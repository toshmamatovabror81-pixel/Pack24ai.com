import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { pickText, type Locale } from './i18n/config';
import { toNumber } from './format';
import { slugify } from './slug';
import { parseTiers, type PriceTier } from './pricing';

export type ProductCard = {
  id: number;
  name: string;
  href: string;
  image: string;
  price: number;
  originalPrice: number | null;
  minQuantity: number;
  inStock: boolean;
  categorySlug: string | null;
};

export type ProductFull = ProductCard & {
  description: string;
  gallery: string[];
  sku: string | null;
  specs: [string, string][];
  tiers: PriceTier[];
  categoryName: string | null;
  rating: number;
  reviews: number;
  updatedAt: Date;
};

export type CategoryItem = {
  id: number;
  slug: string;
  name: string;
  description: string;
  image: string | null;
  productCount: number;
};

const NO_IMAGE = '/images/no-image.svg';

type ProductRow = Prisma.ProductGetPayload<{ include: { categoryRel: true } }>;

export function productHref(locale: Locale, id: number, name: string) {
  const slug = slugify(name);
  return `/${locale}/product/${id}${slug ? `-${slug}` : ''}`;
}

function productName(p: { name: string; nameI18n: Prisma.JsonValue }, locale: Locale) {
  return pickText(p.nameI18n, locale, p.name);
}

function toCard(p: ProductRow, locale: Locale): ProductCard {
  const name = productName(p, locale);
  return {
    id: p.id,
    name,
    // Manzil har doim o'zbekcha nomdan: til almashganda ham bir xil qoladi
    href: productHref(locale, p.id, pickText(p.nameI18n, 'uz', p.name)),
    image: p.image || NO_IMAGE,
    price: toNumber(p.price),
    originalPrice: p.originalPrice ? toNumber(p.originalPrice) : null,
    minQuantity: p.minQuantity,
    inStock: p.inStock,
    categorySlug: p.categoryRel?.slug ?? p.category ?? null,
  };
}

function specsOf(value: Prisma.JsonValue, locale: Locale): [string, string][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const obj = value as Record<string, unknown>;
  // Ikki shakl: {"Material":"Karton"} yoki {"uz":{...},"ru":{...}}
  const localized = obj[locale] ?? obj.uz;
  const source = localized && typeof localized === 'object' && !Array.isArray(localized) ? (localized as Record<string, unknown>) : obj;
  return Object.entries(source)
    .filter(([k, v]) => !['uz', 'ru', 'en'].includes(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => [k, String(v)]);
}

const ACTIVE: Prisma.ProductWhereInput = { status: 'active' };

export type CatalogQuery = {
  locale: Locale;
  categorySlug?: string;
  q?: string;
  sort?: 'new' | 'cheap' | 'expensive';
  page?: number;
  perPage?: number;
};

export async function listProducts({ locale, categorySlug, q, sort = 'new', page = 1, perPage = 24 }: CatalogQuery) {
  const where: Prisma.ProductWhereInput = { ...ACTIVE };
  if (categorySlug) {
    where.OR = [{ categoryRel: { slug: categorySlug } }, { category: categorySlug }];
  }
  const term = q?.trim();
  if (term) {
    where.AND = [
      {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      },
    ];
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === 'cheap' ? [{ price: 'asc' }] : sort === 'expensive' ? [{ price: 'desc' }] : [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
  const safePage = Math.max(1, Math.floor(page));
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip: (safePage - 1) * perPage, take: perPage, include: { categoryRel: true } }),
    prisma.product.count({ where }),
  ]);
  return { items: rows.map((r) => toCard(r, locale)), total, page: safePage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getProduct(id: number, locale: Locale): Promise<ProductFull | null> {
  const p = await prisma.product.findFirst({ where: { id, ...ACTIVE }, include: { categoryRel: true } });
  if (!p) return null;
  const gallery = Array.isArray(p.gallery) ? p.gallery.filter((g): g is string => typeof g === 'string' && !!g) : [];
  return {
    ...toCard(p, locale),
    description: pickText(p.descriptionI18n, locale, p.description ?? ''),
    gallery: [p.image || NO_IMAGE, ...gallery.filter((g) => g !== p.image)],
    sku: p.sku,
    specs: specsOf(p.specifications, locale),
    tiers: parseTiers(p.priceTiers),
    categoryName: p.categoryRel ? pickText(p.categoryRel.nameI18n, locale, p.categoryRel.name) : null,
    rating: p.rating,
    reviews: p.reviews,
    updatedAt: p.updatedAt,
  };
}

export async function relatedProducts(product: ProductFull, locale: Locale, take = 4) {
  if (!product.categorySlug) return [];
  const rows = await prisma.product.findMany({
    where: { ...ACTIVE, id: { not: product.id }, OR: [{ categoryRel: { slug: product.categorySlug } }, { category: product.categorySlug }] },
    take,
    orderBy: { createdAt: 'desc' },
    include: { categoryRel: true },
  });
  return rows.map((r) => toCard(r, locale));
}

const loadCategories = unstable_cache(
  async () => {
    const [cats, counts] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.product.groupBy({ by: ['categoryId'], where: ACTIVE, _count: { _all: true } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return cats.map((c) => ({ ...c, productCount: countMap.get(c.id) ?? 0 }));
  },
  ['categories'],
  { tags: ['categories', 'products'], revalidate: 600 },
);

export async function listCategories(locale: Locale): Promise<CategoryItem[]> {
  const cats = await loadCategories();
  return cats
    .filter((c) => c.productCount > 0)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: pickText(c.nameI18n, locale, c.name),
      description: pickText(c.descriptionI18n, locale, ''),
      image: c.image,
      productCount: c.productCount,
    }));
}

export async function getCategory(slug: string, locale: Locale) {
  const all = await listCategories(locale);
  return all.find((c) => c.slug === slug) ?? null;
}

export async function featuredProducts(locale: Locale, take = 8) {
  const rows = await prisma.product.findMany({
    where: ACTIVE,
    orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
    take,
    include: { categoryRel: true },
  });
  return rows.map((r) => toCard(r, locale));
}
