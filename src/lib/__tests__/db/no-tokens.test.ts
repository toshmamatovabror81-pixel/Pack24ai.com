import type { TelegramCustomer, User } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_TESTS, fixture, prisma, type Fixture } from './helpers';
import type { Actor } from '@/lib/orderFlow';

/**
 * Bot tokenlari kiritilmagan holat (ishchi serverda botlar ulanmaguncha shunday) va Telegram ishlamay qolgan holat —
 * buyurtma jarayoni bilan birga, haqiqiy bazada. Boshqa baza testlaridan farqi: notify.ts SOXTALASHTIRILMAYDI, faqat tarmoq
 * (fetch) almashtiriladi. Kelishuv: xabarnoma 0 qaytaradi va xato tashlamaydi, holat va to'lov esa baribir o'zgaradi va tarixga yoziladi.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());

const { notifyCustomerOrderStatus, notifyStaffLead, notifyStaffNewOrder, sendDailyDigest } = await import('@/lib/orderNotify');
const { changeOrderStatus, setManualPayment } = await import('@/lib/orderFlow');

const ACTOR: Actor = { name: 'Test Admin', via: 'admin' };

describe.skipIf(!DB_TESTS)('botlar: token yo\'q yoki Telegram ishlamayapti (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let worker: User;
  let customer: TelegramCustomer;
  let phone: string;

  type Call = { url: string; chat: string };
  const calls: Call[] = [];
  const stubFetch = (impl: () => Promise<Response>) => {
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      calls.push({ url, chat: String((JSON.parse(init.body) as { chat_id?: unknown }).chat_id) });
      return impl();
    });
  };
  const tokens = (customerToken: string, staffToken: string) => {
    vi.stubEnv('CUSTOMER_BOT_TOKEN', customerToken);
    vi.stubEnv('STAFF_BOT_TOKEN', staffToken);
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '');
  };
  const newOrder = async () => {
    const p = await fx.product({ name: 'Skotch 48mm' });
    return fx.order({ contactPhone: phone, paymentMethod: 'cash', items: { create: [{ productId: p.id, quantity: 2, price: 50000 }] } });
  };
  const history = (orderId: number) => prisma.orderEvent.findMany({ where: { orderId }, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    fx = await fixture(9);
    worker = await fx.user({ role: 'admin', telegramId: fx.tg() });
    phone = fx.phone();
    customer = await fx.customer({ phone });
    // Kunlik eslatmada chiqadigan narsa bo'lsin: 2 kundan beri "Yangi" turgan buyurtma
    await fx.order({ createdAt: new Date(Date.now() - 48 * 3_600_000) });
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_API_BASE', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('token kiritilmagan: hech narsa yuborilmaydi (tarmoqqa chiqilmaydi), holat va to\'lov baribir o\'zgaradi va tarixga yoziladi', async () => {
    tokens('', '');
    stubFetch(async () => { throw new Error('tarmoqqa chiqilmasligi kerak edi'); });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const o = await newOrder();

    expect(await notifyStaffNewOrder(o.id)).toBe(0);
    expect(await notifyCustomerOrderStatus(o)).toBe(0);
    expect(await notifyStaffLead(['📩 Yangi ariza'])).toBe(0);
    expect(await sendDailyDigest(new Date())).toEqual({ finance: 0, orders: 0 });
    expect(await changeOrderStatus(o.id, 'processing', ACTOR)).toMatchObject({ ok: true, changed: true, order: { status: 'processing' } });
    expect(await setManualPayment(o.id, 'paid', ACTOR)).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });

    expect(calls).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect((await history(o.id)).map((e) => `${e.kind}:${e.fromValue}>${e.toValue}`)).toEqual(['status:new_>processing', 'payment:pending>paid']);
    expect(await prisma.order.findUnique({ where: { id: o.id }, select: { status: true, paymentStatus: true } })).toEqual({ status: 'processing', paymentStatus: 'paid' });
  });

  it('token bor, Telegram javob bermayapti: xabarnoma 0 qaytaradi va xato tashlamaydi, buyurtma jarayoni to\'xtamaydi', async () => {
    tokens('111:customer', '222:staff');
    stubFetch(async () => { throw new Error('ECONNRESET'); });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const o = await newOrder();

    await expect(notifyStaffNewOrder(o.id)).resolves.toBe(0);
    await expect(notifyCustomerOrderStatus(o)).resolves.toBe(0);
    await expect(notifyStaffLead(['📩 Yangi ariza'])).resolves.toBe(0);
    await expect(sendDailyDigest(new Date())).resolves.toEqual({ finance: 0, orders: 0 });
    expect(await changeOrderStatus(o.id, 'processing', ACTOR)).toMatchObject({ ok: true, changed: true });
    expect(await setManualPayment(o.id, 'paid', ACTOR)).toMatchObject({ ok: true, changed: true });

    // Urinish bo'lgan (o'z xodimimiz va mijozimizga), xato esa faqat logga tushgan
    expect(calls.some((c) => c.url.endsWith('/bot222:staff/sendMessage') && c.chat === worker.telegramId)).toBe(true);
    expect(calls.some((c) => c.url.endsWith('/bot111:customer/sendMessage') && c.chat === customer.telegramId)).toBe(true);
    expect(errors).toHaveBeenCalled();
    expect(await history(o.id)).toHaveLength(2);
  });

  it('token bor va Telegram ishlayapti: xodimga boshqaruv boti, mijozga mijoz boti orqali yetadi', async () => {
    tokens('111:customer', '222:staff');
    stubFetch(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })));
    const o = await newOrder();

    expect(await notifyStaffNewOrder(o.id)).toBeGreaterThanOrEqual(1);
    expect(calls.filter((c) => c.chat === worker.telegramId).map((c) => c.url)).toEqual(['https://api.telegram.org/bot222:staff/sendMessage']);
    calls.length = 0;
    expect(await notifyCustomerOrderStatus(o)).toBe(1);
    expect(calls).toEqual([{ url: 'https://api.telegram.org/bot111:customer/sendMessage', chat: customer.telegramId }]);
  });
});
