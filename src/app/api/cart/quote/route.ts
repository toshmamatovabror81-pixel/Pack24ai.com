import { NextResponse, type NextRequest } from 'next/server';
import { buildQuote, sanitizeCart } from '@/lib/quote';
import { isLocale } from '@/lib/i18n/config';
import { rateLimit } from '@/lib/rateLimit';

const tooMany = () => NextResponse.json({ error: 'rate' }, { status: 429 });

/**
 * Savat narxi (ochiq API, sessiyasiz). Promokodli so'rovlar cheklanadi: aks holda kodlarni ro'yxat bo'yicha terib topish
 * mumkin bo'lardi va checkout'dagi cheklov befoyda qolardi. Oddiy xaridor 10 daqiqada 60 ta promokodli so'rovga yetmaydi;
 * 429 javobida savat oldingi narxni ko'rsatib turadi (useQuote). Umumiy cheklov bazaga bosimni kamaytiradi (so'rovlar 250 ms
 * kechikish bilan ketadi, bir mijoz daqiqada 300 taga yetmaydi).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const locale = typeof body.locale === 'string' && isLocale(body.locale) ? body.locale : 'uz';
  const promoCode = typeof body.promo === 'string' ? body.promo.slice(0, 40).trim() : '';
  if (!(await rateLimit('quote', 300, 60_000))) return tooMany();
  if (promoCode && !(await rateLimit('quote-promo', 60, 10 * 60_000))) return tooMany();
  const quote = await buildQuote(sanitizeCart(body.items), {
    locale,
    promoCode: promoCode || null,
    deliveryMethod: body.delivery === 'pickup' ? 'pickup' : 'courier',
  });
  return NextResponse.json(quote);
}
