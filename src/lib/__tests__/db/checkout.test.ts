import type { User } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, type Fixture } from './helpers';

/**
 * Saytdagi checkout (createOrder) haqiqiy baza bilan: buyurtma bilan birga tarixning birinchi satri yoziladi va boshqaruv
 * botiga ulangan xodimga karta ketadi. Telegram yiqilsa yoki umuman javob bermasa ham buyurtma qabul qilinadi va mijoz
 * javobni bir necha soniyada oladi (kutish chegarasi — orders.ts NOTIFY_WAIT_MS, 3 s).
 * Faqat tarmoq soxta: Telegram (notify) va eski admin guruh (notifyAdmins) — ikkalasini `tg.mode` boshqaradi.
 */
const tg = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'fail' | 'hang', admins: [] as unknown[] }));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/telegram', () => ({
  notifyAdmins: async (lines: unknown) => {
    tg.admins.push(lines);
    if (tg.mode === 'fail') throw new Error('admin guruh: telegram ishlamayapti');
    if (tg.mode === 'hang') await new Promise(() => undefined);
  },
}));
vi.mock('@/lib/telegram/notify', async () => {
  const real = (await import('./helpers')).notifyMock();
  return {
    ...real,
    notifyStaff: async (...a: Parameters<typeof real.notifyStaff>) => {
      if (tg.mode === 'fail') throw new Error('telegram ishlamayapti');
      if (tg.mode === 'hang') await new Promise(() => undefined);
      return real.notifyStaff(...a);
    },
  };
});
// buildQuote yetkazish narxini sozlamalardan oladi
vi.mock('@/lib/settings', async () => ({ getSettings: async () => ({ ...(await import('./helpers')).TEST_SETTINGS, deliveryFee: 30000, freeDeliveryFrom: 0 }) }));

const { createOrder } = await import('@/lib/orders');

describe.skipIf(!DB_TESTS)('checkout: createOrder (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let worker: User;
  const input = (productId: number) => ({ locale: 'uz' as const, items: [{ productId, qty: 3 }], name: 'Vali Aliyev', phone: fx.phone(), deliveryMethod: 'pickup' as const, paymentMethod: 'cash' as const });
  // Bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin — faqat o'zimiznikiga kelgan xabarlarga qaraymiz
  const cards = () => outbox.staff.filter((m) => m.to === worker.telegramId);
  const history = (orderId: number) => prisma.orderEvent.findMany({ where: { orderId } });

  beforeAll(async () => {
    fx = await fixture(8);
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
  });
  afterAll(async () => {
    // createOrder yaratgan buyurtmalar fixture ro'yxatida yo'q: mahsulotdan oldin o'zimiz o'chiramiz (OrderEvent kaskad bilan ketadi).
    // Shu faylning telefon bo'lagi bo'yicha topiladi — test yarmida yiqilgan bo'lsa ham bazada hech narsa qolmaydi.
    if (fx) {
      const orderId = { in: (await prisma.order.findMany({ where: { contactPhone: { startsWith: `99890${fx.tag}` } }, select: { id: true } })).map((o) => o.id) };
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
      await fx.cleanup();
    }
    await prisma.$disconnect();
  });
  beforeEach(() => {
    clearOutbox();
    tg.mode = 'ok';
    tg.admins.length = 0;
  });

  it('buyurtma yaratiladi: tarixda bitta "Yangi" satri, xodimga holat tugmali karta, admin guruhga matn', async () => {
    const p = await fx.product({ price: 12000 });
    const { order, payUrl, viewUrl } = await createOrder(input(p.id));

    expect(order).toMatchObject({ status: 'new_', paymentStatus: 'pending', source: 'web' });
    expect(Number(order.totalAmount)).toBe(36000);
    expect(payUrl).toBeNull();
    expect(viewUrl).toBe(`/uz/orders/${order.accessToken}`);
    const events = await history(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'status', fromValue: null, toValue: 'new_', actor: 'Vali Aliyev', via: 'system' });
    expect(tg.admins).toHaveLength(1);
    expect((tg.admins[0] as string[])[0]).toBe(`🛒 Yangi buyurtma #${order.id}`);
    const [card, ...rest] = cards();
    expect(rest).toEqual([]);
    expect(card.html).toContain('Yangi buyurtma');
    expect(card.html).toContain(`Buyurtma #${order.id}`);
    expect(card.inline?.[0][0].callback_data).toBe(`os_${order.id}_processing`);
  });

  it('Telegram xato bersa ham (xodim boti ham, admin guruh ham) buyurtma qabul qilinadi va tarixga yoziladi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    tg.mode = 'fail';
    const p = await fx.product();
    const { order } = await createOrder(input(p.id));
    const logged = errors.mock.calls.length;
    errors.mockRestore();

    expect(logged).toBeGreaterThan(0);
    expect(tg.admins).toHaveLength(1);
    expect(cards()).toEqual([]);
    expect(await history(order.id)).toHaveLength(1);
    expect(await prisma.order.count({ where: { id: order.id, status: 'new_' } })).toBe(1);
  });

  // Checkout formasi ismni 100 belgi bilan cheklaydi, lekin createOrder boshqa joydan chaqirilsa ham tarix satri yo'qolmasin:
  // UTF-16 bo'yicha kesish emoji o'rtasidan bo'lsa yarim surrogatni Prisma rad etadi
  it('100 belgidan uzun, chegarasida emoji turgan ism: tarixning birinchi satri baribir yoziladi', async () => {
    const p = await fx.product();
    const name = `${'N'.repeat(99)}😀 Aliyev`;
    expect(name.slice(0, 100).isWellFormed()).toBe(false);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { order } = await createOrder({ ...input(p.id), name });
    const logged = errors.mock.calls.length;
    errors.mockRestore();

    expect(logged).toBe(0);
    expect((await history(order.id)).map((e) => e.actor)).toEqual(['N'.repeat(99)]);
  });

  it('Telegram umuman javob bermasa ham mijoz javobni oladi: buyurtma va tarix saqlangan, kutish cheklangan', async () => {
    tg.mode = 'hang';
    const p = await fx.product();
    const started = Date.now();
    const { order } = await createOrder(input(p.id));
    const waited = Date.now() - started;

    // Chegara 3 s (aniq qiymati soxta soat bilan checkout.test.ts da tekshiriladi). Bu yerda baza sekinligiga keng joy qoldirilgan:
    // cheklov umuman bo'lmasa createOrder hech qachon qaytmaydi va test o'z muddati (20 s) bilan yiqiladi
    expect(waited).toBeLessThan(15_000);
    expect(tg.admins).toHaveLength(1);
    expect(cards()).toEqual([]);
    expect(await history(order.id)).toHaveLength(1);
    expect(await prisma.order.count({ where: { id: order.id, status: 'new_' } })).toBe(1);
  });
});
