import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { can } from '@/lib/auth/permissions';

/**
 * Sahifalar botlar haqida faqat rostini aytishi: bot tokeni kiritilmagan holatda (ishchi serverda botlar ulanmaguncha shunday)
 * "Telegram'da kuzatish" tugmasi, "Telegram kodi" va "xabar boradi" degan va'dalar chiqmasligi; Xodimlar sahifasidagi kod xabari
 * faqat bazadagi amaldagi kod uchun; o'chirilgan buyurtma faqat ko'rish uchun; buyurtmaning to'lov holati maydoni faqat moliya
 * ruxsati bor xodimga chiqadi (xodim saqlay olmaydigan maydonni ko'rmaydi). AI tekshiruv sahifasidagi «Server holati» kartasi ham
 * shu qoidaga bo'ysunadi: muammo bor paytda yashil "Kuzatuvda" belgisi va "xabar boradi" degan gap chiqmasligi kerak.
 * Xato qo'yilgan "to'landi" belgisi bekor qilingach buyurtma sahifasi hisob-faktura bilan nima bo'lganini aytadi (xabar va "Tarix");
 * hisob-faktura sahifasidagi «Qayta ochish» faqat tuzatish kerak bo'lgan holatda chiqadi.
 * Server komponentlari to'g'ridan-to'g'ri chaqiriladi va HTML'ga aylantiriladi; baza, sessiya va Telegram soxta.
 */
// Vitest .tsx fayllarni klassik JSX (React.createElement) bilan o'giradi — sahifa modullari global React'ni kutadi
(globalThis as { React?: unknown }).React = React;

const s = vi.hoisted(() => ({
  // Sahifani ochgan xodimning roli: buyurtma sahifasidagi to'lov maydoni "finance" ruxsatiga bog'liq (ruxsatlar jadvali haqiqiy)
  role: 'admin' as 'admin' | 'manager' | 'staff',
  // Sahifalar requireStaff'dan so'ragan bo'limlar (kelgan tartibda)
  sections: [] as string[],
  order: null as Record<string, unknown> | null,
  // Hisob-faktura sahifasi uchun: buyurtmasi va shartnomasi ichida (null — topilmadi)
  invoice: null as Record<string, unknown> | null,
  staff: [] as Record<string, unknown>[],
  // Mijoz botidan xabar oladigan chatlar (null — ro'yxatni aniqlab bo'lmadi)
  recipients: [] as { telegramId: string; lang: string }[] | null,
  settings: {} as Record<string, unknown>,
  // «Server holati» kartasi uchun: SiteSetting("ops") qiymati (null — signal hali kelmagan), boshqaruv botiga ulangan faol
  // administratorlarning Telegram ID lari (null — ro'yxatni o'qib bo'lmadi) va xabarlar navbati sanoqlari
  ops: null as Record<string, unknown> | null,
  admins: [] as string[] | null,
  queue: { pending: 0, stuck: 0, failed24h: 0 },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => React.createElement('a', { href, ...rest }, children) }));
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/auth', () => ({ requireStaff: async (section?: string) => { s.sections.push(String(section)); return { id: 1, name: 'Admin Ali', role: s.role }; } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    order: { findUnique: async () => s.order },
    corporateInvoice: { findFirst: async () => null, findUnique: async () => s.invoice },
    contract: { findMany: async () => [] },
    workOrder: { findMany: async () => [] },
    user: {
      // Xodimlar sahifasi hamma xodimni so'raydi; server kartasi (ops.ts alertChats) esa faqat administratorlarning Telegram ID larini
      findMany: async (args?: { where?: { role?: unknown } }) => {
        if (args?.where?.role !== 'admin') return s.staff;
        if (!s.admins) throw new Error('test: administratorlar ro\'yxatini o\'qib bo\'lmadi');
        return s.admins.map((telegramId) => ({ telegramId }));
      },
    },
    // AI tekshiruv sahifasi: hisobotlar va AI sarfi bo'sh; server holati va navbat — `s` dan
    auditReport: { findUnique: async () => null, findMany: async () => [] },
    aiUsage: { findUnique: async () => null, aggregate: async () => ({ _sum: { requests: null, inputTokens: null, outputTokens: null } }) },
    siteSetting: { findUnique: async ({ where }: { where: { key: string } }) => (where.key === 'ops' && s.ops ? { key: 'ops', value: s.ops } : null) },
    botOutbox: { count: async ({ where }: { where: { failedAt?: unknown; createdAt?: unknown } }) => (where.failedAt ? s.queue.failed24h : where.createdAt ? s.queue.stuck : s.queue.pending) },
  },
}));
vi.mock('@/lib/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings')>('@/lib/settings');
  return { getSettings: async () => ({ ...actual.defaultSettings, ...s.settings }) };
});
vi.mock('@/lib/orders', () => ({ paymentUrl: () => null }));
vi.mock('@/lib/telegram/customers', () => ({
  orderRecipients: async () => {
    if (!s.recipients) throw new Error('test: mijoz chatlarini aniqlab bo\'lmadi');
    return s.recipients;
  },
}));
vi.mock('@/lib/telegram/setup', () => ({ botStatuses: async () => [] }));
const action = async () => undefined;
vi.mock('@/app/admin/(panel)/orders/actions', () => ({ updateOrder: action }));
// Hisob-faktura amallari alohida-alohida soxta funksiya: sahifadagi har bir forma aynan qaysi amalga ulangani tekshiriladi
vi.mock('@/app/admin/(panel)/invoices/actions', () => ({
  createInvoiceForOrder: async () => undefined,
  markPaid: async () => undefined,
  registerPartial: async () => undefined,
  cancelInvoice: async () => undefined,
  reopenInvoice: async () => undefined,
  linkContract: async () => undefined,
}));
vi.mock('@/app/admin/(panel)/staff/actions', () => ({ createStaff: action, issueTelegramCode: action, unlinkTelegram: action, updateStaff: action }));
vi.mock('@/app/admin/(panel)/settings/actions', () => ({ updateSettings: action }));
vi.mock('@/app/admin/(panel)/settings/telegramActions', () => ({ removeTelegramWebhooks: action, setupTelegramWebhooks: action }));
vi.mock('@/app/admin/(panel)/audit/actions', () => ({ runAuditNow: action }));

const { default: OrderPage } = await import('@/app/[lang]/orders/[token]/page');
const { default: AdminOrderPage } = await import('@/app/admin/(panel)/orders/[id]/page');
const { default: InvoicePage } = await import('@/app/admin/(panel)/invoices/[id]/page');
const invoiceActions: Record<string, unknown> = await import('@/app/admin/(panel)/invoices/actions');
const { default: StaffPage } = await import('@/app/admin/(panel)/staff/page');
const { default: SettingsPage } = await import('@/app/admin/(panel)/settings/page');
const { default: AuditPage } = await import('@/app/admin/(panel)/audit/page');

