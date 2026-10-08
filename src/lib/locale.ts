import 'server-only';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from './i18n/config';
import { getDict } from './i18n';

export type LangParams = { params: Promise<{ lang: string }> };

/** Sahifa parametridan til va lug'at */
export async function resolveLocale(params: Promise<{ lang: string }>): Promise<{ locale: Locale; t: ReturnType<typeof getDict> }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { locale: lang, t: getDict(lang) };
}
