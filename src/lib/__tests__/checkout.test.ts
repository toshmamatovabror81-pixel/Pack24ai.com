import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Checkout (createOrder) ning buyurtma saqlangandan KEYINGI qismi: tarixning birinchi satri va xabarnomalar.
 * Kelishuv: mijoz Telegram'ni ko'pi bilan 3 s kutadi, va saqlangan buyurtma hech qachon "xato" bo'lib qaytmaydi (aks holda mijoz
 * qayta yuborib, ikkinchi buyurtma ochadi). Baza, narx hisobi va Telegram soxta; haqiqiy baza bilan — db/checkout.test.ts.
 */
const s = vi.hoisted(() => ({
  log: [] as string[],
  orders: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
  admins: [] as unknown[],
  staff: [] as unknown[],
  quote: null as unknown,
  eventImpl: (async () => ({})) as () => Promise<unknown>,
  adminsImpl: (async () => undefined) as () => Promise<unknown>,
  staffImpl: (async () => 1) as () => Promise<unknown>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/quote', () => ({ buildQuote: async () => s.quote }));
vi.mock('@/lib/telegram', () => ({ notifyAdmins: (l: unknown) => { s.log.push('admins'); s.admins.push(l); return s.adminsImpl(); } }));
vi.mock('@/lib/orderNotify', () => ({ notifyStaffNewOrder: (id: unknown) => { s.log.push('staff'); s.staff.push(id); return s.staffImpl(); } }));
vi.mock('@/lib/db', () => {
  const tx = {
    order: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const order = { id: 501, ...data };
        s.log.push('order');
        s.orders.push(order);
        return order;
      },
    },
  };
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      orderEvent: { create: ({ data }: { data: Record<string, unknown> }) => { s.log.push('event'); s.events.push(data); return s.eventImpl(); } },
    },
  };
});

const { createOrder, CheckoutError } = await import('@/lib/orders');

const QUOTE = { lines: [{ productId: 9, name: 'Quti 30x20', image: '', qty: 3, minQuantity: 1, unitPrice: 12000, lineTotal: 36000 }], missing: [], subtotal: 36000, discount: 0, promo: null, promoError: false, delivery: 0, total: 36000 };
const input = (over: Record<string, unknown> = {}) => ({ locale: 'uz' as const, items: [{ productId: 9, qty: 3 }], name: 'Vali Aliyev', phone: '998901234567', deliveryMethod: 'pickup' as const, paymentMethod: 'cash' as const, ...over });
const hang = () => new Promise<never>(() => undefined);

beforeEach(() => {
  s.log.length = 0;
  s.orders.length = 0;
  s.events.length = 0;
  s.admins.length = 0;
  s.staff.length = 0;
  s.quote = QUOTE;
  s.eventImpl = async () => ({});
  s.adminsImpl = async () => undefined;
  s.staffImpl = async () => 1;
  vi.stubEnv('APP_URL', 'https://pack24.uz');
  for (const key of ['PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY', 'CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY']) vi.stubEnv(key, '');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('createOrder: buyurtma saqlangandan keyin', () => {
  it('tarixning birinchi satri yoziladi, keyin xodimlarga karta va admin guruhga matn ketadi', async () => {
    const { order, payUrl, viewUrl } = await createOrder(input());
    expect(order).toMatchObject({ id: 501, status: 'new_', paymentStatus: 'pending', source: 'web', totalAmount: 36000 });
    expect(payUrl).toBeNull();
    expect(viewUrl).toBe(`/uz/orders/${order.accessToken}`);
    expect(s.events).toEqual([{ orderId: 501, kind: 'status', fromValue: null, toValue: 'new_', actor: 'Vali Aliyev', via: 'system' }]);
    expect(s.staff).toEqual([501]);
    expect(s.admins).toHaveLength(1);
    expect((s.admins[0] as string[])[0]).toBe('🛒 Yangi buyurtma #501');
    expect(s.admins[0]).toContain('https://pack24.uz/admin/orders/501');
    // Tarix xabarnomalardan oldin: xodim kartani ochganda "Tarix" allaqachon joyida (ikki xabarnomaning o'zaro tartibi muhim emas)
    expect(s.log.slice(0, 2)).toEqual(['order', 'event']);
    expect(s.log.slice(2).sort()).toEqual(['admins', 'staff']);
  });

  it('Telegram javob bermasa mijoz ko\'pi bilan 3 s kutadi; bitta xabarnoma osilib qolsa ikkinchisi baribir boshlanadi', async () => {
    vi.useFakeTimers();
    s.adminsImpl = hang;
    s.staffImpl = hang;
    let done: Awaited<ReturnType<typeof createOrder>> | null = null;
    void createOrder(input()).then((r) => { done = r; });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(done).toBeNull();
    expect(s.orders).toHaveLength(1);
    expect(s.events).toHaveLength(1);
    expect(s.staff).toEqual([501]);
    expect(s.admins).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).not.toBeNull();
    expect(done!.order.id).toBe(501);
  });

  it('xabarnoma tez tugasa kutilmaydi (3 s — faqat yuqori chegara)', async () => {
    vi.useFakeTimers();
    let done = false;
    void createOrder(input()).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('xabarnomalar xato tashlasa ham buyurtma qabul qilinadi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    s.adminsImpl = async () => { throw new Error('guruh topilmadi'); };
    s.staffImpl = async () => { throw new Error('telegram ishlamayapti'); };
    const { order } = await createOrder(input());
    expect(order.id).toBe(501);
    expect(s.staff).toEqual([501]);
    expect(s.admins).toHaveLength(1);
    expect(errors).toHaveBeenCalled();

    // Chaqiruvning o'zi (kutishdan oldin) xato tashlasa ham
    s.staffImpl = () => { throw new Error('sinxron xato'); };
    await expect(createOrder(input())).resolves.toMatchObject({ order: { id: 501 } });
  });

  it('tarix yozilmasa ham buyurtma qabul qilinadi va xabarnomalar ketadi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    s.eventImpl = async () => { throw new Error('baza band'); };
    await expect(createOrder(input())).resolves.toMatchObject({ order: { id: 501 } });
    s.eventImpl = () => { throw new Error('sinxron xato'); };
    await expect(createOrder(input())).resolves.toMatchObject({ order: { id: 501 } });
    expect(s.staff).toEqual([501, 501]);
    expect(s.admins).toHaveLength(2);
    expect(errors).toHaveBeenCalledTimes(2);
  });

  it('buyurtma saqlanmagan bo\'lsa (savat bo\'sh, to\'lov usuli yoqilmagan) xato qaytadi va hech narsa yuborilmaydi', async () => {
    s.quote = { ...QUOTE, lines: [] };
    await expect(createOrder(input())).rejects.toBeInstanceOf(CheckoutError);
    await expect(createOrder(input({ paymentMethod: 'payme' }))).rejects.toMatchObject({ code: 'payment' });
    expect(s.log).toEqual([]);
  });
});
