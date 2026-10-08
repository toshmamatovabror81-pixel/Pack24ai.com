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
  const body = pickText(s.privacyText, locale);
  return pageMetadata({
    locale,
    path: '/privacy',
    title: t.pages.privacy,
    description: (body || t.meta.description).replace(/[*#[\]-]/g, '').slice(0, 160),
    noindex: !body,
  });
}

export default async function PrivacyPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return <TextPage title={t.pages.privacy} body={pickText(s.privacyText, locale)} fallback={fallbackText('privacy', locale)} />;
}
