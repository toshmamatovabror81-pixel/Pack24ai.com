'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';

export type NotFoundTexts = Record<Locale, { title: string; text: string; home: string; catalog: string }>;

/**
 * 404 sahifasining matni. Next'ning not-found sahifasi parametr olmaydi, shuning uchun til manzildan (/ru/...) aniqlanadi:
 * rus yoki ingliz saytidagi mavjud bo'lmagan sahifa o'zbekcha chiqib, /uz ga qaytarib yubormaydi. Server tomonida ham shu
 * yo'l bilan chiziladi (usePathname SSR da ham so'ralgan manzilni beradi) — matn "sakramaydi".
 */
export function NotFoundBody({ texts }: { texts: NotFoundTexts }) {
  const first = (usePathname() ?? '').split('/')[1];
  const locale: Locale = isLocale(first) ? first : defaultLocale;
  const t = texts[locale];
  return (
    <div className="container-site py-20 text-center">
      <p className="text-6xl font-black text-brand-500">404</p>
      <h1 className="h1 mt-4">{t.title}</h1>
      <p className="mt-2 text-slate-600">{t.text}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href={`/${locale}`} className="btn-primary">{t.home}</Link>
        <Link href={`/${locale}/catalog`} className="btn-ghost">{t.catalog}</Link>
      </div>
    </div>
  );
}
