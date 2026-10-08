import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { locales, localeTags } from '@/lib/i18n/config';
import { productHref } from '@/lib/catalog';
import { pickText } from '@/lib/i18n/config';
import { siteUrl } from '@/lib/site';

export const revalidate = 3600;

const STATIC = ['', '/catalog', '/wholesale', '/delivery', '/payment', '/contacts', '/faq', '/reviews', '/blog', '/recycling'];

function entry(path: string, lastModified?: Date, priority = 0.5): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTags[l]] = `${siteUrl()}/${l}${path}`;
  return { url: `${siteUrl()}/uz${path}`, lastModified, priority, alternates: { languages } };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, posts] = await Promise.all([
    prisma.product.findMany({ where: { status: 'active' }, select: { id: true, name: true, nameI18n: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true, products: { some: { status: 'active' } } }, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
  ]).catch(() => [[], [], []] as const);
  return [
    ...STATIC.map((p) => entry(p, undefined, p === '' ? 1 : 0.6)),
    ...categories.map((c) => entry(`/catalog/${c.slug}`, c.updatedAt, 0.8)),
    ...products.map((p) => entry(productHref('uz', p.id, pickText(p.nameI18n, 'uz', p.name)).slice(3), p.updatedAt, 0.7)),
    ...posts.map((p) => entry(`/blog/${p.slug}`, p.updatedAt, 0.5)),
  ];
}
