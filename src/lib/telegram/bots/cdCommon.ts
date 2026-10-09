import { formatPrice } from '@/lib/format';

/**
 * Mijoz va haydovchi botlari uchun umumiy mayda yordamchilar.
 * 'server-only' emas — testlarda ham ishlatiladi; bu yerda baza yoki Telegram chaqiruvi yo'q.
 */

export const fmtSum = (v: unknown) => formatPrice(v as number, "so'm");

/** Matndan musbat son: "120,5 kg" → 120.5, "💵 Hammasi: 150 000" → 150000; bo'lmasa null */
export function parseNumber(text: string): number | null {
  if (text.trim().startsWith('-')) return null;
  const raw = text.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Telegram foydalanuvchisining ko'rinadigan ismi (first + last) */
export const tgName = (u: { first_name: string; last_name?: string }) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ').trim().slice(0, 100);

/** "/start abc" → "abc" (buyruq argumenti) */
export const commandArg = (text: string) => text.trim().split(/\s+/)[1] ?? '';

/** Karta muddati: "12/27", "12.2027", "1227" → {month, year}; noto'g'ri bo'lsa null */
export function parseExpiry(text: string): { month: number; year: number } | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 4 && digits.length !== 6) return null;
  const month = Number(digits.slice(0, 2));
  const year = digits.length === 4 ? 2000 + Number(digits.slice(2)) : Number(digits.slice(2));
  if (month < 1 || month > 12 || year < 2024 || year > 2060) return null;
  return { month, year };
}

/** Karta raqami: faqat 16 ta raqam bo'lsa {first4, last4}; to'liq raqam saqlanmaydi */
export function cardParts(text: string): { first4: string; last4: string } | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 16) return null;
  return { first4: digits.slice(0, 4), last4: digits.slice(-4) };
}

/** Bir qatorga n tadan bo'lib chiqish (inline tugmalar uchun) */
export function chunk<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Reply-klaviatura tugmasidagi belgini olib tashlash: "✅ Ali" → "Ali" */
export const stripMark = (text: string) => text.replace(/^[^\p{L}\p{N}]+/u, '').trim();
