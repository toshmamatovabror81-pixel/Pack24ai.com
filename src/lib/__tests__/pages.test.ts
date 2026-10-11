import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sahifalar botlar haqida faqat rostini aytishi: bot tokeni kiritilmagan holatda (ishchi serverda botlar ulanmaguncha shunday)
 * "Telegram'da kuzatish" tugmasi, "Telegram kodi" va "xabar boradi" degan va'dalar chiqmasligi; Xodimlar sahifasidagi kod xabari
 * faqat bazadagi amaldagi kod uchun; o'chirilgan buyurtma faqat ko'rish uchun. AI tekshiruv sahifasidagi «Server holati» kartasi ham
 * shu qoidaga bo'ysunadi: muammo bor paytda yashil "Kuzatuvda" belgisi va "xabar boradi" degan gap chiqmasligi kerak.
 * Server komponentlari to'g'ridan-to'g'ri chaqiriladi va HTML'ga aylantiriladi; baza, sessiya va Telegram soxta.
 */
// Vitest .tsx fayllarni klassik JSX (React.createElement) bilan o'giradi — sahifa modullari global React'ni kutadi
(globalThis as { React?: unknown }).React = React;

const s = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  staff: [] as Record<string, unknown>[],
  recipients: [] as { telegramId: string; lang: string }[],
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
vi.mock('@/lib/auth', () => ({ requireStaff: async () => ({ id: 1, name: 'Admin Ali', role: 'admin' }) }));
vi.mock('@/lib/db', () => ({
  prisma: {
    order: { findUnique: async () => s.order },
    corporateInvoice: { findFirst: async () => null },
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
vi.mock('@/lib/telegram/customers', () => ({ orderRecipients: async () => s.recipients }));
vi.mock('@/lib/telegram/setup', () => ({ botStatuses: async () => [] }));
const action = async () => undefined;
vi.mock('@/app/admin/(panel)/orders/actions', () => ({ updateOrder: action }));
vi.mock('@/app/admin/(panel)/invoices/actions', () => ({ createInvoiceForOrder: action }));
vi.mock('@/app/admin/(panel)/staff/actions', () => ({ createStaff: action, issueTelegramCode: action, unlinkTelegram: action, updateStaff: action }));
vi.mock('@/app/admin/(panel)/settings/actions', () => ({ updateSettings: action }));
vi.mock('@/app/admin/(panel)/settings/telegramActions', () => ({ removeTelegramWebhooks: action, setupTelegramWebhooks: action }));
vi.mock('@/app/admin/(panel)/audit/actions', () => ({ runAuditNow: action }));

const { default: OrderPage } = await import('@/app/[lang]/orders/[token]/page');
const { default: AdminOrderPage } = await import('@/app/admin/(panel)/orders/[id]/page');
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
