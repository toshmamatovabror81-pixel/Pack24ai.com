import { notFound } from 'next/navigation';
import { getCategory, listCategories, listProducts } from '@/lib/catalog';
import { resolveLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { parseSort, str } from '@/lib/params';
import { CatalogView } from '@/components/site/CatalogView';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };


export const revalidate = 300;

const cityWord = { uz: 'Toshkentda', ru: 'в Ташкенте', en: 'in Tashkent' } as const;

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getCategory(slug, locale);
  if (!cat) return {};
  const firstLine = cat.description.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.replace(/[*#[\]]/g, '');
  return pageMetadata({
    locale,
    path: `/catalog/${slug}`,
    title: `${cat.name} ${cityWord[locale]}`,
    description: (firstLine || `${cat.name}: ${t.meta.description}`).slice(0, 160),
    image: cat.image,
    noindex: !!str(sp.page) || !!str(sp.sort),
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const { slug } = await params;
  const sp = await searchParams;
  const sort = parseSort(str(sp.sort));
  const page = Number(str(sp.page)) || 1;
  const [categories, cat] = await Promise.all([listCategories(locale), getCategory(slug, locale)]);
  if (!cat) notFound();
  const result = await listProducts({ locale, categorySlug: slug, sort, page });
  return (
    <>
      <div className="container-site pt-6">
        <Breadcrumbs items={[{ name: t.nav.home, href: `/${locale}` }, { name: t.nav.catalog, href: `/${locale}/catalog` }, { name: cat.name }]} />
      </div>
      <CatalogView
        locale={locale}
        t={t}
        title={`${cat.name} ${cityWord[locale]}`}
        intro={cat.description}
        categories={categories}
        activeSlug={slug}
        result={result}
        sort={sort}
        basePath={`/${locale}/catalog/${slug}`}
      />
    </>
  );
}
