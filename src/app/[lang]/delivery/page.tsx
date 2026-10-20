import { getSettings } from '@/lib/settings';
import { pickText } from '@/lib/i18n/config';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { TextPage } from '@/components/site/TextPage';
import { fallbackText } from '@/lib/fallbackText';

export const revalidate = 300;

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  const body = pickText(s.deliveryText, locale);
  return pageMetadata({
    locale,
    path: '/delivery',
    title: t.pages.delivery,
    description: (body || t.meta.description).replace(/[*#[\]-]/g, '').slice(0, 160),
  });
}

export default async function DeliveryPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return <TextPage title={t.pages.delivery} body={pickText(s.deliveryText, locale)} fallback={fallbackText('delivery', locale)} />;
}
