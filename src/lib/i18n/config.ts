export const locales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'uz';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

/** Open Graph / hreflang uchun til kodlari */
export const localeTags: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

export type I18nText = Partial<Record<Locale, string>>;

/** Bazadagi {"uz","ru","en"} JSON maydonidan matn olish, bo'lmasa zaxira matn */
export function pickText(value: unknown, locale: Locale, fallback = ''): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    const own = v[locale];
    if (typeof own === 'string' && own.trim()) return own;
    const uz = v.uz;
    if (typeof uz === 'string' && uz.trim()) return uz;
  }
  return fallback;
}