/** HTML'dan oddiy matn: teglarsiz, belgilar qaytarilgan */
const toText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
/** HTML va undan ajratilgan oddiy matn */
const render = async (page: Promise<React.ReactElement>) => {
  const html = renderToStaticMarkup(await page);
  return { html, text: toText(html) };
};
const tokens = (customer: string, staff: string, legacyStaff = '') => {
  vi.stubEnv('CUSTOMER_BOT_TOKEN', customer);
  vi.stubEnv('STAFF_BOT_TOKEN', staff);
  vi.stubEnv('SUPERVISOR_BOT_TOKEN', legacyStaff);
};
/** Sahifa tepasidagi xabarlar (Notice) chiqqan tartibda: turi (ok — yashil, warn — sariq) va matni */
const notices = (html: string) => [...html.matchAll(/<p class="mb-4 rounded-lg p-3 text-sm bg-(emerald|amber)-50[^"]*">([\s\S]*?)<\/p>/g)].map((m) => ({ tone: m[1] === 'emerald' ? 'ok' : 'warn', text: toText(m[2]).trim() }));
/** Sahifa qaytargan daraxtdagi <form> elementlari, chiqish tartibida — har birining `action`i qaysi amal ekanini ko'rish uchun (HTML'da bu ko'rinmaydi) */
const formsOf = (node: React.ReactNode): React.ReactElement<{ action?: unknown; children?: React.ReactNode }>[] => {
  if (Array.isArray(node)) return node.flatMap(formsOf);
  if (!React.isValidElement<{ action?: unknown; children?: React.ReactNode }>(node)) return [];
  return [...(node.type === 'form' ? [node] : []), ...formsOf(node.props.children)];
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
  s.role = 'admin';
  s.sections = [];
  s.order = order();
  s.invoice = null;
  s.staff = [staffRow()];
  s.recipients = [];
  s.settings = {};
  s.ops = null;
  s.admins = [];
  s.queue = { pending: 0, stuck: 0, failed24h: 0 };
  tokens('', '');
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY']) vi.stubEnv(key, '');
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

  // "To'landi" belgisi bekor qilingach updateOrder manzilga invoice=reopened / invoice=paid qo'shadi (admin-actions.test.ts): xodim
  // hisob-faktura qayta ochilganini yoki — eng muhimi — to'langan holida QOLGANINI shu sahifaning o'zida ko'radi. Holat ziddiyatga
  // uchragan so'rovda ham belgi bekor qilingan bo'lishi mumkin (ikkalasi alohida qo'llanadi) — xabar error=conflict bilan ham chiqadi
  describe('belgi bekor qilingandan keyingi xabar (?saved=1&invoice=… yoki ?error=conflict&invoice=…)', () => {
    const REOPENED = "Shu to'lov belgisi yopgan hisob-faktura qayta ochildi.";
    // Ogohlantirish ikkala sababni ham aytadi (belgi yangilanishdan oldin qo'yilgan yoki hisob-faktura alohida to'langan) va nima qilishni
    const STILL_PAID = "Buyurtma «to'lanmagan» deb belgilandi, lekin hisob-fakturasi to'langan holida qoldi (avtomatik ochilmadi: yangilanishdan oldingi belgi yoki alohida to'lov). Hisob-faktura sahifasida tekshiring — to'lov haqiqatan kelmagan bo'lsa u yerda «Qayta ochish» tugmasini bosing.";
    const CONFLICT = "Siz sahifani ochganingizdan keyin buyurtmani boshqa xodim yoki bot o'zgartirgan, shuning uchun o'zgarishingiz to'liq saqlanmadi — hozirgi holatni tekshirib, kerak bo'lsa qayta saqlang.";
    /** Bekor qilishdan keyingi holat: buyurtma "to'lanmagan", hisob-fakturasi esa "to'langan" */
    const unpaidWithPaidInvoice = () => order({ paymentMethod: 'bank_transfer', corporateInvoices: [{ id: 3, invoiceNo: 'INV-2026-0007', status: 'paid', dueDate: new Date('2026-10-20T00:00:00Z') }] });
    const INVOICE_LINK = /<a[^>]*href="\/admin\/invoices\/3"[^>]*>INV-2026-0007<\/a>/;

    it('invoice=reopened: "Saqlandi" yonida hisob-faktura qayta ochilgani aytiladi', async () => {
      const { html } = await page({ saved: '1', invoice: 'reopened' });
      expect(notices(html)).toEqual([{ tone: 'ok', text: 'Saqlandi' }, { tone: 'ok', text: REOPENED }]);
    });

    it('invoice=paid: hisob-faktura to\'langan holida qolgani ogohlantirish bo\'lib chiqadi; hisob-faktura sahifasiga havola shu sahifada bor', async () => {
      s.order = unpaidWithPaidInvoice();
      const { html, text } = await page({ saved: '1', invoice: 'paid' });
      expect(notices(html)).toEqual([{ tone: 'ok', text: 'Saqlandi' }, { tone: 'warn', text: STILL_PAID }]);
      expect(html).toMatch(INVOICE_LINK);
      expect(text).toContain("To'lov (Bank o'tkazmasi) To'lanmagan");
    });

    it('holat ziddiyatga uchragan so\'rov (?error=conflict&invoice=paid): ziddiyat ogohlantirishi ham, hisob-faktura ogohlantirishi ham chiqadi — "Saqlandi"siz', async () => {
      s.order = unpaidWithPaidInvoice();
      const { html, text } = await page({ error: 'conflict', invoice: 'paid' });
      expect(notices(html)).toEqual([{ tone: 'warn', text: STILL_PAID }, { tone: 'warn', text: CONFLICT }]);
      expect(text).not.toContain('Saqlandi');
      expect(text).not.toContain(REOPENED);
      // Ogohlantirish aytgan hisob-faktura sahifasiga havola shu yerda ham bor
      expect(html).toMatch(INVOICE_LINK);
    });

    it('holat ziddiyatga uchragan so\'rov (?error=conflict&invoice=reopened): hisob-faktura qayta ochilgani ziddiyat ogohlantirishi bilan birga chiqadi', async () => {
      const { html, text } = await page({ error: 'conflict', invoice: 'reopened' });
      expect(notices(html)).toEqual([{ tone: 'ok', text: REOPENED }, { tone: 'warn', text: CONFLICT }]);
      expect(text).not.toContain('Saqlandi');
      expect(text).not.toContain("to'langan holida qoldi");
    });

    it('saved=1 ham, error=conflict ham bo\'lmasa yoki invoice qiymati boshqa bo\'lsa bu xabarlar chiqmaydi', async () => {
      const others: Record<string, string>[] = [
        {}, { saved: '1' }, { error: 'conflict' }, { invoice: 'reopened' }, { invoice: 'paid' }, { saved: '0', invoice: 'paid' }, { saved: '1', invoice: 'other' },
        { error: 'conflict', invoice: 'other' }, { error: 'finance', invoice: 'reopened' }, { error: 'finance', invoice: 'paid' }, { error: 'other', invoice: 'paid' },
      ];
      for (const sp of others) {
        const { text } = await page(sp);
        expect(text, JSON.stringify(sp)).not.toContain(REOPENED);
        expect(text, JSON.stringify(sp)).not.toContain("to'langan holida qoldi");
      }
      expect(notices((await page({ saved: '1' })).html)).toEqual([{ tone: 'ok', text: 'Saqlandi' }]);
      expect(notices((await page({ error: 'conflict' })).html)).toEqual([{ tone: 'warn', text: CONFLICT }]);
      // Yalang'och ?invoice=… (qo'lda yozilgan manzil): hisob-faktura xabari ham, ziddiyat ogohlantirishi ham yo'q
      s.order = unpaidWithPaidInvoice();
      expect(notices((await page({ invoice: 'paid' })).html)).toEqual([]);
      expect(notices((await page({ invoice: 'reopened' })).html)).toEqual([]);
    });
  });

  // To'lov yozuvi hisob-fakturani yopgan yoki qayta ochgan bo'lsa "Tarix"da shu ham ko'rinadi (OrderEvent.meta — orderFlow yozadi);
  // "invoice" turidagi yozuv — hisob-faktura sahifasidagi «Qayta ochish» amali
  describe('"Tarix" jadvali', () => {
    /** Jadval satrlari, chiqish tartibida: [vaqt, o'zgarish, kim, qayerdan] */
    const history = (html: string) => {
      const body = /Tarix<\/h2>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? '';
      return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => toText(cell[1]).trim()));
    };
    const event = (id: number, over: Record<string, unknown> = {}) => ({ id, orderId: 12, kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'Admin Ali', via: 'admin', meta: null, createdAt: new Date('2026-10-10T06:00:00Z'), ...over });
    const SNAPSHOT = { id: 3, status: 'issued', paidAmount: '0', paidAt: null };
    const PAID = "To'lov: To'lanmagan → To'langan";
    const UNDONE = "To'lov: To'langan → To'lanmagan";

    it('hisob-fakturani yopgan to\'lov, uni qayta ochgan bekor qilish va «Qayta ochish» amali o\'z yozuvi bilan chiqadi', async () => {
      s.order = order({
        events: [
          event(4, { kind: 'invoice', fromValue: 'paid', toValue: 'issued', actor: 'Menejer Sora', via: 'invoice', meta: { invoiceNo: 'INV-2026-0007' } }),
          event(3, { fromValue: 'paid', toValue: 'pending', via: 'staff_bot', meta: { reopened: ['INV-2026-0007'] } }),
          event(2, { via: 'invoice', meta: { invoices: [SNAPSHOT] } }),
          event(1, { kind: 'status', fromValue: null, toValue: 'new_', actor: null, via: 'system' }),
        ],
      });
      const rows = history((await page()).html);
      expect(rows.map((row) => row.slice(1))).toEqual([
        ['Hisob-faktura INV-2026-0007: qayta ochildi', 'Menejer Sora', 'hisob-faktura'],
        [`${UNDONE} · hisob-faktura qayta ochildi`, 'Admin Ali', 'boshqaruv boti'],
        [`${PAID} · hisob-faktura yopildi`, 'Admin Ali', 'hisob-faktura'],
        ['Holat: Yangi', '—', 'tizim'],
      ]);
      // Vaqt Toshkent vaqti bilan (06:00 UTC)
      expect(rows[0][0]).toMatch(/^10\.10\.2026,? 11:00$/);
    });

    it('hisob-fakturaga tegmagan to\'lov yozuvi (surat yo\'q yoki bo\'sh) oddiy ko\'rinishda', async () => {
      s.order = order({
        events: [
          event(5, { fromValue: 'paid', toValue: 'pending', meta: { reopened: [] } }),
          event(4, { fromValue: 'paid', toValue: 'pending' }),
          event(3, { meta: { invoices: [] } }),
          event(2, { via: 'payme', actor: 'Payme' }),
          // Holat yozuvida meta bo'lsa ham hisob-faktura haqida hech narsa qo'shilmaydi
          event(1, { kind: 'status', fromValue: 'new_', toValue: 'processing', meta: { invoices: [SNAPSHOT], reopened: ['INV-2026-0007'] } }),
        ],
      });
      expect(history((await page()).html).map((row) => row[1])).toEqual([UNDONE, UNDONE, PAID, PAID, 'Holat: Yangi → Tayyorlanmoqda']);
    });

    it('shakli buzilgan meta (massiv, satr, son, null, kutilmagan turdagi maydon) sahifani to\'xtatmaydi — oddiy satr chiqadi', async () => {
      const malformed: unknown[] = [[SNAPSHOT], 'invoices', 7, true, null, {}, { invoices: 'INV-2026-0007' }, { invoices: { length: 1 } }, { reopened: 'INV-2026-0007' }, { invoices: null, reopened: null }];
      s.order = order({ events: malformed.map((meta, i) => event(i + 1, { meta })) });
      expect(history((await page()).html).map((row) => row[1])).toEqual(malformed.map(() => PAID));
      // «Qayta ochish» yozuvida raqam yo'q yoki satr emas: raqamsiz chiqadi
      const noNumber: unknown[] = [null, [], ['INV-2026-0007'], 'INV-2026-0007', {}, { invoiceNo: 7 }, { invoiceNo: null }];
      s.order = order({ events: noNumber.map((meta, i) => event(i + 1, { kind: 'invoice', fromValue: 'paid', toValue: 'issued', via: 'invoice', meta })) });
      expect(history((await page()).html).map((row) => row[1])).toEqual(noNumber.map(() => 'Hisob-faktura: qayta ochildi'));
    });
  });

  // To'lov holati hisob-fakturani ham yopadi/ochadi — maydon faqat "finance" (moliya) ruxsati bor xodimga chiqadi; amalning o'zi ham
  // shuni tekshiradi (admin-actions.test.ts). Ruxsatsiz xodim holatni o'zgartira oladi, to'lovni esa faqat ko'radi
  describe('to\'lov holati maydoni', () => {
    const NO_FINANCE = "To'lov holatini moliya ruxsati bor xodim (menejer yoki administrator) o'zgartiradi.";
    const DENIED = "To'lov holatini faqat moliya ruxsati bor xodim (menejer yoki administrator) o'zgartiradi — to'lov o'zgarishi saqlanmadi.";
    const UNDO_HINT = "Belgi xato qo'yilgan bo'lsa «To'lanmagan»ni tanlang: shu belgi yopgan hisob-faktura qayta ochiladi va mijozga tuzatish xabari boradi.";
    /** Mijozga xabar bormaydigan holatdagi yordam: xabar haqidagi va'dasiz */
    const UNDO_HINT_NO_MESSAGE = "Belgi xato qo'yilgan bo'lsa «To'lanmagan»ni tanlang: shu belgi yopgan hisob-faktura qayta ochiladi.";
    const ONLINE = "Onlayn to'lov holatini to'lov tizimi o'zi yangilaydi.";
    /** To'lov tanlovi: variantlari va tanlangani (tanlov sahifada bo'lmasa — null) */
    const paymentSelect = (html: string) => {
      const select = /<select name="paymentStatus"[^>]*>(.*?)<\/select>/.exec(html);
      if (!select) return null;
      return { options: [...select[1].matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]), selected: [...select[1].matchAll(/<option value="([^"]+)" selected=""/g)].map((m) => m[1]) };
    };

    it.each(['admin', 'manager'] as const)('moliya ruxsati bor xodim (%s): tanlov va forma ko\'rgan to\'lov holati (prevPaymentStatus) chiqadi', async (role) => {
      s.role = role;
      const { html, text } = await page();
      expect(paymentSelect(html)).toEqual({ options: ['pending', 'paid', 'refunded'], selected: ['pending'] });
      expect(html).toContain('name="prevPaymentStatus" value="pending"');
      expect(text).not.toContain(NO_FINANCE);
      expect(text).not.toContain(ONLINE);
      // Bank o'tkazmasi ham qo'lda belgilanadi
      s.order = order({ paymentMethod: 'bank_transfer', paymentStatus: 'refunded' });
      const bank = await page();
      expect(paymentSelect(bank.html)).toEqual({ options: ['pending', 'paid', 'refunded'], selected: ['refunded'] });
      expect(bank.html).toContain('name="prevPaymentStatus" value="refunded"');
    });

    it('moliya ruxsati yo\'q xodim (staff): to\'lov tanlovi ham, prevPaymentStatus ham yo\'q — o\'rnida tushuntirish; holat formasi joyida', async () => {
      s.role = 'staff';
      for (const paymentMethod of ['cash', 'bank_transfer']) {
        s.order = order({ paymentMethod });
        const { html, text } = await page();
        expect(html, paymentMethod).not.toContain('name="paymentStatus"');
        // Yashirin maydon ham yo'q: amal prevPaymentStatus siz kelgan to'lov o'zgarishini ruxsatsiz xodimdan qabul qilmaydi
        expect(html, paymentMethod).not.toContain('name="prevPaymentStatus"');
        expect(text, paymentMethod).toContain(NO_FINANCE);
        expect(text, paymentMethod).not.toContain(ONLINE);
        // Holatni o'zgartirish formasi to'liq, to'lovning hozirgi holati esa ko'rinib turadi
        expect(html, paymentMethod).toContain('<select name="status"');
        expect(html, paymentMethod).toContain('name="prevStatus" value="new_"');
        expect(text, paymentMethod).toContain('Saqlash');
        expect(text, paymentMethod).toContain(`To'lov (${paymentMethod === 'cash' ? 'Naqd' : "Bank o'tkazmasi"}) To'lanmagan`);
        // Ruxsat yo'qligi xato emas: ogohlantirish faqat rad etilgan saqlashdan keyin chiqadi
        expect(text, paymentMethod).not.toContain(DENIED);
      }
    });

    it('rad etilgan to\'lov o\'zgarishi (?error=finance): xodimga to\'lov saqlanmagani aytiladi, "Saqlandi" chiqmaydi', async () => {
      s.role = 'staff';
      const { text } = await page({ error: 'finance' });
      expect(text).toContain(DENIED);
      expect(text).not.toContain('Saqlandi');
      expect(text).not.toContain("o'zgarishingiz to'liq saqlanmadi");
      // Boshqa natijalarda bu ogohlantirish yo'q
      for (const sp of [{}, { saved: '1' }, { error: 'conflict' }] as Record<string, string>[]) expect((await page(sp)).text, JSON.stringify(sp)).not.toContain(DENIED);
    });

    it('"Belgi xato qo\'yilgan bo\'lsa…" yordami faqat to\'langan buyurtmada va faqat tanlov chiqadigan xodimga', async () => {
      // Yordam "mijozga tuzatish xabari boradi" deydi — bu faqat mijoz boti ishlayotgan va mijoz ulangan holatda rost, shu holatda
      // tekshiriladi (qolgan holatlar — keyingi testda)
      tokens('111:customer', '');
      s.recipients = [{ telegramId: '777', lang: 'uz' }];
      for (const role of ['admin', 'manager'] as const) {
        s.role = role;
        for (const paymentMethod of ['cash', 'bank_transfer']) {
          s.order = order({ paymentMethod, paymentStatus: 'paid' });
          const { html, text } = await page();
          expect(text, `${role} ${paymentMethod}`).toContain(UNDO_HINT);
          // Bekor qilish — shu tanlovda «To'lanmagan»ni saqlash: forma hozirgi "to'langan" holatni kutilgan qiymat qilib yuboradi
          expect(paymentSelect(html), `${role} ${paymentMethod}`).toEqual({ options: ['pending', 'paid', 'refunded'], selected: ['paid'] });
          expect(html, `${role} ${paymentMethod}`).toContain('name="prevPaymentStatus" value="paid"');
        }
        for (const paymentStatus of ['pending', 'refunded']) {
          s.order = order({ paymentStatus });
          expect((await page()).text, `${role} ${paymentStatus}`).not.toContain('Belgi xato');
        }
      }
      // Ruxsatsiz xodim belgini bekor qila olmaydi — unga yordam ham ko'rsatilmaydi
      s.role = 'staff';
      s.order = order({ paymentStatus: 'paid' });
      const { text } = await page();
      expect(text).not.toContain('Belgi xato');
      expect(text).toContain(NO_FINANCE);
      expect(text).toContain("To'lov (Naqd) To'langan");
    });

    // Tuzatish xabari faqat mijoz boti orqali boradi (orderNotify): bot tokeni kiritilmagan yoki mijoz botga ulanmagan bo'lsa yordam
    // uni va'da qilmaydi — pastdagi "Mijoz ... ulanmagan — xabar bormaydi" yozuviga zid chiqmasin
    it('bekor qilish yordami "mijozga tuzatish xabari boradi" deb faqat mijoz boti ishlayotgan VA mijoz unga ulangan bo\'lsa yozadi', async () => {
      const linked = [{ telegramId: '777', lang: 'uz' }];
      const cases: [string, string, typeof s.recipients, boolean][] = [
        ['bot tokeni ham, ulanish ham yo\'q', '', [], false],
        ['token yo\'q, eski tizimdan qolgan ulanish bor', '', linked, false],
        ['token bor, mijoz ulanmagan', 'ci-dummy-customer-bot-secret', [], false],
        ['token bor, ulanishni aniqlab bo\'lmadi', 'ci-dummy-customer-bot-secret', null, false],
        ['token bor, mijoz ulangan', 'ci-dummy-customer-bot-secret', linked, true],
      ];
      for (const paymentMethod of ['cash', 'bank_transfer']) {
        s.order = order({ paymentMethod, paymentStatus: 'paid' });
        for (const [name, token, recipients, promised] of cases) {
          tokens(token, '');
          s.recipients = recipients;
          const { text } = await page();
          expect(text, `${paymentMethod}: ${name}`).toContain(promised ? UNDO_HINT : UNDO_HINT_NO_MESSAGE);
          expect(text.includes('mijozga tuzatish xabari boradi'), `${paymentMethod}: ${name}`).toBe(promised);
        }
      }
      // Boshqaruv boti tokeni mijoz botini "ishlaydigan" qilmaydi
      tokens('', 'ci-dummy-staff-bot-secret');
      s.recipients = linked;
      const { text } = await page();
      expect(text).toContain(UNDO_HINT_NO_MESSAGE);
      expect(text).not.toContain('mijozga tuzatish xabari boradi');
    });

    it('onlayn to\'lov (Payme, Click): tanlov hech kimga chiqmaydi, to\'langan bo\'lsa ham bekor qilish yordami yo\'q', async () => {
      for (const role of ['admin', 'manager', 'staff'] as const) {
        s.role = role;
        for (const paymentMethod of ['payme', 'click']) {
          s.order = order({ paymentMethod, paymentStatus: 'paid' });
          const { html, text } = await page();
          expect(paymentSelect(html), `${role} ${paymentMethod}`).toBeNull();
          expect(text, `${role} ${paymentMethod}`).toContain(ONLINE);
          expect(text, `${role} ${paymentMethod}`).not.toContain('Belgi xato');
          // Sabab ruxsatda emas — bu to'lovni to'lov tizimi yuritadi
          expect(text, `${role} ${paymentMethod}`).not.toContain(NO_FINANCE);
        }
      }
    });
  });
});

