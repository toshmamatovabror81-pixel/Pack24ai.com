import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { isValidLat, isValidLng } from '@/lib/recycling/geo';

export const dynamic = 'force-dynamic';

/**
 * Teskari geokodlash (koordinata → manzil), server orqali: brauzer Nominatim'ga to'g'ridan-to'g'ri murojaat qilmaydi
 * (CSP va User-Agent talabi). Natija 4 xonali aniqlikda (≈10 m) xotirada keshlanadi.
 */
const cache = new Map<string, { address: string; at: number }>();
const TTL = 24 * 60 * 60_000;
// Tashqi xizmat ishlamasa 60 s davomida qayta so'ramaymiz (har bosishda 6 s kutmaslik uchun)
let failedUntil = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!isValidLat(lat) || !isValidLng(lng)) return NextResponse.json({ ok: false, error: 'coords' }, { status: 400 });
  if (!(await rateLimit('geo', 60, 10 * 60_000))) return NextResponse.json({ ok: false, error: 'rate' }, { status: 429 });
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - TTL) return NextResponse.json({ ok: true, address: hit.address, cached: true });
  if (failedUntil > Date.now()) return NextResponse.json({ ok: false, error: 'geocode', message: 'vaqtincha ishlamayapti' }, { status: 502 });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=uz,ru`, {
      headers: { 'User-Agent': 'pack24.uz recycling form (info@pack24.uz)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = data.address ?? {};
    const short = [a.road && `${a.road}${a.house_number ? ` ${a.house_number}` : ''}`, a.neighbourhood || a.suburb, a.city || a.town || a.village || a.county]
      .filter(Boolean)
      .join(', ');
    const address = (short || data.display_name || '').slice(0, 300);
    if (address) {
      cache.set(key, { address, at: Date.now() });
      if (cache.size > 5000) for (const [k, v] of cache) if (v.at < Date.now() - TTL) cache.delete(k);
    }
    return NextResponse.json({ ok: true, address });
  } catch (e) {
    failedUntil = Date.now() + 60_000;
    return NextResponse.json({ ok: false, error: 'geocode', message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
