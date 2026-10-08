import { listCategories, listProducts } from '@/lib/catalog';
import { resolveLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { parseSort, str } from '@/lib/params';
import { CatalogView } from '@/components/site/CatalogView';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };


export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const sp = await searchParams;
  const q = str(sp.q);
  return pageMetadata({
    locale,
    path: '/catalog',
    title: q ? `${t.catalog.searchResults}: ${q}` : t.catalog.title,
    description: t.meta.description,
    noindex: !!q || !!str(sp.page) || !!str(sp.sort),
  });
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const sp = await searchParams;
  const q = str(sp.q)?.slice(0, 100);
  const sort = parseSort(str(sp.sort));
  const page = Number(str(sp.page)) || 1;
  const [categories, result] = await Promise.all([listCategories(locale), listProducts({ locale, q, sort, page })]);
  return (
    <CatalogView
      locale={locale}
      t={t}
      title={q ? `${t.catalog.searchResults}: «${q}»` : t.catalog.title}
      categories={categories}
      result={result}
      q={q}
      sort={sort}
      basePath={`/${locale}/catalog`}
    />
  );
}
