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
  const body = pickText(s.paymentText, locale);
  return pageMetadata({
    locale,
    path: '/payment',
    title: t.pages.payment,
    description: (body || t.meta.description).replace(/[*#[\]-]/g, '').slice(0, 160),
  });
}

export default async function PaymentPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return <TextPage title={t.pages.payment} body={pickText(s.paymentText, locale)} fallback={fallbackText('payment', locale)} />;
}
