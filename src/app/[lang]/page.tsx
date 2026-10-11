import Link from 'next/link';
import { SiteImage as Image } from '@/components/site/SiteImage';
import { BadgePercent, Printer, Truck, Wallet } from 'lucide-react';
import { prisma } from '@/lib/db';
import { featuredProducts, listCategories } from '@/lib/catalog';
import { pickText } from '@/lib/i18n/config';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { ProductCard } from '@/components/site/ProductCard';

export const revalidate = 300;

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/', title: `${t.meta.siteName}: ${t.meta.tagline}`, description: t.meta.description });
}

export default async function HomePage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const p = (path: string) => `/${locale}${path}`;
  const [categories, products, banners, posts] = await Promise.all([
    listCategories(locale),
    featuredProducts(locale, 8),
    prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 3 }),
    prisma.post.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 3 }),
  ]);
  const cardLabels = { add: t.product.addToCart, added: t.product.added, minQty: t.product.minQty, pcs: t.common.pcs };
  const why = [
    { icon: BadgePercent, title: t.home.why1t, text: t.home.why1 },
    { icon: Printer, title: t.home.why2t, text: t.home.why2 },
    { icon: Truck, title: t.home.why3t, text: t.home.why3 },
    { icon: Wallet, title: t.home.why4t, text: t.home.why4 },
  ];
  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="container-site grid items-center gap-8 py-12 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">{t.home.heroTitle}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">{t.home.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={p('/catalog')} className="btn bg-white text-brand-700 hover:bg-slate-100">{t.home.heroCta}</Link>
              <Link href={p('/wholesale')} className="btn-accent">{t.home.heroCta2}</Link>
            </div>
          </div>
          {banners.length > 0 ? (
            <div className="grid gap-4">
              {banners.map((b) => {
                const inner = (
                  <div className="relative overflow-hidden rounded-2xl bg-white/10 p-6">
                    {b.image && <Image src={b.image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover opacity-40" />}
                    <div className="relative">
                      <p className="text-xl font-bold">{pickText(b.titleI18n, locale)}</p>
                      <p className="mt-1 text-white/85">{pickText(b.textI18n, locale)}</p>
                    </div>
                  </div>
                );
                return b.href ? <Link key={b.id} href={b.href.startsWith('/') ? p(b.href) : b.href}>{inner}</Link> : <div key={b.id}>{inner}</div>;
              })}
            </div>
          ) : (
            <div className="hidden grid-cols-2 gap-4 md:grid">
              {products.slice(0, 4).map((pr) => (
                <Link key={pr.id} href={pr.href} className="relative aspect-square overflow-hidden rounded-2xl bg-white">
                  <Image src={pr.image} alt={pr.name} fill sizes="25vw" className="object-contain p-4" priority />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container-site py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t.home.categories}</h2>
          <Link href={p('/catalog')} className="text-sm font-semibold text-brand-500 hover:underline">{t.catalog.all} →</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[...categories].sort((a, b) => b.productCount - a.productCount).slice(0, 12).map((c) => (
            <li key={c.id}>
              <Link href={p(`/catalog/${c.slug}`)} className="card flex h-full items-center justify-between gap-2 px-4 py-3 hover:border-brand-500 hover:shadow">
                <span className="font-medium">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">{c.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-site pb-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t.home.popular}</h2>
          <Link href={p('/catalog')} className="text-sm font-semibold text-brand-500 hover:underline">{t.catalog.all} →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((pr) => <ProductCard key={pr.id} p={pr} currency={t.common.sum} labels={cardLabels} />)}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="container-site">
          <h2 className="mb-8 text-2xl font-bold">{t.home.why}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {why.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon className="h-8 w-8 text-accent-500" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site py-12">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-brand-700 p-8 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">{t.home.ctaTitle}</h2>
            <p className="mt-2 text-white/85">{t.home.ctaText}</p>
          </div>
          <Link href={p('/wholesale')} className="btn-accent shrink-0">{t.home.heroCta2}</Link>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="container-site pb-4">
          <h2 className="mb-6 text-2xl font-bold">{t.home.blog}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={p(`/blog/${post.slug}`)} className="card overflow-hidden hover:shadow-lg">
                {post.cover && (
                  <div className="relative aspect-video">
                    <Image src={post.cover} alt="" fill sizes="33vw" className="object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{pickText(post.titleI18n, locale)}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pickText(post.excerptI18n, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
