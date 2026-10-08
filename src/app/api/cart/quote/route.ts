import { NextResponse, type NextRequest } from 'next/server';
import { buildQuote, sanitizeCart } from '@/lib/quote';
import { isLocale } from '@/lib/i18n/config';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const locale = typeof body.locale === 'string' && isLocale(body.locale) ? body.locale : 'uz';
  const quote = await buildQuote(sanitizeCart(body.items), {
    locale,
    promoCode: typeof body.promo === 'string' ? body.promo.slice(0, 40) : null,
    deliveryMethod: body.delivery === 'pickup' ? 'pickup' : 'courier',
  });
  return NextResponse.json(quote);
}
