import Link from 'next/link';
import type { CategoryItem, ProductCard as Card } from '@/lib/catalog';
import type { Dict } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n/config';
import { ProductCard } from './ProductCard';
import { Pagination } from './Pagination';
import { Markdown } from './Markdown';

export function CatalogView({
  locale,
  t,
  title,
  intro,
  categories,
  activeSlug,
  result,
  q,
  sort,
  basePath,
}: {
  locale: Locale;
  t: Dict;
  title: string;
  intro?: string;
  categories: CategoryItem[];
  activeSlug?: string;
  result: { items: Card[]; total: number; page: number; pages: number };
  q?: string;
  sort: string;
  basePath: string;
}) {
  const qs = (extra: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, sort: sort === 'new' ? undefined : sort, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && !(k === 'page' && Number(v) === 1)) sp.set(k, String(v));
    const s = sp.toString();
    return `${basePath}${s ? `?${s}` : ''}`;
  };
  const labels = { add: t.product.addToCart, added: t.product.added, minQty: t.product.minQty, pcs: t.common.pcs };
  return (
    <div className="container-site py-8 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      <aside className="mb-6 lg:mb-0">
        <h2 className="mb-3 font-semibold">{t.home.categories}</h2>
        <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible">
          <li>
            <Link href={`/${locale}/catalog`} className={`block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${!activeSlug ? 'bg-brand-500 text-white' : 'hover:bg-slate-200'}`}>{t.catalog.all}</Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${locale}/catalog/${c.slug}`}
                className={`flex justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${c.slug === activeSlug ? 'bg-brand-500 text-white' : 'hover:bg-slate-200'}`}
              >
                <span>{c.name}</span>
                <span className="opacity-60">{c.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <h1 className="h1">{title}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{result.total} {t.catalog.found}</p>
          <form className="flex items-center gap-2 text-sm" action={basePath}>
            {q && <input type="hidden" name="q" value={q} />}
            <label htmlFor="sort" className="text-slate-500">{t.catalog.sort}</label>
            <select id="sort" name="sort" defaultValue={sort} className="input w-auto py-1.5">
              <option value="new">{t.catalog.sortNew}</option>
              <option value="cheap">{t.catalog.sortCheap}</option>
              <option value="expensive">{t.catalog.sortExpensive}</option>
            </select>
            <button className="btn-ghost px-3 py-1.5 text-sm">OK</button>
          </form>
        </div>
        {result.items.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {result.items.map((p) => <ProductCard key={p.id} p={p} currency={t.common.sum} labels={labels} />)}
          </div>
        ) : (
          <p className="mt-10 text-center text-slate-500">{t.catalog.empty}</p>
        )}
        <Pagination page={result.page} pages={result.pages} hrefFor={(n) => qs({ page: n })} labels={{ prev: t.common.prev, next: t.common.next }} />
        {intro && (
          <div className="card mt-10 p-6">
            <Markdown source={intro} />
          </div>
        )}
      </section>
    </div>
  );
}
