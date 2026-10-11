import 'server-only';
import { headers } from 'next/headers';

// Server xotirasidagi oddiy cheklov (har bir server nusxasi uchun alohida). Spam va parol tanlashni sekinlashtiradi.
const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Mijoz IP manzili. X-Forwarded-For dagi OXIRGI element olinadi: uni oldimizdagi proksi o'zi yozadi (nginx
 * $proxy_add_x_forwarded_for mijozning manzilini oxiriga qo'shadi, Caddy sarlavhani butunlay almashtiradi). Birinchi elementni
 * mijoz o'zi yuborishi mumkin — u olinsa, har so'rovda boshqa manzil yozib parol tanlash va spam cheklovlarini chetlab o'tish
 * mumkin bo'lardi. X-Real-IP faqat zaxira: Caddy mijoz yuborgan X-Real-IP ni o'zgartirmay uzatadi, shuning uchun u birinchi
 * o'rinda ishlatilmaydi.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const last = xff.split(',').pop()?.trim();
    if (last) return last;
  }
  return (h.get('x-real-ip') ?? 'unknown').trim();
}

export async function rateLimit(scope: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `${scope}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
