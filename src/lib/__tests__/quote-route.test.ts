import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * /api/cart/quote — sessiyasiz ochiq API. Promokodli so'rovlar IP bo'yicha cheklanadi: aks holda kodlarni ro'yxat bo'yicha
 * terib topish mumkin edi (checkout'dagi cheklov shunda befoyda qolardi). Narx hisobi (buildQuote) va cheklov soxta.
 */
const s = vi.hoisted(() => ({ limits: [] as [string, number, number][], allow: {} as Record<string, boolean>, quotes: [] as unknown[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: async (scope: string, limit: number, windowMs: number) => {
    s.limits.push([scope, limit, windowMs]);
    return s.allow[scope] ?? true;
  },
}));
vi.mock('@/lib/quote', () => ({
  sanitizeCart: (items: unknown) => (Array.isArray(items) ? items : []),
  buildQuote: async (items: unknown, opts: unknown) => { s.quotes.push([items, opts]); return { subtotal: 1000, total: 1000, promoError: false }; },
}));

const { POST } = await import('@/app/api/cart/quote/route');
const call = (body: unknown) => POST(new Request('https://pack24.uz/api/cart/quote', { method: 'POST', body: JSON.stringify(body) }) as never);

beforeEach(() => {
  s.limits.length = 0;
  s.quotes.length = 0;
  s.allow = {};
});

describe('/api/cart/quote cheklovi', () => {
  it('promokodsiz so\'rov faqat umumiy cheklovdan o\'tadi; promokodli — promokod cheklovidan ham', async () => {
    let res = await call({ items: [{ productId: 1, qty: 2 }] });
    expect(res.status).toBe(200);
    expect(s.limits).toEqual([['quote', 300, 60_000]]);
    expect(s.quotes).toHaveLength(1);
    expect((s.quotes[0] as unknown[])[1]).toMatchObject({ promoCode: null, locale: 'uz', deliveryMethod: 'courier' });

    s.limits.length = 0;
    res = await call({ items: [{ productId: 1, qty: 2 }], promo: '  sale10 ', locale: 'ru', delivery: 'pickup' });
    expect(res.status).toBe(200);
    expect(s.limits).toEqual([['quote', 300, 60_000], ['quote-promo', 60, 10 * 60_000]]);
    expect((s.quotes[1] as unknown[])[1]).toMatchObject({ promoCode: 'sale10', locale: 'ru', deliveryMethod: 'pickup' });
    // Bo'sh promokod — promokod cheklovi tekshirilmaydi
    s.limits.length = 0;
    await call({ items: [], promo: '   ' });
    expect(s.limits).toEqual([['quote', 300, 60_000]]);
  });

  it('cheklov to\'lganda 429 qaytadi va narx hisoblanmaydi (promokod tekshirilmaydi)', async () => {
    s.allow = { 'quote-promo': false };
    const res = await call({ items: [{ productId: 1, qty: 1 }], promo: 'GUESS1' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate' });
    expect(s.quotes).toHaveLength(0);

    s.allow = { quote: false };
    const res2 = await call({ items: [{ productId: 1, qty: 1 }] });
    expect(res2.status).toBe(429);
    expect(s.quotes).toHaveLength(0);
  });

  it('noto\'g\'ri JSON ham xato bermaydi (bo\'sh savat)', async () => {
    const res = await POST(new Request('https://pack24.uz/api/cart/quote', { method: 'POST', body: '{' }) as never);
    expect(res.status).toBe(200);
    expect((s.quotes[0] as unknown[])[0]).toEqual([]);
  });
});
