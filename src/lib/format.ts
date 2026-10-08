import type { Locale } from './i18n/config';

type DecimalLike = { toString(): string } | number | string | null | undefined;

/** Prisma Decimal / string / number -> number (so'm) */
export function toNumber(value: DecimalLike): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** 12 500 so'm */
export function formatPrice(value: DecimalLike, currency: string): string {
  const n = Math.round(toNumber(value) * 100) / 100;
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(n)
    .replace(/ /g, ' ');
  return `${formatted} ${currency}`;
}

export function formatDate(value: Date | string, locale: Locale, withTime = false): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

/** +998 90 123 45 67 ko'rinishiga keltirish uchun faqat raqamlar: 998901234567 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 9) return `998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return digits;
  return null;
}

export function displayPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 12) return digits;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}
