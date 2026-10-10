import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sahifalar botlar haqida faqat rostini aytishi: bot tokeni kiritilmagan holatda (ishchi serverda botlar ulanmaguncha shunday)
 * "Telegram'da kuzatish" tugmasi, "Telegram kodi" va "xabar boradi" degan va'dalar chiqmasligi; Xodimlar sahifasidagi kod xabari
 * faqat bazadagi amaldagi kod uchun; o'chirilgan buyurtma faqat ko'rish uchun. Server komponentlari to'g'ridan-to'g'ri chaqiriladi
 * va HTML'ga aylantiriladi; baza, sessiya va Telegram soxta.
 */
// Vitest .tsx fayllarni klassik JSX (React.createElement) bilan o'giradi — sahifa modullari global React'ni kutadi
(globalThis as { React?: unknown }).React = React;

const s = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  staff: [] as Record<string, unknown>[],
  recipients: [] as { telegramId: string; lang: string }[],
  settings: {} as Record<string, unknown>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => React.createElement('a', { href, ...rest }, children) }));
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/auth', () => ({ requireStaff: async () => ({ id: 1, name: 'Admin Ali', role: 'admin' }) }));
vi.mock('@/lib/db', () => ({
  prisma: {
    order: { findUnique: async () => s.order },
    corporateInvoice: { findFirst: async () => null },
    workOrder: { findMany: async () => [] },
    user: { findMany: async () => s.staff },
  },
}));
vi.mock('@/lib/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings')>('@/lib/settings');
  return { getSettings: async () => ({ ...actual.defaultSettings, ...s.settings }) };
});
vi.mock('@/lib/orders', () => ({ paymentUrl: () => null }));
vi.mock('@/lib/telegram/customers', () => ({ orderRecipients: async () => s.recipients }));
vi.mock('@/lib/telegram/setup', () => ({ botStatuses: async () => [] }));
const action = async () => undefined;
vi.mock('@/app/admin/(panel)/orders/actions', () => ({ updateOrder: action }));
vi.mock('@/app/admin/(panel)/invoices/actions', () => ({ createInvoiceForOrder: action }));
vi.mock('@/app/admin/(panel)/staff/actions', () => ({ createStaff: action, issueTelegramCode: action, unlinkTelegram: action, updateStaff: action }));
vi.mock('@/app/admin/(panel)/settings/actions', () => ({ updateSettings: action }));
vi.mock('@/app/admin/(panel)/settings/telegramActions', () => ({ removeTelegramWebhooks: action, setupTelegramWebhooks: action }));

const { default: OrderPage } = await import('@/app/[lang]/orders/[token]/page');
const { default: AdminOrderPage } = await import('@/app/admin/(panel)/orders/[id]/page');
const { default: StaffPage } = await import('@/app/admin/(panel)/staff/page');
const { default: SettingsPage } = await import('@/app/admin/(panel)/settings/page');

/** HTML va undan ajratilgan oddiy matn (teglarsiz, belgilar qaytarilgan) */
const render = async (page: Promise<React.ReactElement>) => {
  const html = renderToStaticMarkup(await page);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  return { html, text };
};
const tokens = (customer: string, staff: string, legacyStaff = '') => {
  vi.stubEnv('CUSTOMER_BOT_TOKEN', customer);
  vi.stubEnv('STAFF_BOT_TOKEN', staff);
  vi.stubEnv('SUPERVISOR_BOT_TOKEN', legacyStaff);
};

