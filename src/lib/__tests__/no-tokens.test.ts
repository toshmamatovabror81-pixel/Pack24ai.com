import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ishchi serverning birinchi kundagi holati: bot tokenlari hali kiritilmagan. Checkout, admin panel va to'lov webhook'lari
 * xabarnomani baribir chaqiradi — u tarmoqqa chiqmasdan jim o'tishi (false) va hech qachon xato tashlamasligi kerak.
 * notify.ts, api.ts, bots.ts va orderNotify.ts haqiqiy; tarmoq (fetch) soxta, baza esa har so'rovga xato qaytaradi (oxirgi
 * bo'lim uchun). Buyurtma jarayoni bilan birga, haqiqiy bazada — db/no-tokens.test.ts.
 */
const h = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/handlers', () => ({ dispatchUpdate: h.dispatch }));
// Har qanday model va metod (prisma.order.findFirst, prisma.$transaction ...) xato bilan tugaydi: qaysi so'rov ishlatilishidan qat'i nazar
vi.mock('@/lib/db', () => {
  const fail = async () => { throw new Error('baza ulanmadi'); };
  const model = new Proxy({}, { get: () => fail });
  return { prisma: new Proxy({}, { get: (_, prop) => (String(prop).startsWith('$') ? fail : model) }) };
});
vi.mock('@/lib/settings', () => ({ getSettings: async () => ({ companyName: 'Pack24', phone: '998880557888' }) }));

const { notify, notifyCustomer, notifyStaff } = await import('@/lib/telegram/notify');
const orderNotify = await import('@/lib/orderNotify');
const webhook = await import('@/app/api/telegram/[bot]/route');

const WEBHOOK_SECRET = 'ci-dummy-webhook-secret';
const tokens = (customer: string, staff: string, legacyStaff = '') => {
  vi.stubEnv('CUSTOMER_BOT_TOKEN', customer);
  vi.stubEnv('STAFF_BOT_TOKEN', staff);
  vi.stubEnv('SUPERVISOR_BOT_TOKEN', legacyStaff);
};
const stubFetch = (impl: () => Promise<Response>) => {
  const f = vi.fn<(url: string, init: { body: string }) => Promise<Response>>(impl);
  vi.stubGlobal('fetch', f);
  return f;
};
const offline = async (): Promise<Response> => { throw new Error('ECONNRESET'); };
const telegram = (body: object) => async () => new Response(JSON.stringify(body));
const OK = { ok: true, result: { message_id: 1 } };

