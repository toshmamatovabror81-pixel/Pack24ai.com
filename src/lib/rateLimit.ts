import 'server-only';
import { headers } from 'next/headers';

// Server xotirasidagi oddiy cheklov (har bir server nusxasi uchun alohida). Spam va parol tanlashni sekinlashtiradi.
const buckets = new Map<string, { count: number; reset: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
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
