import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ishchi serverning birinchi kundagi holati: bot tokenlari hali kiritilmagan. Checkout, admin panel va to'lov webhook'lari
 * xabarnomani baribir chaqiradi — u tarmoqqa chiqmasdan jim o'tishi (false) va hech qachon xato tashlamasligi kerak.
 * notify.ts, api.ts, bots.ts, outbox.ts va orderNotify.ts haqiqiy; tarmoq (fetch) soxta, baza esa har so'rovga xato qaytaradi:
 * vaqtinchalik xatoda xabar navbatga (BotOutbox) yoziladi — bu yerda o'sha yozuv ham "o'tmaydi", ya'ni navbat xatosi ham hech
 * narsani yiqitmasligi tekshiriladi. Buyurtma jarayoni bilan birga, haqiqiy bazada — db/no-tokens.test.ts; navbatning o'zi — outbox.test.ts.
 */
const h = vi.hoisted(() => ({ dispatch: vi.fn(), db: [] as string[] }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/handlers', () => ({ dispatchUpdate: h.dispatch }));
// Har qanday model va metod (prisma.order.findFirst, prisma.$transaction ...) xato bilan tugaydi: qaysi so'rov ishlatilishidan qat'i nazar.
// Qaysi so'rovga urinilgani h.db ga yoziladi ("botOutbox.create") — "navbatga yozishga urinildi" bilan "umuman urinilmadi" shundan ajratiladi
vi.mock('@/lib/db', () => {
  const fail = (name: string) => async () => {
    h.db.push(name);
    throw new Error('baza ulanmadi');
  };
  const model = (table: string) => new Proxy({}, { get: (_, method) => fail(`${table}.${String(method)}`) });
  return { prisma: new Proxy({}, { get: (_, prop) => (String(prop).startsWith('$') ? fail(String(prop)) : model(String(prop))) }) };
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
  h.db.length = 0;
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
    // Token yo'q — xabar navbatga ham qo'yilmaydi (bazaga umuman murojaat yo'q): bot ulanmagan serverda navbat to'lib yotmaydi
    expect(h.db).toEqual([]);
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

  /** Logga yozilgan satrlar: birinchi argument — qayerdan (va kimga), ikkinchisi — sababi */
  const logged = (errors: { mock: { calls: unknown[][] } }) => errors.mock.calls.map((c) => c.map(String).join(' '));

  it('tarmoq uzilsa yoki Telegram rad etsa (bot bloklangan): false qaytadi, xato logga yoziladi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(offline);
    await expect(notify('staff', '900', 'x')).resolves.toBe(false);
    stubFetch(telegram({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }));
    await expect(notify('customer', '777', 'x')).resolves.toBe(false);
    stubFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(notify('customer', '777', 'x')).resolves.toBe(false);
    // Yetib bormagan har bir xabar uchun bitta satr: qaysi bot, kimga va nima sababdan (navbat satrlari — keyingi testlarda)
    const failures = logged(errors).filter((line) => !line.includes('navbatga yozilmadi'));
    expect(failures).toHaveLength(3);
    expect(failures[0]).toBe('[notify:staff] 900 ECONNRESET');
    expect(failures[1]).toBe('[notify:customer] 777 Telegram sendMessage: 403 Forbidden: bot was blocked by the user');
    expect(failures[2]).toMatch(/^\[notify:customer\] 777 Telegram sendMessage: 502 /);
    // Bot tokeni hech bir satrda yo'q
    for (const line of logged(errors)) expect(line).not.toMatch(/111:customer|222:staff/);

    const fetch = stubFetch(telegram(OK));
    await expect(notify('staff', '900', 'x')).resolves.toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bot222:staff/sendMessage');
  });

  // Telegram vaqtincha javob bermasa xabar navbatga yoziladi (outbox.ts). Bu faylda baza ishlamaydi: navbatga yozish ham o'tmaydi —
  // bu ham faqat logga tushadi, chaqiruvchi (checkout, to'lov webhook'i) esa odatdagidek false oladi
  it('vaqtinchalik xato (tarmoq, 5xx, 429): xabar navbatga yoziladi; navbatga yozib bo\'lmasa bu ham faqat logga tushadi — xato tashlanmaydi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const transient: [string, () => Promise<Response>][] = [
      ['tarmoq uzilgan', offline],
      ['502, javob JSON emas', async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })],
      ['500', telegram({ ok: false, error_code: 500, description: 'Internal Server Error' })],
      ['429', telegram({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 7', parameters: { retry_after: 7 } })],
    ];
    for (const [name, respond] of transient) {
      errors.mockClear();
      h.db.length = 0;
      const fetch = stubFetch(respond);
      await expect(notify('staff', '900', 'x', [[{ text: 'Batafsil', callback_data: 'o_1' }]]), name).resolves.toBe(false);
      // Telegram'ga bir marta urinilgan (shu zahoti qayta-qayta yuborilmaydi), keyin aynan bitta yozuv navbatga qo'yilmoqchi bo'lgan
      expect(fetch, name).toHaveBeenCalledTimes(1);
      expect(h.db, name).toEqual(['botOutbox.create']);
      expect(logged(errors), name).toHaveLength(2);
      expect(logged(errors)[0], name).toMatch(/^\[notify:staff\] 900 /);
      expect(logged(errors)[1], name).toBe('[notify:staff] navbatga yozilmadi baza ulanmadi');
    }
    for (const line of logged(errors)) expect(line).not.toContain('222:staff');
  });

  it('doimiy xato (bot bloklangan, chat topilmadi, token yaroqsiz): navbatga qo\'yilmaydi — bazaga umuman murojaat yo\'q', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const permanent: [number, string][] = [[403, 'Forbidden: bot was blocked by the user'], [400, 'Bad Request: chat not found'], [401, 'Unauthorized']];
    for (const [error_code, description] of permanent) {
      errors.mockClear();
      const fetch = stubFetch(telegram({ ok: false, error_code, description }));
      // Mavzuli (holat) xabar bo'lsa ham: qayta urinish foydasiz — navbatga yozuv ham, shu mavzudagi eski yozuvlarni bekor qilish ham yo'q
      await expect(notifyCustomer('777', 'x', undefined, 'order-status:5'), description).resolves.toBe(false);
      await expect(notify('staff', '900', 'x'), description).resolves.toBe(false);
      expect(fetch, description).toHaveBeenCalledTimes(2);
      expect(h.db, description).toEqual([]);
      expect(logged(errors), description).toEqual([
        `[notify:customer] 777 Telegram sendMessage: ${error_code} ${description}`,
        `[notify:staff] 900 Telegram sendMessage: ${error_code} ${description}`,
      ]);
    }
  });

  // Mavzuli (holat) xabar: yangisi chiqqanda navbatda turgan eskisi bekor qilinadi — buning uchun bazaga murojaat qilinadi
  it('mavzuli xabar yetib borgach navbatdagi eski holatni bekor qilib bo\'lmasa (baza xatosi): xabar baribir "yuborildi" (true)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetch = stubFetch(telegram(OK));
    await expect(notifyCustomer('777', 'Yetkazildi', undefined, 'order-status:5')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Mavzu Telegram'ga ketmaydi — u faqat navbat uchun
    expect(fetch.mock.calls[0][1].body).not.toContain('order-status');
    expect(Object.keys(JSON.parse(fetch.mock.calls[0][1].body) as object).sort()).toEqual(['chat_id', 'disable_web_page_preview', 'parse_mode', 'text']);
    expect(h.db).toEqual(['botOutbox.updateMany']);
    expect(logged(errors)).toEqual(['[notify:customer] navbat baza ulanmadi']);

    // Mavzusiz xabar yetib borsa bazaga umuman murojaat qilinmaydi
    errors.mockClear();
    h.db.length = 0;
    await expect(notifyCustomer('777', 'To\'lov qabul qilindi')).resolves.toBe(true);
    expect(h.db).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it('mavzuli xabar vaqtinchalik xatoda: avval navbatdagi eski holat bekor qilinadi, keyin yangisi yoziladi; baza xatosi faqat logga tushadi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(offline);
    await expect(notifyCustomer('777', 'Yo\'lda', undefined, 'order-status:5')).resolves.toBe(false);
    // Eskisini bekor qilish o'tmadi — yangi yozuv ham qo'yilmadi: navbatda bitta mavzuda ikki holat yonma-yon qolmaydi
    expect(h.db).toEqual(['botOutbox.updateMany']);
    expect(logged(errors)).toEqual(['[notify:customer] 777 ECONNRESET', '[notify:customer] navbatga yozilmadi baza ulanmadi']);
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
    await expect(orderNotify.notifyCustomerProduction({ id: 9, orderId: 5, productName: 'Quti', currentStage: 'gofra', progress: 10, status: 'in_progress' })).resolves.toBe(0);
    await expect(orderNotify.sendDailyDigest(new Date())).resolves.toEqual({ finance: 0, orders: 0 });

    expect(fetch).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
  });

  // Bekor qilingan buyurtmaning navbatdagi ishlab chiqarish xabarlari bekor qilinadi (outbox.ts supersedePrefix) — bu ham bazaga murojaat
  it('bekor qilingan buyurtma: navbatni tozalab bo\'lmasa ham holat xabari xato tashlamaydi — tozalash xatosi alohida logga tushadi; boshqa holatlarda navbatga tegilmaydi', async () => {
    tokens('111:customer', '222:staff');
    const fetch = stubFetch(telegram(OK));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const order = { id: 5, status: 'cancelled', paymentStatus: 'paid', totalAmount: 100000, accessToken: 'tok', telegramUserId: null, contactPhone: '998901234567', userId: null, deliveryMethod: 'courier' };

    await expect(orderNotify.notifyCustomerOrderStatus(order as never)).resolves.toBe(0);
    // Avval navbat (bekor qilishga urinildi), keyin oluvchilar ro'yxati — ikkalasi ham o'tmadi
    expect(h.db).toEqual(['botOutbox.updateMany', 'telegramCustomer.findMany']);
    const lines = errors.mock.calls.map((c) => c.map(String).join(' '));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('[orderNotify] navbat 5 Error: baza ulanmadi');
    expect(lines[1]).toMatch(/^\[orderNotify\] mijoz 5 /);

    for (const status of ['new_', 'processing', 'shipping', 'delivered']) {
      h.db.length = 0;
      await expect(orderNotify.notifyCustomerOrderStatus({ ...order, status } as never)).resolves.toBe(0);
      expect(h.db, status).toEqual(['telegramCustomer.findMany']);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
