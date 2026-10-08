import { SiteImage as Image } from '@/components/site/SiteImage';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { CheckCircle2, Clock } from 'lucide-react';
import { getProduct, relatedProducts } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { resolveLocale } from '@/lib/locale';
import { jsonLdScript, pageMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/site';
import { idFromParam } from '@/lib/slug';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';
import { Markdown } from '@/components/site/Markdown';
import { ProductCard } from '@/components/site/ProductCard';
import { ProductBuyBox } from '@/components/cart/ProductBuyBox';

type Props = { params: Promise<{ lang: string; id: string }> };

export const revalidate = 300;

async function load(params: Props['params']) {
  const { locale, t } = await resolveLocale(params);
  const { id: raw } = await params;
  const id = idFromParam(raw);
  if (!id) notFound();
  const product = await getProduct(id, locale);
  if (!product) notFound();
  return { locale, t, raw, product };
}

export async function generateMetadata({ params }: Props) {
  const { locale, product } = await load(params);
  const desc = (product.description || product.name).replace(/[*#[\]]/g, '').slice(0, 160);
  return pageMetadata({ locale, path: product.href.replace(`/${locale}`, ''), title: product.name, description: desc, image: product.image });
}

export default async function ProductPage({ params }: Props) {
  const { locale, t, raw, product } = await load(params);
  // Eski /product/12 yoki boshqa slug -> kanonik manzil
  if (`/${locale}/product/${raw}` !== product.href) permanentRedirect(product.href);
  const related = await relatedProducts(product, locale);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.gallery.filter((g) => g.startsWith('http')),
    description: product.description || product.name,
    sku: product.sku || String(product.id),
    brand: { '@type': 'Brand', name: 'Pack24' },
    offers: {
      '@type': 'Offer',
      url: `${siteUrl()}${product.href}`,
      priceCurrency: 'UZS',
      price: product.price,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: product.minQuantity },
      seller: { '@type': 'Organization', name: 'Pack24' },
    },
    ...(product.reviews > 0 && product.rating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviews } }
      : {}),
  };
  const labels = { add: t.product.addToCart, added: t.product.added, minQty: t.product.minQty, pcs: t.common.pcs };
  return (
    <div className="container-site py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <Breadcrumbs
        items={[
          { name: t.nav.home, href: `/${locale}` },
          { name: t.nav.catalog, href: `/${locale}/catalog` },
          ...(product.categoryName && product.categorySlug ? [{ name: product.categoryName, href: `/${locale}/catalog/${product.categorySlug}` }] : []),
          { name: product.name },
        ]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="card relative aspect-square overflow-hidden">
            <Image src={product.gallery[0]} alt={product.name} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-contain p-6" />
          </div>
          {product.gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.gallery.slice(1, 6).map((g) => (
                <div key={g} className="card relative aspect-square overflow-hidden">
                  <Image src={g} alt="" fill sizes="20vw" className="object-contain p-1" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="h1">{product.name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
            {product.sku && <span>{t.product.sku}: {product.sku}</span>}
            <span className={`inline-flex items-center gap-1 ${product.inStock ? 'text-emerald-700' : 'text-amber-700'}`}>
              {product.inStock ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {product.inStock ? t.product.inStock : t.product.outOfStock}
            </span>
          </div>
          <p className="mt-6 text-3xl font-extrabold">
            {formatPrice(product.price, t.common.sum)}
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="ml-3 text-lg font-normal text-slate-400 line-through">{formatPrice(product.originalPrice, t.common.sum)}</span>
            )}
          </p>
          {product.minQuantity > 1 && <p className="mt-1 text-sm text-slate-500">{t.product.minQty}: {product.minQuantity} {t.common.pcs}</p>}

          {product.tiers.length > 0 && (
            <div className="card mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold">{t.product.wholesale}</h2>
              <ul className="space-y-1 text-sm">
                {product.tiers.map((tier) => (
                  <li key={tier.minQty} className="flex justify-between">
                    <span>{tier.minQty} {t.product.wholesaleFrom}</span>
                    <span className="font-semibold">{formatPrice(tier.price, t.common.sum)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <ProductBuyBox
              item={{ productId: product.id, name: product.name, image: product.image, price: product.price, minQuantity: product.minQuantity, href: product.href }}
              tiers={product.tiers}
              labels={{ add: t.product.addToCart, added: t.product.added, quantity: t.product.quantity }}
              currency={t.common.sum}
            />
          </div>
          <Link href={`/${locale}/wholesale?product=${product.id}`} className="mt-4 inline-block text-sm font-semibold text-brand-500 hover:underline">
            {t.product.askPrice} →
          </Link>

          {product.specs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 font-semibold">{t.product.specs}</h2>
              <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white text-sm">
                {product.specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
      {product.description && (
        <section className="card mt-10 p-6">
          <h2 className="mb-3 text-xl font-semibold">{t.product.description}</h2>
          <Markdown source={product.description} />
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">{t.product.related}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} p={r} currency={t.common.sum} labels={labels} />)}
          </div>
        </section>
      )}
    </div>
  );
}