const TOKEN = 'tok_ABCDEFGHIJKLMNOPQRSTU';
const order = (over: Record<string, unknown> = {}) => ({
  id: 12, status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash', accessToken: TOKEN, deletedAt: null, createdAt: new Date('2026-10-10T05:00:00Z'),
  subtotal: 36000, discountAmount: 0, deliveryFee: 0, totalAmount: 36000, promoCode: null,
  customerName: 'Vali Aliyev', companyName: null, companyInn: null, contactPhone: '998901234567', deliveryMethod: 'pickup', shippingAddress: null, comment: null,
  source: 'web', utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPage: null, telegramUserId: null, userId: null,
  items: [{ id: 1, quantity: 3, price: 12000, product: { id: 9, name: 'Quti 30x20', nameI18n: null, sku: 'Q-30', image: null } }],
  user: null, paymeTransactions: [], workOrders: [], corporateInvoices: [], events: [],
  ...over,
});
const staffRow = (over: Record<string, unknown> = {}) => ({
  id: 5, name: 'Vali Xodim', role: 'staff', phone: '998901112233', email: null, isActive: true,
  telegramId: null, telegramVerifiedAt: null, telegramNotify: true, telegramCode: null, otpExpiry: null,
  ...over,
});

beforeEach(() => {
  s.order = order();
  s.staff = [staffRow()];
  s.recipients = [];
  s.settings = {};
  tokens('', '');
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_WEBHOOK_SECRET']) vi.stubEnv(key, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buyurtma sahifasi (sayt): "Telegram\'da kuzatish" tugmasi', () => {
  const page = (lang = 'uz') => render(OrderPage({ params: Promise.resolve({ lang, token: TOKEN }) }));
  const LINK = `https://t.me/Pack24AI_bot?start=${TOKEN}`;

  it('mijoz boti tokeni kiritilmagan bo\'lsa tugma chiqmaydi (bot /start ga javob bermaydi)', async () => {
    const { html, text } = await page();
    expect(text).toContain('#12');
    expect(html).not.toContain('?start=');
    expect(text).not.toContain("Telegram'da kuzatish");
    // Boshqaruv boti tokeni mijoz botini "ishlaydigan" qilmaydi
    tokens('', '222:staff');
    expect((await page()).html).not.toContain('?start=');
  });

  it('token kiritilgan va sozlamada bot nomi bor bo\'lsa tugma shu buyurtma kaliti bilan chiqadi', async () => {
    tokens('111:customer', '');
    const uz = await page();
    expect(uz.html).toContain(`href="${LINK}"`);
    expect(uz.text).toContain("Telegram'da kuzatish");
    expect((await page('ru')).html).toContain(`href="${LINK}"`);
  });

  it('token bor, lekin sozlamadagi bot nomi bo\'sh yoki yaroqsiz bo\'lsa tugma chiqmaydi', async () => {
    tokens('111:customer', '');
    for (const telegramBot of ['', 'bot', 'pack24 bot', 'Pack24AI_bot?x=1']) {
      s.settings = { telegramBot };
      expect((await page()).html).not.toContain('?start=');
    }
  });
});

describe('admin: buyurtma sahifasi', () => {
  const page = (sp: Record<string, string> = {}) => render(AdminOrderPage({ params: Promise.resolve({ id: '12' }), searchParams: Promise.resolve(sp) }));

  it('oddiy buyurtma: saqlash formasi forma ko\'rgan holat (prev*) bilan chiqadi', async () => {
    const { html, text } = await page();
    expect(html).toContain('name="prevStatus" value="new_"');
    expect(html).toContain('name="prevPaymentStatus" value="pending"');
    expect(text).toContain('Saqlash');
    expect(text).not.toContain("o'chirilgan");
    expect(text).not.toContain('saqlanmadi');
  });

  it('eskirgan forma rad etilganda (?error=conflict) xodimga o\'zgarishi saqlanmagani aytiladi', async () => {
    const { text } = await page({ error: 'conflict' });
    expect(text).toContain("o'zgarishingiz to'liq saqlanmadi — hozirgi holatni tekshirib, kerak bo'lsa qayta saqlang");
    expect(text).not.toContain('Saqlandi');
  });

  it('o\'chirilgan buyurtma: saqlab bo\'lmaydigan forma o\'rniga faqat ko\'rish va tushuntirish', async () => {
    s.order = order({ deletedAt: new Date('2026-10-09T00:00:00Z'), status: 'processing' });
    const { html, text } = await page();
    expect(text).toContain("Bu buyurtma o'chirilgan — faqat ko'rish uchun");
    expect(html).not.toContain('name="prevStatus"');
    expect(html).not.toContain('<select');
    expect(text).not.toContain('Saqlash');
    expect(text).not.toContain('Hisob-faktura yaratish');
    // Ma'lumotning o'zi ko'rinadi
    expect(text).toContain('Buyurtma #12');
    expect(text).toContain('Tayyorlanmoqda');
    expect(text).toContain('Quti 30x20');
  });

  it('"mijozga xabar boradi" faqat mijoz boti ishlayotgan va chat ulangan bo\'lsa yoziladi', async () => {
    const linked = "Mijoz Telegram botga ulangan — holat yoki to'lov o'zgarsa unga xabar boradi.";
    // Token yo'q: eski tizimdan qolgan ulanish (telegramUserId) bo'lsa ham xabar bormaydi
    s.recipients = [{ telegramId: '777', lang: 'uz' }];
    let text = (await page()).text;
    expect(text).not.toContain(linked);
    expect(text).toContain('Mijoz boti hali ulanmagan (serverda bot tokeni kiritilmagan)');

    tokens('111:customer', '');
    text = (await page()).text;
    expect(text).toContain(linked);

    s.recipients = [];
    text = (await page()).text;
    expect(text).not.toContain(linked);
    expect(text).toContain("Mijoz Telegram botga ulanmagan — o'zgarishlar haqida unga xabar bormaydi.");
  });
});

describe('admin: Xodimlar sahifasi', () => {
  const page = (sp: Record<string, string> = {}) => render(StaffPage({ searchParams: Promise.resolve(sp) }));
  const soon = () => new Date(Date.now() + 20 * 60_000);
  const NO_BOT = 'Boshqaruv boti tokeni hali kiritilmagan';
  const CODE_BUTTON = /<button[^>]*>Telegram kodi<\/button>/;

  it('boshqaruv boti tokeni kiritilmagan: ogohlantirish chiqadi va «Telegram kodi» tugmasi yashiriladi', async () => {
    const { html, text } = await page();
    expect(text).toContain(NO_BOT);
    expect(text).toContain('deploy/bots-setup.sh');
    expect(html).not.toMatch(CODE_BUTTON);
    // Qolgan amallar joyida
    expect(text).toContain('Saqlash');
    expect(text).toContain('Telegram xabar');
    // Eski sahifadan bosilgan tugma: amal rad etadi (admin-actions.test.ts) va sababi tushunarli matn bilan chiqadi
    expect((await page({ error: 'tgNoBot' })).text).toContain('Telegram kodi berilmadi');
  });

  it('token kiritilgan (yangi yoki eski nomdagi kalit): ogohlantirish yo\'q, tugma har bir xodimda bor', async () => {
    tokens('', '222:staff');
    let r = await page();
    expect(r.text).not.toContain(NO_BOT);
    expect(r.html).toMatch(CODE_BUTTON);
    tokens('', '', '333:legacy');
    r = await page();
    expect(r.text).not.toContain(NO_BOT);
    expect(r.html).toMatch(CODE_BUTTON);
  });

  it('kod xabari faqat manzildagi kod shu xodimning bazadagi amaldagi kodi bo\'lsa chiqadi', async () => {
    tokens('', '222:staff');
    s.staff = [staffRow({ telegramCode: '042917', otpExpiry: soon() })];
    const { html, text } = await page({ code: '042917', for: '5' });
    expect(text).toContain('Vali Xodim uchun Telegram kodi: 042917');
    expect(html).toContain('>042917</b>');
    expect(text).not.toContain('endi amal qilmaydi');
  });

  it('qo\'lda yozilgan, ishlatilgan, muddati o\'tgan, almashtirilgan yoki boshqa xodimning kodi "amal qiladi" deb ko\'rsatilmaydi', async () => {
    tokens('', '222:staff');
    const other = staffRow({ id: 6, name: 'Boshqa Xodim', phone: '998901112244', telegramCode: '042917', otpExpiry: soon() });
    const cases: [string, Record<string, unknown>[], Record<string, string>][] = [
      ['qo\'lda yozilgan', [staffRow()], { code: '000000', for: '5' }],
      ['ishlatilgan (bazada kod yo\'q)', [staffRow({ telegramId: '900', telegramCode: null, otpExpiry: null })], { code: '042917', for: '5' }],
      ['muddati o\'tgan', [staffRow({ telegramCode: '042917', otpExpiry: new Date(Date.now() - 1_000) })], { code: '042917', for: '5' }],
      ['muddat belgisi yo\'q', [staffRow({ telegramCode: '042917', otpExpiry: null })], { code: '042917', for: '5' }],
      ['o\'rniga yangisi berilgan', [staffRow({ telegramCode: '777777', otpExpiry: soon() })], { code: '042917', for: '5' }],
      ['boshqa xodimning kodi', [staffRow(), other], { code: '042917', for: '5' }],
      ['xodim ko\'rsatilmagan', [other], { code: '042917' }],
    ];
    for (const [name, staff, sp] of cases) {
      s.staff = staff;
      const { text } = await page(sp);
      expect(text, name).not.toContain('uchun Telegram kodi:');
      expect(text, name).not.toContain(sp.code);
      expect(text, name).toContain('Bu Telegram kodi endi amal qilmaydi');
    }
  });

  it('manzilda kod bo\'lmasa (yoki 6 xonali son bo\'lmasa) hech qanday kod xabari chiqmaydi', async () => {
    tokens('', '222:staff');
    s.staff = [staffRow({ telegramCode: '042917', otpExpiry: soon() })];
    for (const sp of [{}, { for: '5' }, { code: '42917', for: '5' }, { code: 'abcdef', for: '5' }] as Record<string, string>[]) {
      const { text } = await page(sp);
      expect(text).not.toContain('uchun Telegram kodi:');
      expect(text).not.toContain('endi amal qilmaydi');
      expect(text).not.toContain('042917');
    }
  });
});

describe('admin: Sozlamalar sahifasi — botlar haqidagi yordam matni', () => {
  const page = () => render(SettingsPage({ searchParams: Promise.resolve({}) }));
  const CUSTOMER_OFF = 'Mijoz boti hali ishlamaydi (tokeni kiritilmagan)';
  const STAFF_OFF = 'Boshqaruv boti hali ishlamaydi (tokeni kiritilmagan)';
  const CUSTOMER_ON = 'Mijozlar botni saytdagi tugmalardan';
  const STAFF_ON = 'Xodimlar boshqaruv botiga';

  it('token kiritilmagan bot "ishlayapti" deb ta\'riflanmaydi', async () => {
    const { text } = await page();
    expect(text).toContain(CUSTOMER_OFF);
    expect(text).toContain(STAFF_OFF);
    expect(text).toContain("«Telegram'da kuzatish» tugmasi chiqmaydi");
    expect(text).not.toContain(CUSTOMER_ON);
    expect(text).not.toContain(STAFF_ON);
    expect(text).toContain('Hech bir bot tokeni sozlanmagan');
  });

  it('har bir bot o\'z tokeniga qarab ta\'riflanadi', async () => {
    tokens('111:customer', '');
    let text = (await page()).text;
    expect(text).toContain(CUSTOMER_ON);
    expect(text).not.toContain(CUSTOMER_OFF);
    expect(text).toContain(STAFF_OFF);

    tokens('111:customer', '222:staff');
    text = (await page()).text;
    expect(text).toContain(CUSTOMER_ON);
    expect(text).toContain(STAFF_ON);
    expect(text).not.toContain('hali ishlamaydi');
  });
});
