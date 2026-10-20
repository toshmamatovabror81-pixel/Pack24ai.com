import { getDict } from '@/lib/i18n';
import { locales } from '@/lib/i18n/config';
import { NotFoundBody, type NotFoundTexts } from '@/components/site/NotFoundBody';

/** Next not-found sahifasi parametr olmaydi: uch tildagi matn beriladi, tilni NotFoundBody manzildan tanlaydi */
export default function NotFound() {
  const texts = Object.fromEntries(
    locales.map((l) => {
      const t = getDict(l);
      return [l, { title: t.common.notFound, text: t.common.notFoundText, home: t.common.toHome, catalog: t.nav.catalog }];
    }),
  ) as NotFoundTexts;
  return <NotFoundBody texts={texts} />;
}