beforeEach(() => {
  vi.stubEnv('TELEGRAM_API_BASE', '');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', WEBHOOK_SECRET);
  h.dispatch.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('xabarnoma: bot tokeni kiritilmagan', () => {
  it('notify false qaytaradi va tarmoqqa umuman chiqmaydi (ikkala bot, bo\'sh yoki faqat bo\'shliqli kalit)', async () => {
    const fetch = stubFetch(offline);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const empty of ['', '   ']) {
      tokens(empty, empty, empty);
      expect(await notify('staff', '900', 'x')).toBe(false);
      expect(await notify('customer', 777, 'x', [[{ text: 'Batafsil', callback_data: 'o_1' }]])).toBe(false);
      expect(await notifyStaff('900', 'x')).toBe(false);
      expect(await notifyCustomer('777', 'x')).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('bir botning tokeni ikkinchisi uchun ishlatilmaydi', async () => {
    const fetch = stubFetch(telegram(OK));
    tokens('111:customer', '');
    expect(await notifyStaff('900', 'x')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(await notifyCustomer('777', 'salom')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bot111:customer/sendMessage');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ chat_id: '777', text: 'salom', parse_mode: 'HTML' });
  });

  it('boshqaruv boti eski nomdagi kalit (SUPERVISOR_BOT_TOKEN) bilan ham ishlaydi', async () => {
    const fetch = stubFetch(telegram(OK));
    tokens('', '', '333:legacy');
    expect(await notifyStaff('900', 'x')).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bot333:legacy/sendMessage');
  });

  it('bot webhook manzili tokensiz 503 qaytaradi va update qayta ishlanmaydi', async () => {
    tokens('', '');
    const req = () => new Request('https://pack24.uz/api/telegram/customer', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET }, body: JSON.stringify({ update_id: 1 }) });
    const res = await webhook.POST(req(), { params: Promise.resolve({ bot: 'customer' }) });
    expect(res.status).toBe(503);
    expect(h.dispatch).not.toHaveBeenCalled();
    const status = await webhook.GET(new Request('https://pack24.uz/api/telegram/customer'), { params: Promise.resolve({ bot: 'customer' }) });
    expect(await status.json()).toEqual({ ok: true, bot: 'customer', configured: false });

    tokens('111:customer', '');
    expect((await webhook.POST(req(), { params: Promise.resolve({ bot: 'customer' }) })).status).toBe(200);
    expect(h.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('xabarnoma: xato tashlamaydi', () => {
  beforeEach(() => tokens('111:customer', '222:staff'));

  it('oluvchi ko\'rsatilmagan bo\'lsa yuborilmaydi', async () => {
    const fetch = stubFetch(telegram(OK));
    expect(await notifyStaff(null, 'x')).toBe(false);
    expect(await notifyCustomer(undefined, 'x')).toBe(false);
    expect(await notify('staff', '', 'x')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tarmoq uzilsa yoki Telegram rad etsa (bot bloklangan): false qaytadi, xato logga yoziladi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(offline);
    await expect(notify('staff', '900', 'x')).resolves.toBe(false);
    stubFetch(telegram({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }));
    await expect(notify('customer', '777', 'x')).resolves.toBe(false);
    stubFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(notify('customer', '777', 'x')).resolves.toBe(false);
    expect(errors).toHaveBeenCalledTimes(3);

    const fetch = stubFetch(telegram(OK));
    await expect(notify('staff', '900', 'x')).resolves.toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bot222:staff/sendMessage');
  });
});

describe('xabarnoma: baza o\'qilmasa ham xato tashlamaydi', () => {
  // Checkout, admin panel va to'lov webhook'lari bu funksiyalarni buyurtma saqlangandan keyin chaqiradi — xato tashlasa o'shalar yiqiladi
  it('oluvchilar yoki buyurtma bazadan o\'qilmasa: 0 qaytadi, hech narsa yuborilmaydi, xato logga yoziladi', async () => {
    tokens('111:customer', '222:staff');
    const fetch = stubFetch(telegram(OK));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const order = { id: 5, status: 'cancelled', paymentStatus: 'paid', totalAmount: 100000, accessToken: 'tok', telegramUserId: null, contactPhone: '998901234567', userId: 3, deliveryMethod: 'pickup' } as never;

    await expect(orderNotify.notifyStaffNewOrder(5)).resolves.toBe(0);
    await expect(orderNotify.notifyStaffPaid(5, 'Payme')).resolves.toBe(0);
    await expect(orderNotify.notifyStaffLead(['📩 Yangi ariza'])).resolves.toBe(0);
    await expect(orderNotify.notifyCustomerOrderStatus(order)).resolves.toBe(0);
    await expect(orderNotify.notifyCustomerPaid(order)).resolves.toBe(0);
    await expect(orderNotify.notifyCustomerInvoice(5, { invoiceNo: 'INV-1', totalAmount: 1000, dueDate: new Date() })).resolves.toBe(0);
    await expect(orderNotify.notifyCustomerProduction({ orderId: 5, productName: 'Quti', currentStage: 'gofra', progress: 10, status: 'in_progress' })).resolves.toBe(0);
    await expect(orderNotify.sendDailyDigest(new Date())).resolves.toEqual({ finance: 0, orders: 0 });

    expect(fetch).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
  });
});
