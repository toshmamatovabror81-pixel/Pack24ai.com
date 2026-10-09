/** Toshkent kuni chegaralari (sof funksiyalar — server va testda ishlaydi) */

const TZ_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent (UTC+5, DST yo'q)

/** Toshkent bo'yicha bugungi kun boshlanishi (haqiqiy vaqt nuqtasi) */
export function tashkentDayStart(now = new Date()): Date {
  const local = new Date(now.getTime() + TZ_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_MS);
}

/** 'YYYY-MM-DD' → Toshkent kuni boshlanishi; noto'g'ri bo'lsa null */
export function parseDayStart(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m - 1, d) - TZ_MS;
  return Number.isFinite(t) && new Date(t + TZ_MS).getUTCMonth() === m - 1 ? new Date(t) : null;
}

/** Kun oxiri (keyingi kun boshi) */
export const dayEnd = (start: Date) => new Date(start.getTime() + 24 * 60 * 60 * 1000);