// To'langan hisob-faktura qanday tuzatilishi buyurtmaning to'lov holatiga bog'liq: buyurtma ham "to'langan" bo'lsa belgi buyurtma
// sahifasida bekor qilinadi (u hisob-fakturani o'zi ochadi); buyurtmadan to'lov hali kutilayotgan-u hisob-faktura "to'langan" bo'lib
// qolgan bo'lsa (surati yo'q eski belgi bekor qilingan yoki to'lov shu sahifada xato kiritilgan) — shu yerdagi «Qayta ochish»; puli
// qaytarilgan buyurtmaning to'langan hisob-fakturasi esa odatiy yakuniy holat — forma yo'q, faqat tushuntirish. Amalning o'zi ham aynan
// shu shart bilan ishlaydi: buyurtma "to'langan" ham, "qaytarilgan" ham bo'lmasagina ochadi (admin-actions.test.ts)
describe('admin: hisob-faktura sahifasi — «Qayta ochish» va belgini bekor qilish yordami', () => {
  const DAY = 86_400_000;
  const invoice = (over: Record<string, unknown> = {}, orderOver: Record<string, unknown> = {}) => ({
    id: 3, invoiceNo: 'INV-2026-0007', contractId: null, contract: null, orderId: 12, subtotal: 32143, vatPercent: 12, vatAmount: 3857, totalAmount: 36000,
    status: 'issued', dueDate: new Date(Date.now() + 10 * DAY), paidAmount: 0, paidAt: null, createdAt: new Date('2026-10-10T05:00:00Z'),
    order: order({ paymentMethod: 'bank_transfer', ...orderOver }),
    ...over,
  });
  const PAID = { status: 'paid', paidAmount: 36000, paidAt: new Date('2026-10-10T07:00:00Z') };
  /** Sahifa: HTML, matni va formalari — har biri qaysi amalga ulangani (amal nomi) va o'z HTML'i bilan */
  const view = async (sp: Record<string, string> = {}) => {
    const tree = await InvoicePage({ params: Promise.resolve({ id: '3' }), searchParams: Promise.resolve(sp) });
    const html = renderToStaticMarkup(tree);
    const forms = formsOf(tree).map((form) => ({ action: Object.keys(invoiceActions).find((name) => invoiceActions[name] === form.props.action) ?? 'noma\'lum', html: renderToStaticMarkup(form) }));
    return { html, text: toText(html), forms, actions: forms.map((form) => form.action) };
  };
  const REOPEN_BUTTON = /<button[^>]*>Qayta ochish<\/button>/;
  const ORDER_HINT = "To'lov xato kiritilgan bo'lsa: buyurtma sahifasida to'lov holatini «To'lanmagan»ga qaytaring — shu to'lov yopgan hisob-faktura qayta ochiladi.";
  const FULLY_PAID = "Hisob-faktura to'liq to'langan.";
  const CANCELLED = 'Hisob-faktura bekor qilingan.';
  /** «Qayta ochish» formasidagi tushuntirish: qayta ochish nimaga olib kelishi */
  const REOPEN_HELP = "To'lov xato kiritilgan bo'lsa hisob-fakturani qayta oching: to'langan summa 0 ga qaytadi (oldin qisman to'lov bo'lgan bo'lsa, uni qayta kiriting).";
  /** Avval tekshirish maslahati — faqat to'lovi qo'lda belgilanadigan (naqd / bank o'tkazmasi) buyurtmada */
  const MARK_ORDER_PAID = "Hisob-faktura haqiqatan to'langan bo'lsa, buyurtma sahifasida to'lovni «To'langan» qilib qo'ying.";
  /** Puli qaytarilgan buyurtmaning to'langan hisob-fakturasi: forma o'rnidagi tushuntirish va (qo'lda belgilanadigan to'lovda) tuzatish yo'li */
  const REFUNDED = "Buyurtma puli qaytarilgan — hisob-faktura hujjat sifatida to'langan holida qoladi (qarz hisoblanmaydi).";
  // Ikkala tuzatish ham aytiladi: to'lov haqiqatan kelgan bo'lsa «To'lanmagan» emas, «To'langan» to'g'ri (aks holda to'lagan mijozga "to'lanmagan" xabari ketardi)
  const REFUNDED_HINT = "«Qaytarilgan» xato tanlangan bo'lsa, buyurtma sahifasida tuzating: to'lov haqiqatan kelgan bo'lsa — «To'langan», kelmagan bo'lsa — «To'lanmagan» (shunda to'lov belgisi yopgan hisob-faktura avvalgi holatiga ochiladi va mijozga xabar boradi).";
  const ORDER_LINK = /<a[^>]*href="\/admin\/orders\/12"[^>]*>#12<\/a>/;
  /** Formaning ko'rinadigan matni (React qo'shadigan yordamchi skriptsiz) */
  const formText = (html: string) => toText(html.replace(/<script[\s\S]*?<\/script>/g, '')).trim();
  /** Ochiq hisob-fakturadagi formalar (tartib bilan); yopiq hisob-fakturada faqat oxirgisi qoladi */
  const OPEN_FORMS = ['markPaid', 'registerPartial', 'cancelInvoice', 'linkContract'];

  it('sahifa moliya bo\'limi ruxsatini so\'raydi', async () => {
    s.invoice = invoice();
    await view();
    expect(s.sections).toEqual(['finance']);
  });

  it('to\'langan hisob-faktura, buyurtma (naqd / bank o\'tkazmasi) "to\'lanmagan": «Qayta ochish» formasi shu hisob-faktura uchun chiqadi — avval buyurtmani tekshirish maslahati bilan', async () => {
    for (const paymentMethod of ['bank_transfer', 'cash']) {
      s.invoice = invoice(PAID, { paymentMethod, paymentStatus: 'pending' });
      const { html, text, forms, actions } = await view();
      expect(actions, paymentMethod).toEqual(['reopenInvoice', 'linkContract']);
      // Forma aynan «Qayta ochish» amaliga ulangan va shu hisob-faktura raqamini yuboradi
      expect(forms[0].html, paymentMethod).toContain('name="id" value="3"');
      expect(forms[0].html, paymentMethod).toMatch(REOPEN_BUTTON);
      expect(text, paymentMethod).toContain(FULLY_PAID);
      // Nega bu yerda turgani (buyurtmaning hozirgi to'lov holati), avval tekshirish (hisob-faktura haqiqatan to'langan bo'lishi mumkin —
      // unda buyurtma «To'langan» qilinadi) va qayta ochish nimaga olib kelishi aytiladi
      expect(formText(forms[0].html), paymentMethod).toBe(`Buyurtmaning to'lov holati — «To'lanmagan». ${MARK_ORDER_PAID} ${REOPEN_HELP} Qayta ochish`);
      // Maslahat aytgan buyurtma sahifasiga havola shu sahifada bor
      expect(html, paymentMethod).toMatch(ORDER_LINK);
      expect(text, paymentMethod).not.toContain(ORDER_HINT);
      expect(text, paymentMethod).not.toContain('puli qaytarilgan');
    }
  });

  // Onlayn to'lov holatini Payme/Click o'zi belgilaydi: buyurtma sahifasida uni «To'langan» qilib bo'lmaydi — bajarib bo'lmaydigan maslahat chiqmaydi
  it('to\'langan hisob-faktura, onlayn to\'lovli buyurtma (Payme, Click) hali to\'lanmagan: forma chiqadi, lekin «To\'langan» qilib qo\'ying degan maslahatsiz', async () => {
    for (const paymentMethod of ['payme', 'click']) {
      for (const [paymentStatus, name] of [['pending', "To'lanmagan"], ['processing', 'Jarayonda'], ['failed', "O'tmadi"]]) {
        s.invoice = invoice(PAID, { paymentMethod, paymentStatus });
        const { text, forms, actions } = await view();
        const label = `${paymentMethod} ${paymentStatus}`;
        expect(actions, label).toEqual(['reopenInvoice', 'linkContract']);
        expect(forms[0].html, label).toContain('name="id" value="3"');
        expect(forms[0].html, label).toMatch(REOPEN_BUTTON);
        expect(text, label).toContain(FULLY_PAID);
        expect(formText(forms[0].html), label).toBe(`Buyurtmaning to'lov holati — «${name}». ${REOPEN_HELP} Qayta ochish`);
        expect(text, label).not.toContain("qilib qo'ying");
        expect(text, label).not.toContain('buyurtma sahifasida');
        expect(text, label).not.toContain('puli qaytarilgan');
      }
    }
  });

  // Puli qaytarilgan buyurtmaning to'langan hisob-fakturasi — odatiy yakuniy holat (qarz sanalmaydi): reopenInvoice ham uni ochmaydi,
  // shuning uchun bosilsa rad etiladigan tugma chiqmaydi. «Qaytarilgan» xato tanlangan bo'lsa tuzatish buyurtma sahifasida — faqat
  // to'lovi qo'lda belgilanadigan buyurtmada (onlayn to'lovda u yerda tanlov yo'q)
  it('to\'langan hisob-faktura, puli qaytarilgan buyurtma: «Qayta ochish» yo\'q — oddiy tushuntirish; «To\'lanmagan»ga o\'tkazing maslahati faqat naqd / bank o\'tkazmasida', async () => {
    for (const paymentMethod of ['bank_transfer', 'cash', 'payme', 'click']) {
      s.invoice = invoice(PAID, { paymentMethod, paymentStatus: 'refunded' });
      const { html, text, actions } = await view();
      const manual = paymentMethod === 'bank_transfer' || paymentMethod === 'cash';
      expect(actions, paymentMethod).toEqual(['linkContract']);
      expect(html, paymentMethod).not.toMatch(REOPEN_BUTTON);
      expect(text, paymentMethod).not.toContain('Qayta ochish');
      expect(text, paymentMethod).not.toContain('qayta oching');
      expect(text, paymentMethod).toContain(FULLY_PAID);
      expect(text, paymentMethod).toContain(REFUNDED);
      expect(text.includes(REFUNDED_HINT), paymentMethod).toBe(manual);
      if (manual) {
        // Tushuntirishning davomi bo'lib chiqadi; aytilgan buyurtma sahifasiga havola shu sahifada bor
        expect(text, paymentMethod).toContain(`${REFUNDED} ${REFUNDED_HINT}`);
        expect(html, paymentMethod).toMatch(ORDER_LINK);
      } else {
        expect(text, paymentMethod).not.toContain("o'tkazing");
        expect(text, paymentMethod).not.toContain('xato tanlangan');
        expect(text, paymentMethod).not.toContain('buyurtma sahifasida');
      }
      // "To'langan" va "to'lanmagan" buyurtma uchun yozilgan yordamlar bu yerda chiqmaydi
      expect(text, paymentMethod).not.toContain(ORDER_HINT);
      expect(text, paymentMethod).not.toContain("Buyurtmaning to'lov holati —");
      expect(text, paymentMethod).not.toContain("qilib qo'ying");
    }
  });

  it('to\'langan hisob-faktura, buyurtma ham "to\'langan" (naqd / bank o\'tkazmasi): «Qayta ochish» yo\'q — belgi buyurtma sahifasida bekor qilinishi aytiladi', async () => {
    for (const paymentMethod of ['bank_transfer', 'cash']) {
      s.invoice = invoice(PAID, { paymentMethod, paymentStatus: 'paid' });
      const { html, text, actions } = await view();
      expect(actions, paymentMethod).toEqual(['linkContract']);
      expect(html, paymentMethod).not.toMatch(REOPEN_BUTTON);
      expect(text, paymentMethod).toContain(FULLY_PAID);
      expect(text, paymentMethod).toContain(ORDER_HINT);
      // Yordam aytgan buyurtma sahifasiga havola shu sahifada bor
      expect(html, paymentMethod).toMatch(ORDER_LINK);
      expect(text, paymentMethod).not.toContain('puli qaytarilgan');
    }
  });

  it('onlayn to\'langan buyurtma (Payme, Click): belgini qo\'lda bekor qilib bo\'lmaydi — yordam ham, «Qayta ochish» ham yo\'q', async () => {
    for (const paymentMethod of ['payme', 'click']) {
      s.invoice = invoice(PAID, { paymentMethod, paymentStatus: 'paid' });
      const { html, text, actions } = await view();
      expect(actions, paymentMethod).toEqual(['linkContract']);
      expect(html, paymentMethod).not.toMatch(REOPEN_BUTTON);
      expect(text, paymentMethod).toContain(FULLY_PAID);
      expect(text, paymentMethod).not.toContain('buyurtma sahifasida');
    }
  });

  it('ochiq hisob-faktura (berilgan, qisman, muddati o\'tgan): to\'lov formalari joyida, ortiqcha hech narsa yo\'q — buyurtma to\'lovi qanday bo\'lmasin', async () => {
    const open: [string, Record<string, unknown>][] = [
      ['berilgan', {}],
      ['qisman to\'langan', { status: 'partial', paidAmount: 10000 }],
      ['muddati o\'tgan', { dueDate: new Date(Date.now() - 3 * DAY) }],
    ];
    for (const [name, over] of open) {
      for (const paymentStatus of ['pending', 'paid', 'refunded']) {
        s.invoice = invoice(over, { paymentStatus });
        const { html, text, actions } = await view();
        const label = `${name}, buyurtma ${paymentStatus}`;
        expect(actions, label).toEqual(OPEN_FORMS);
        expect(html, label).not.toMatch(REOPEN_BUTTON);
        expect(text, label).not.toContain('Qayta ochish');
        expect(text, label).not.toContain('qaytaring');
        expect(text, label).not.toContain('qayta oching');
        expect(text, label).not.toContain('puli qaytarilgan');
        expect(text, label).not.toContain(FULLY_PAID);
        expect(text, label).not.toContain(CANCELLED);
      }
    }
  });

  it('bekor qilingan hisob-faktura: faqat "bekor qilingan" yozuvi — «Qayta ochish» ham, yordam ham yo\'q', async () => {
    for (const paymentStatus of ['pending', 'paid', 'refunded']) {
      s.invoice = invoice({ status: 'cancelled' }, { paymentStatus });
      const { html, text, actions } = await view();
      expect(actions, paymentStatus).toEqual(['linkContract']);
      expect(html, paymentStatus).not.toMatch(REOPEN_BUTTON);
      expect(text, paymentStatus).toContain(CANCELLED);
      expect(text, paymentStatus).not.toContain(FULLY_PAID);
      expect(text, paymentStatus).not.toContain('qaytaring');
      expect(text, paymentStatus).not.toContain('qayta oching');
      expect(text, paymentStatus).not.toContain('puli qaytarilgan');
    }
  });

  it('«Qayta ochish» natijasi: saqlangan bo\'lsa "Saqlandi", holat mos kelmagan bo\'lsa (error=state) ogohlantirish', async () => {
    s.invoice = invoice({}, { paymentStatus: 'pending' });
    expect(notices((await view({ saved: '1' })).html)).toEqual([{ tone: 'ok', text: 'Saqlandi' }]);
    // Masalan: tugma ikki marta bosilgan yoki shu orada buyurtma "to'langan" qilingan — hech narsa o'zgarmagan
    s.invoice = invoice(PAID, { paymentStatus: 'paid' });
    expect(notices((await view({ error: 'state' })).html)).toEqual([{ tone: 'warn', text: "Bu holatdagi hisob-fakturani o'zgartirib bo'lmaydi" }]);
    expect(notices((await view()).html)).toEqual([]);
  });
});

