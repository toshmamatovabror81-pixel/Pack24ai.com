import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';
import { locales, localeTags } from '@/lib/i18n/config';
import { productHref } from '@/lib/catalog';
import { pickText } from '@/lib/i18n/config';
import { siteUrl } from '@/lib/site';

// Build vaqtida emas, so'rov kelganda bazadan yasaladi va 1 soat keshlanadi
export const dynamic = 'force-dynamic';

const STATIC = ['', '/catalog', '/wholesale', '/delivery', '/payment', '/contacts', '/faq', '/reviews', '/blog', '/recycling'];

function entry(path: string, lastModified?: Date, priority = 0.5): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTags[l]] = `${siteUrl()}/${l}${path}`;
  return { url: `${siteUrl()}/uz${path}`, lastModified, priority, alternates: { languages } };
}

const loadEntries = unstable_cache(
  async () => {
    const [products, categories, posts] = await Promise.all([
      prisma.product.findMany({ where: { status: 'active' }, select: { id: true, name: true, nameI18n: true, updatedAt: true } }),
      prisma.category.findMany({ where: { isActive: true, products: { some: { status: 'active' } } }, select: { slug: true, updatedAt: true } }),
      prisma.post.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return [
      ...categories.map((c) => entry(`/catalog/${c.slug}`, c.updatedAt, 0.8)),
      ...products.map((p) => entry(productHref('uz', p.id, pickText(p.nameI18n, 'uz', p.name)).slice(3), p.updatedAt, 0.7)),
      ...posts.map((p) => entry(`/blog/${p.slug}`, p.updatedAt, 0.5)),
    ];
  },
  ['sitemap-entries'],
  { revalidate: 3600, tags: ['products', 'categories', 'posts'] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamicEntries = await loadEntries().catch(() => []);
  return [...STATIC.map((p) => entry(p, undefined, p === '' ? 1 : 0.6)), ...dynamicEntries];
}