describe('admin: Xodimlar sahifasi', () => {
  const page = (sp: Record<string, string> = {}) => render(StaffPage({ searchParams: Promise.resolve(sp) }));
  const soon = () => new Date(Date.now() + 20 * 60_000);
  const NO_BOT = 'Boshqaruv boti tokeni hali kiritilmagan';
  const CODE_BUTTON = /<button[^>]*>Telegram kodi<\/button>/;

  // To'lovni belgilash va bekor qilish "finance" (moliya) ruxsatiga bog'langan: izoh buni aytadi va ruxsatlar jadvali bilan bir xil —
  // rol tanlayotgan administrator "Xodim" to'lovni belgilay olmasligini shu yerdan biladi
  it('rollar izohi: moliya (to\'lovni belgilash va bekor qilish) menejerda bor, "Xodim" to\'lovni belgilay olmaydi — ruxsatlar jadvalidagi kabi', async () => {
    const { text } = await page();
    const legend = /Administrator: (.*?)\. Menejer: (.*?)\. Xodim: (.*?)\./.exec(text);
    expect(legend).not.toBeNull();
    const [, admin, manager, staff] = legend!;
    expect(admin).toBe('hammasi');
    expect(manager).toContain("moliya (hisob-fakturalar; buyurtmani «to'landi» deb belgilash va bu belgini bekor qilish)");
    expect(staff).toBe("buyurtmalar (holatini o'zgartirish) va arizalar — to'lovni belgilay olmaydi");
    expect(staff).not.toContain('moliya');
    // Izoh aytgani haqiqiy jadvalga mos
    expect([can('admin', 'finance'), can('manager', 'finance'), can('staff', 'finance')]).toEqual([true, true, false]);
    expect(can('staff', 'orders')).toBe(true);
  });

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

  // Manzilda kodning o'zi emas, xodim raqami keladi (?tg=): manzil satri proksi jurnaliga va brauzer tarixiga tushadi
  it('kod xabari: ?tg= dagi xodimning bazadagi amaldagi kodi ko\'rsatiladi (manzilda kod yo\'q)', async () => {
    tokens('', '222:staff');
    s.staff = [staffRow({ telegramCode: '042917', otpExpiry: soon() })];
    const { html, text } = await page({ tg: '5' });
    expect(text).toContain('Vali Xodim uchun Telegram kodi: 042917');
    expect(html).toContain('>042917</b>');
    expect(text).not.toContain('endi amal qilmaydi');
    // Eski ko'rinishdagi manzil (?code=...&for=...) endi hech narsa ko'rsatmaydi — kod manzildan olinmaydi
    const old = await page({ code: '042917', for: '5' });
    expect(old.text).not.toContain('uchun Telegram kodi:');
    expect(old.text).not.toContain('042917');
  });

  it('ishlatilgan, muddati o\'tgan yoki yo\'q xodimning kodi "amal qiladi" deb ko\'rsatilmaydi; almashtirilgan bo\'lsa yangisi chiqadi', async () => {
    tokens('', '222:staff');
    const other = staffRow({ id: 6, name: 'Boshqa Xodim', phone: '998901112244', telegramCode: '042917', otpExpiry: soon() });
    const cases: [string, Record<string, unknown>[], Record<string, string>][] = [
      ['ishlatilgan (bazada kod yo\'q)', [staffRow({ telegramId: '900', telegramCode: null, otpExpiry: null })], { tg: '5' }],
      ['muddati o\'tgan', [staffRow({ telegramCode: '042917', otpExpiry: new Date(Date.now() - 1_000) })], { tg: '5' }],
      ['muddat belgisi yo\'q', [staffRow({ telegramCode: '042917', otpExpiry: null })], { tg: '5' }],
      ['bunday xodim yo\'q', [other], { tg: '5' }],
      ['kod 6 xonali son emas', [staffRow({ telegramCode: 'abc', otpExpiry: soon() })], { tg: '5' }],
    ];
    for (const [name, staff, sp] of cases) {
      s.staff = staff;
      const { text } = await page(sp);
      expect(text, name).not.toContain('uchun Telegram kodi:');
      expect(text, name).not.toContain('042917');
      expect(text, name).toContain('Bu Telegram kodi endi amal qilmaydi');
    }
    // Qayta berilgan kod: sahifa yangilansa ham amaldagi (yangi) kod ko'rinadi, eskisi emas
    s.staff = [staffRow({ telegramCode: '777777', otpExpiry: soon() })];
    const { text } = await page({ tg: '5' });
    expect(text).toContain('Vali Xodim uchun Telegram kodi: 777777');
    expect(text).not.toContain('042917');
  });

  it('manzilda xodim ko\'rsatilmasa hech qanday kod xabari chiqmaydi', async () => {
    tokens('', '222:staff');
    s.staff = [staffRow({ telegramCode: '042917', otpExpiry: soon() })];
    for (const sp of [{}, { saved: '1' }, { code: '042917', for: '5' }] as Record<string, string>[]) {
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

describe('admin: AI tekshiruv sahifasi — «Server holati» kartasi', () => {
  /** Sog'lom server yuboradigan faktlar (deploy/watchdog.sh -> /api/ops/heartbeat -> SiteSetting "ops") */
  const HEALTHY = { disk: 41, backupAgeH: 5, restoreOk: 1, offsiteOk: 1, certDays: 60, siteOk: 1, tickOk: 1 };
  /** Server `minutesAgo` daqiqa oldin shu faktlarni yuborgan */
  const heartbeat = (patch: Partial<typeof HEALTHY> = {}, minutesAgo = 2) => {
    s.ops = { ...HEALTHY, ...patch, at: new Date(Date.now() - minutesAgo * 60_000).toISOString() };
  };
  /** Kartaning o'zi: belgisi (sarlavha yonidagi rangli yorliq), qizil bilan ajratilgan satrlar va butun matni */
  const card = async () => {
    const { html } = await render(AuditPage({ searchParams: Promise.resolve({}) }));
    const section = html.split('<section').find((part) => part.includes('>Server holati</h2>')) ?? '';
    const badge = /<span class="inline-block[^"]*">(.*?)<\/span>/.exec(section);
    const marked = [...section.matchAll(/<li class="font-medium text-red-700">(.*?)<\/li>/g)].map((m) => toText(m[1]).trim());
    return { html: section, text: toText(section), badge: toText(badge?.[1] ?? '').trim(), red: /bg-red-100/.test(badge?.[0] ?? ''), marked };
  };
  const BADGES = ["Ma'lumot yo'q", 'Signal kelmayapti', 'Muammo bor', 'Kuzatuvda'];

  it('signal hali kelmagan (eski server skripti): "Ma\'lumot yo\'q" va tushuntirish — faktlar ro\'yxati yo\'q', async () => {
    const c = await card();
    expect(c.badge).toBe("Ma'lumot yo'q");
    expect(c.text).toContain('Server kuzatuvi (deploy/watchdog.sh) hali signal yubormagan');
    expect(c.text).not.toContain('Disk:');
    expect(c.text).not.toContain('oxirgi signal:');
  });

  it('sog\'lom server: yashil "Kuzatuvda", hech bir satr ajratilmagan; faktlar tushunarli ko\'rinishda', async () => {
    heartbeat();
    const c = await card();
    expect(c.badge).toBe('Kuzatuvda');
    expect(c.red).toBe(false);
    expect(c.marked).toEqual([]);
    for (const line of ['Disk: 41% band', 'Oxirgi zaxira nusxa: 5 soat oldin', "Zaxirani tiklash sinovi: o'tdi", 'Serverdan tashqaridagi nusxa: yuborilmoqda', 'HTTPS sertifikat: 60 kun qoldi', 'Sayt internetdan: ochilyapti', "Davriy ishlar signali: o'tyapti"]) {
      expect(c.text).toContain(line);
    }
    expect(c.text).toContain('oxirgi signal:');
    // Sahifada bitta holat belgisi: qolgan uchtasi yo'q
    for (const other of BADGES.filter((b) => b !== 'Kuzatuvda')) expect(c.text, other).not.toContain(other);
  });

  // Belgi faqat "signal kelyapti"ni emas, faktlarning o'zini ham aks ettiradi: zaxira nusxa yaroqsiz bo'lib turganda yashil "Kuzatuvda" chiqmasin.
  // Chegaralar deploy/watchdog.sh Telegram'da xabar beradiganlari bilan bir xil (disk 90%, zaxira 30 soat, sertifikat 14 kundan kam)
  const bad: [string, Partial<typeof HEALTHY>, string][] = [
    ['zaxirani tiklash sinovi o\'tmagan', { restoreOk: 0 }, "Zaxirani tiklash sinovi: o'tmadi"],
    ['disk 90% band', { disk: 90 }, 'Disk: 90% band'],
    ['zaxira 30 soatdan beri olinmagan', { backupAgeH: 30 }, 'Oxirgi zaxira nusxa: 30 soat oldin'],
    ['zaxira nusxa topilmadi', { backupAgeH: -1 }, 'Oxirgi zaxira nusxa: topilmadi'],
    ['tashqi nusxa yuborilmagan', { offsiteOk: 0 }, 'Serverdan tashqaridagi nusxa: yuborilmadi'],
    ['sertifikatga 13 kun qolgan', { certDays: 13 }, 'HTTPS sertifikat: 13 kun qoldi'],
    ['sertifikatga 1 kun qolgan', { certDays: 1 }, 'HTTPS sertifikat: 1 kun qoldi'],
    // Skript muddati O'TGAN sertifikatni ham 0 qilib yuboradi: "0 kun qoldi" degan yozuv 5 kun oldin tugagan sertifikat uchun noto'g'ri bo'lardi
    ['sertifikat muddati tugagan (0 kun)', { certDays: 0 }, 'HTTPS sertifikat: muddati tugagan yoki bugun tugaydi'],
    ['sayt internetdan ochilmayapti', { siteOk: 0 }, 'Sayt internetdan: ochilmayapti'],
    ['davriy ishlar signali o\'tmayapti', { tickOk: 0 }, "Davriy ishlar signali: o'tmayapti"],
  ];
  it.each(bad)('muammo — %s: qizil "Muammo bor" ("Kuzatuvda" emas) va faqat o\'sha satr ajratilgan', async (_name, patch, line) => {
    heartbeat(patch);
    const c = await card();
    expect(c.badge).toBe('Muammo bor');
    expect(c.red).toBe(true);
    expect(c.text).not.toContain('Kuzatuvda');
    expect(c.marked).toEqual([line]);
  });

  it('bir nechta muammo birga: belgi bitta, har bir yomon satr ajratilgan, yaxshilari — yo\'q', async () => {
    heartbeat({ disk: 97, restoreOk: 0, siteOk: 0 });
    const c = await card();
    expect(c.badge).toBe('Muammo bor');
    expect(c.marked).toEqual(['Disk: 97% band', "Zaxirani tiklash sinovi: o'tmadi", 'Sayt internetdan: ochilmayapti']);
  });

  it('chegaradan bu yog\'i va "aniqlanmadi" (-1) muammo emas: disk 89%, zaxira 29 soat, sertifikat 14 kun, sinov hali o\'tkazilmagan, tashqi nusxa yoqilmagan', async () => {
    const fine: Partial<typeof HEALTHY>[] = [{ disk: 89 }, { backupAgeH: 29 }, { certDays: 14 }, { disk: -1 }, { certDays: -1 }, { restoreOk: -1 }, { offsiteOk: -1 }, { backupAgeH: 0 }];
    for (const patch of fine) {
      heartbeat(patch);
      const c = await card();
      expect(c.badge, JSON.stringify(patch)).toBe('Kuzatuvda');
      expect(c.marked, JSON.stringify(patch)).toEqual([]);
    }
    heartbeat({ disk: -1, certDays: -1, restoreOk: -1, offsiteOk: -1 });
    const { text } = await card();
    for (const line of ['Disk: aniqlanmadi', 'HTTPS sertifikat: aniqlanmadi', "Zaxirani tiklash sinovi: hali o'tkazilmagan", 'Serverdan tashqaridagi nusxa: yoqilmagan (deploy/offsite-setup.sh)']) expect(text).toContain(line);
  });

  // 30 daqiqadan eski signal: faktlar hozirgi holat emas — ularga qarab "muammo bor" ham, "kuzatuvda" ham deyilmaydi
  it('signal eskirgan: "Signal kelmayapti"; oxirgi ma\'lum faktlar ko\'rsatiladi, lekin ajratilmaydi va "hozirgi holat emas" deb yoziladi', async () => {
    heartbeat({ restoreOk: 0, siteOk: 0 }, 31);
    const c = await card();
    expect(c.badge).toBe('Signal kelmayapti');
    expect(c.red).toBe(false);
    expect(c.marked).toEqual([]);
    expect(c.text).toContain("oxirgi ma'lum holat, hozirgi holat emas");
    expect(c.text).toContain("Zaxirani tiklash sinovi: o'tmadi");
    for (const other of ['Muammo bor', 'Kuzatuvda']) expect(c.text, other).not.toContain(other);

    // 29 daqiqalik signal hali yangi: o'sha faktlar bilan "Muammo bor"
    heartbeat({ restoreOk: 0, siteOk: 0 }, 29);
    const fresh = await card();
    expect(fresh.badge).toBe('Muammo bor');
    expect(fresh.text).not.toContain('hozirgi holat emas');
  });

  it('xabarlar navbati: kutayotganlar, bir soatdan ortiq turganlar va oxirgi 24 soatda yetkazilmaganlar soni', async () => {
    heartbeat();
    expect((await card()).text).toContain('Bot xabarlari navbati: 0 ta kutmoqda, oxirgi 24 soatda 0 ta yetkazilmadi.');
    s.queue = { pending: 3, stuck: 2, failed24h: 1 };
    expect((await card()).text).toContain('Bot xabarlari navbati: 3 ta kutmoqda (2 tasi bir soatdan ortiq), oxirgi 24 soatda 1 ta yetkazilmadi.');
  });

  // Server nosozligi xabarlari (watchdog.sh) faqat boshqaruv botiga ulangan faol administratorlarga boradi: sahifa "xabar boradi" deb
  // faqat shunday odam bor bo'lganda yozadi
  describe('nosozlik xabari kimga borishi haqidagi izoh', () => {
    const PROMISE = 'Telegram orqali darhol xabar boradi';
    const NO_BOT = 'Boshqaruv boti hali ulanmagan — muammo chiqsa Telegram xabari yuborilmaydi, u faqat server logiga yoziladi';
    const NO_ADMIN = "Hozircha xabar oladigan administrator yo'q — muammo chiqsa Telegram xabari hech kimga bormaydi";

    it('boshqaruv boti tokeni kiritilmagan: xabar yuborilmasligi va botni qanday ulash aytiladi — administrator ulangan bo\'lsa ham', async () => {
      heartbeat();
      s.admins = ['7000001'];
      const { text } = await card();
      expect(text).toContain(NO_BOT);
      expect(text).toContain('deploy/bots-setup.sh');
      expect(text).not.toContain(PROMISE);
      expect(text).not.toContain(NO_ADMIN);
      // Mijoz botining tokeni boshqaruv botini "ulangan" qilmaydi
      tokens('111:customer', '');
      expect((await card()).text).toContain(NO_BOT);
    });

    it('bot ulangan, lekin hech bir administrator ulanmagan: xabar hech kimga bormasligi aytiladi va Xodimlar sahifasiga havola beriladi', async () => {
      heartbeat();
      tokens('', '222:staff');
      s.admins = [];
      const c = await card();
      expect(c.text).toContain(NO_ADMIN);
      expect(c.text).toContain("bo'limida administrator hisobini boshqaruv botiga ulang");
      expect(c.html).toMatch(/<a[^>]*href="\/admin\/staff"[^>]*>Xodimlar<\/a>/);
      expect(c.text).not.toContain(PROMISE);
      expect(c.text).not.toContain(NO_BOT);
    });

    it('bot va administrator ulangan: "xabar boradi" va nechta kishiga borishi; Telegram ID lar sahifaga chiqmaydi', async () => {
      heartbeat();
      s.admins = ['7000001', '7000002'];
      for (const [staff, legacy] of [['222:staff', ''], ['', '333:legacy']]) {
        tokens('', staff, legacy);
        const c = await card();
        expect(c.text).toContain(`boshqaruv botiga ulangan administratorlarga (2 kishi) ${PROMISE}`);
        expect(c.text).not.toContain(NO_ADMIN);
        expect(c.text).not.toContain(NO_BOT);
        expect(c.html).not.toMatch(/7000001|7000002/);
      }
      // Yozuvi buzilgan (raqam bo'lmagan ID) administrator xabar ololmaydi — u sanoqqa ham kirmaydi
      s.admins = ['7000001', '@pack24_admin'];
      expect((await card()).text).toContain('(1 kishi)');
    });

    it('ro\'yxatni o\'qib bo\'lmasa: "yo\'q" deb qo\'rqitilmaydi, son ham aytilmaydi', async () => {
      heartbeat();
      tokens('', '222:staff');
      s.admins = null;
      const { text } = await card();
      expect(text).toContain(`boshqaruv botiga ulangan administratorlarga ${PROMISE}`);
      expect(text).not.toContain('kishi)');
      expect(text).not.toContain(NO_ADMIN);
    });

    it('izoh signal holatiga bog\'liq emas: signal hali kelmagan serverda ham chiqadi', async () => {
      tokens('', '222:staff');
      s.admins = [];
      const c = await card();
      expect(c.badge).toBe("Ma'lumot yo'q");
      expect(c.text).toContain(NO_ADMIN);
    });
  });
});
