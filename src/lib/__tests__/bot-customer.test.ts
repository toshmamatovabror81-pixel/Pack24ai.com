import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramCustomer } from '@prisma/client';
import type { CustomerDebt } from '@/lib/customerAccount';
import type { InlineKeyboard, ReplyButton, TgMessage, TgUpdate } from '@/lib/telegram/api';
import type { OrderCardData, OrderListData } from '@/lib/telegram/bots/customerViews';

/**
 * Mijoz boti testlari bazasiz ishlaydi: ko'rinishlar (customerViews) qo'lda yasalgan obyektlar bilan,
 * suhbat (bots/customer) esa xotiradagi soxta mijozlar jadvali, sessiya va Telegram API bilan tekshiriladi.
 */
type Sent = {
  method: string;
  params: { text?: string; message_id?: number; show_alert?: boolean; reply_markup?: { inline_keyboard?: InlineKeyboard; keyboard?: ReplyButton[][]; remove_keyboard?: boolean } };
};

const db = vi.hoisted(() => {
  const row = (telegramId: string, patch: Partial<TelegramCustomer> = {}): TelegramCustomer => ({
    id: 1, telegramId, phone: null, name: null, lang: 'uz', notify: true, verifiedAt: null, createdAt: new Date(0), updatedAt: new Date(0), ...patch,
  });
  return { row, customers: new Map<string, TelegramCustomer>(), sessions: new Map<string, object>(), sent: [] as Sent[] };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/session', () => ({
  getSession: vi.fn(async (_bot: string, id: number | string) => db.sessions.get(String(id)) ?? null),
  setSession: vi.fn(async (_bot: string, id: number | string, data: object) => void db.sessions.set(String(id), data)),
  clearSession: vi.fn(async (_bot: string, id: number | string) => void db.sessions.delete(String(id))),
}));
vi.mock('@/lib/telegram/customers', () => {
  const isBotLang = (v: unknown) => v === 'uz' || v === 'ru';
  const patch = (id: number | string, data: Partial<TelegramCustomer>) => {
    const next = { ...(db.customers.get(String(id)) ?? db.row(String(id))), ...data };
    db.customers.set(String(id), next);
    return next;
  };
  return {
    isBotLang,
    langOf: (c: { lang: string } | null | undefined) => (c && isBotLang(c.lang) ? c.lang : 'uz'),
    botCustomer: vi.fn(async (id: number | string) => db.customers.get(String(id)) ?? null),
    ensureBotCustomer: vi.fn(async (id: number | string, init: { name?: string; lang?: string } = {}) => db.customers.get(String(id)) ?? patch(id, { name: init.name ?? null, lang: init.lang ?? 'uz' })),
    linkCustomerPhone: vi.fn(async (id: number | string, rawPhone: string) => {
      const digits = rawPhone.replace(/\D/g, '');
      return digits.length === 12 && digits.startsWith('998') ? patch(id, { phone: digits, verifiedAt: new Date(0) }) : null;
    }),
    unlinkCustomer: vi.fn(async (id: number | string) => void db.customers.delete(String(id))),
    setCustomerLang: vi.fn(async (id: number | string, lang: string) => void patch(id, { lang })),
    setCustomerNotify: vi.fn(async (id: number | string, notify: boolean) => void patch(id, { notify })),
    customerScope: vi.fn(async (c: { telegramId: string; phone: string | null }) => ({ telegramId: c.telegramId, phone: c.phone, userId: c.phone ? 42 : null })),
    bindOrderByToken: vi.fn(async () => null),
  };
});
vi.mock('@/lib/customerAccount', () => ({
  listOrders: vi.fn(async () => ({ items: [], total: 0, page: 0, pages: 1 })),
  getOrder: vi.fn(async () => null),
  customerDebt: vi.fn(async () => null),
}));
vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn(async () => ({ companyName: 'Pack24', legalName: '', inn: '', bankDetails: '', directorName: '', phone: '998880557888', phone2: '', email: '', address: {}, workHours: {}, telegramChannel: '' })),
}));
vi.mock('@/lib/orders', () => ({ paymentUrl: vi.fn(() => null) }));

const { customerTexts } = await import('@/lib/telegram/bots/customerTexts');
const {
  balanceHtml, balanceKeyboard, CB, contactKeyboard, contactsHtml, helloHtml, langKeyboard, mainKeyboard, maskPhone, orderCardHtml, orderCardKeyboard,
  orderLine, ordersListHtml, ordersListKeyboard, requisitesHtml, settingsHtml, settingsKeyboard, sharePhoneKeyboard, stopConfirmKeyboard,
} = await import('@/lib/telegram/bots/customerViews');
const { bot } = await import('@/lib/telegram/bots/customer');
const { botMeta } = await import('@/lib/telegram/bots');
const customers = vi.mocked(await import('@/lib/telegram/customers'));
const account = vi.mocked(await import('@/lib/customerAccount'));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const at = (iso: string) => new Date(iso);
/** Toshkent vaqti bilan 09.10.2026, 14:05 */
const REGISTERED = at('2026-10-09T09:05:00Z');
const NOW = at('2026-10-10T07:00:00Z');
const TOKEN = 'tok_ABCDEFGHIJKLMNOPQRSTUV';
const MAX_ID = 2147483646;

const plain = (html: string) => html.replace(/<[^>]+>/g, '');
const callbacks = (kb: InlineKeyboard) => kb.flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));
const urls = (kb: InlineKeyboard) => kb.flat().flatMap((b) => (b.url ? [b.url] : []));

const order = (patch: Partial<OrderCardData> = {}): OrderCardData => ({
  id: 123,
  status: 'processing',
  paymentStatus: 'pending',
  paymentMethod: 'bank_transfer',
  totalAmount: 1130000,
  createdAt: REGISTERED,
  accessToken: TOKEN,
  subtotal: 1200000,
  discountAmount: 100000,
  deliveryFee: 30000,
  items: [{ quantity: 500, product: { name: 'Karton quti <XL>', nameI18n: { uz: 'Karton quti <XL>', ru: 'Картонная коробка <XL>' } } }],
  workOrders: [{ productName: 'Quti 30x20x10', quantity: 500, status: 'in_progress', currentStage: 'pechat', progress: 40, deadline: at('2026-10-15T05:00:00Z') }],
  corporateInvoices: [{ invoiceNo: 'INV-2026-0012', dueDate: at('2026-10-20T05:00:00Z'), totalAmount: 1130000, paidAmount: 130000 }],
  events: [{ toValue: 'new_', createdAt: REGISTERED }, { toValue: 'processing', createdAt: at('2026-10-09T10:20:00Z') }],
  ...patch,
});

const debt = (patch: Partial<CustomerDebt> = {}): CustomerDebt => ({
  invoices: [], invoiceTotal: 0, overdueTotal: 0, unpaidOrders: [], unpaidOrdersTotal: 0, contracts: [], total: 0, ...patch,
});

describe('mijoz boti: matnlar', () => {
  /** Kalit yo'llari va qiymat turi (funksiya bo'lsa argumentlar soni bilan) */
  const shape = (v: unknown, path = ''): string[] => {
    if (typeof v === 'function') return [`${path}()${v.length}`];
    if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
    return [`${path}:${typeof v}`];
  };

  it("o'zbekcha va ruscha matnlar bir xil kalitlarga ega", () => {
    expect(shape(customerTexts.ru).sort()).toEqual(shape(customerTexts.uz).sort());
    expect(shape(customerTexts.uz).length).toBeGreaterThan(80);
  });

  it("bo'sh matn yo'q; menyu tugmalari ikki tilda farq qiladi", () => {
    for (const lang of ['uz', 'ru'] as const) for (const leaf of shape(customerTexts[lang])) expect(leaf).not.toMatch(/:undefined$/);
    const uz = Object.values(customerTexts.uz.menu);
    const ru = Object.values(customerTexts.ru.menu);
    expect(new Set([...uz, ...ru]).size).toBe(uz.length + ru.length);
    for (const text of [...uz, ...ru]) expect(text.trim()).toBe(text);
  });

  it('xato matni ikki tilda birga callback javobi chegarasiga (200 belgi) sig\'adi', () => {
    expect(`${customerTexts.uz.error}\n${customerTexts.ru.error}`.length).toBeLessThanOrEqual(200);
    for (const lang of ['uz', 'ru'] as const) expect(customerTexts[lang].card.notFound.length).toBeLessThanOrEqual(200);
  });

  it('til nomi hamma joyda bir xil yoziladi: «tanlandi» javobi tugma va sozlamalardagi nom bilan (bosh harfi ham)', () => {
    for (const lang of ['uz', 'ru'] as const) {
      const t = customerTexts[lang].lang;
      expect(t.chosen.endsWith(`: ${t.name}`), t.chosen).toBe(true);
      expect(t.button.endsWith(` ${t.name}`), t.button).toBe(true);
    }
  });

  // Telegram "/" menyusi bitta ro'yxat — foydalanuvchi tiliga qarab alohida o'rnatilmaydi, ruscha tanlagan mijoz ham shuni ko'radi
  it('"/" menyusidagi har bir buyruq nomi ikki tilda (o\'zbekcha / ruscha)', () => {
    for (const { command, description } of botMeta.customer.commands) {
      expect(description, command).toMatch(/^[A-Za-z' ]+ \/ [А-Яа-яЁё ]+$/);
      expect(description.length, command).toBeLessThanOrEqual(256);
    }
  });
});

describe('mijoz boti: telefon', () => {
  it('raqam niqoblanadi: faqat mamlakat kodi va oxirgi ikki raqam', () => {
    expect(maskPhone('998901234567')).toBe('+998 ** *** ** 67');
    expect(maskPhone('+998 90 123 45 67')).toBe('+998 ** *** ** 67');
    expect(maskPhone('998901234567')).not.toContain('90');
    expect(maskPhone('12345')).toBe('** 45');
    expect(maskPhone(null)).toBe('');
  });

  it('sozlamalarda telefon faqat niqoblangan holda chiqadi', () => {
    const html = settingsHtml({ notify: true, phone: '998901234567' }, 'uz');
    expect(html).toContain('+998 ** *** ** 67');
    expect(html).not.toContain('123');
    expect(html).toContain("O'zbekcha");
    expect(html).toContain('yoqilgan');
    expect(settingsHtml({ notify: false, phone: null }, 'ru')).toContain('не привязан');
    expect(settingsHtml({ notify: false, phone: null }, 'ru')).toContain('выключены');
  });

  it("kontakt klaviaturasi: request_contact tugmasi va «Keyinroq»", () => {
    const kb = contactKeyboard('uz');
    expect(kb.keyboard[0][0]).toEqual({ text: customerTexts.uz.phone.share, request_contact: true });
    expect(kb.keyboard[1][0]).toEqual({ text: customerTexts.uz.phone.later });
    expect(contactKeyboard('ru').keyboard[1][0].text).toBe('Позже');
  });

  it('asosiy menyu: besh tugma, doimiy va ixcham', () => {
    const kb = mainKeyboard('ru');
    expect(kb.keyboard.flat().map((b) => b.text)).toEqual(Object.values(customerTexts.ru.menu));
    expect(kb.resize_keyboard).toBe(true);
    expect(kb.is_persistent).toBe(true);
  });
});

describe('mijoz boti: buyurtmalar ro\'yxati', () => {
  const list = (n: number, page = 0, pages = 1): OrderListData => ({
    items: Array.from({ length: n }, (_, i) => ({ id: 50 - i, status: 'new_' as const, paymentStatus: 'pending' as const, totalAmount: 1250000, createdAt: REGISTERED })),
    total: n, page, pages,
  });

  it('satr: raqam · sana · holat · summa · to\'lov holati', () => {
    const o = { id: 12, status: 'new_' as const, paymentStatus: 'pending' as const, totalAmount: 1250000, createdAt: REGISTERED };
    expect(plain(orderLine(o, 'uz'))).toBe("#12 · 09.10.2026 · Yangi · 1 250 000 so'm · To'lanmagan");
    expect(plain(orderLine({ ...o, status: 'shipping', paymentStatus: 'paid' }, 'ru'))).toBe('#12 · 09.10.2026 · В пути · 1 250 000 сум · Оплачен');
  });

  it('ro\'yxat: har buyurtmaga tugma (qatorda 3 tadan), bitta sahifada varaqlash yo\'q', () => {
    const l = list(5);
    const html = ordersListHtml(l, 'uz');
    expect(html.split('\n').filter((line) => line.startsWith('<b>#'))).toHaveLength(5);
    expect(html).toContain('jami 5 ta');
    expect(html).not.toContain(customerTexts.uz.orders.linkHint);
    const kb = ordersListKeyboard(l);
    expect(kb.map((r) => r.length)).toEqual([3, 2]);
    expect(kb[0][0]).toEqual({ text: '#50', callback_data: 'o_50' });
    expect(callbacks(kb).some((c) => c.startsWith(CB.list))).toBe(false);
  });

  it('bir necha sahifa: varaqlash qatori chetlarda bir tomonlama', () => {
    expect(ordersListKeyboard(list(6, 0, 3)).at(-1)!.map((b) => b.callback_data)).toEqual(['ol_0', 'ol_1']);
    expect(ordersListKeyboard(list(6, 1, 3)).at(-1)!.map((b) => b.callback_data)).toEqual(['ol_0', 'ol_1', 'ol_2']);
    expect(ordersListKeyboard(list(6, 2, 3)).at(-1)!.map((b) => b.callback_data)).toEqual(['ol_1', 'ol_2']);
    expect(ordersListHtml(list(6, 1, 3), 'ru')).toContain('Страница 2 / 3');
  });

  it('telefon ulanmagan mijozga ro\'yxat ostida eslatma chiqadi', () => {
    expect(ordersListHtml(list(1), 'uz', false)).toContain(customerTexts.uz.orders.linkHint);
  });
});

describe('mijoz boti: buyurtma kartasi', () => {
  it("ro'yxatga olingan sana, holat, ishlab chiqarish bosqichi, summalar va hisob-faktura qoldig'i", () => {
    const html = orderCardHtml(order(), 'uz', NOW);
    expect(html).toContain('Buyurtma #123');
    expect(html).toContain("Ro'yxatga olingan: 09.10.2026, 14:05");
    expect(html).toContain('Holati: <b>Tayyorlanmoqda</b>');
    expect(html).toContain('Ishlab chiqarish:');
    expect(html).toContain('• Quti 30x20x10 × 500: Chop etish, 40% · Muddat: 15.10.2026');
    expect(html).toContain("Mahsulotlar: 1 200 000 so'm");
    expect(html).toContain("Chegirma: −100 000 so'm");
    expect(html).toContain("Yetkazib berish: 30 000 so'm");
    expect(html).toContain("Jami: <b>1 130 000 so'm</b>");
    expect(html).toContain("To'lov: Bank o'tkazmasi · To'lanmagan");
    expect(html).toContain('Hisob-faktura <b>INV-2026-0012</b>');
    expect(html).toContain("To'lov muddati: 20.10.2026");
    expect(html).toContain("Qoldiq: 1 000 000 so'm");
    expect(html).not.toContain("muddati o'tgan");
  });

  it('tarix: holat o\'zgarishlari sanasi bilan; notanish qiymat ko\'rsatilmaydi', () => {
    const html = orderCardHtml(order({ events: [...order().events, { toValue: 'internal_x', createdAt: NOW }] }), 'uz', NOW);
    expect(html).toContain('Tarix:');
    expect(html).toContain('• 09.10.2026, 14:05 — Yangi');
    expect(html).toContain('• 09.10.2026, 15:20 — Tayyorlanmoqda');
    expect(html).not.toContain('internal_x');
    // Hodisa yo'q bo'lsa tarix bo'limi chiqmaydi — faqat ro'yxatga olingan sana qoladi
    const bare = orderCardHtml(order({ events: [] }), 'uz', NOW);
    expect(bare).not.toContain('Tarix');
    expect(bare).toContain("Ro'yxatga olingan: 09.10.2026, 14:05");
  });

  it('ruscha karta: mahsulot nomi tanlangan tilda va HTML qochirilgan', () => {
    const html = orderCardHtml(order(), 'ru', NOW);
    expect(html).toContain('Заказ #123');
    expect(html).toContain('Зарегистрирован: 09.10.2026, 14:05');
    expect(html).toContain('Статус: <b>Готовится</b>');
    expect(html).toContain('• Картонная коробка &lt;XL&gt; × 500');
    expect(html).not.toContain('<XL>');
    expect(html).toContain('Печать, 40%');
    expect(html).toContain('Остаток: 1 000 000 сум');
  });

  it("mahsulotlar 12 tadan oshsa qisqartiriladi; yo'lga chiqqan buyurtmada ishlab chiqarish satri yo'q", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ quantity: i + 1, product: { name: `Mahsulot ${i + 1}`, nameI18n: {} } }));
    const html = orderCardHtml(order({ items, status: 'shipping' }), 'uz', NOW);
    expect(html).toContain('• Mahsulot 12 × 12');
    expect(html).not.toContain('Mahsulot 13');
    expect(html).toContain('… yana 3 ta');
    expect(html).not.toContain('Ishlab chiqarish');
    expect(html).toContain("Holati: <b>Yo'lda</b>");
    expect(html.length).toBeLessThan(4000);
  });

  it("chegirma va yetkazish yo'q bo'lsa faqat jami; hisob-faktura to'langan yoki muddati o'tgan", () => {
    const simple = orderCardHtml(order({ subtotal: 500000, discountAmount: 0, deliveryFee: 0, totalAmount: 500000, corporateInvoices: [], paymentMethod: 'cash', paymentStatus: 'paid' }), 'uz', NOW);
    expect(simple).not.toContain('Chegirma');
    expect(simple).not.toContain('Yetkazib berish');
    expect(simple).not.toContain('Mahsulotlar: ');
    expect(simple).not.toContain('Hisob-faktura');
    expect(simple).toContain("To'lov: Naqd · To'langan");
    const paid = orderCardHtml(order({ corporateInvoices: [{ invoiceNo: 'INV-1', dueDate: at('2026-10-01T05:00:00Z'), totalAmount: 1130000, paidAmount: 1130000 }] }), 'uz', NOW);
    expect(paid).toContain(customerTexts.uz.card.invoicePaid);
    expect(paid).not.toContain("muddati o'tgan");
    const overdue = orderCardHtml(order({ corporateInvoices: [{ invoiceNo: 'INV-1', dueDate: at('2026-10-01T05:00:00Z'), totalAmount: 1130000, paidAmount: 0 }] }), 'uz', NOW);
    expect(overdue).toContain("To'lov muddati: 01.10.2026 ⚠️ muddati o'tgan");
    expect(overdue).toContain("Qoldiq: 1 130 000 so'm");
  });

  it('tugmalar: sayt va hisob-faktura havolasi, yangilash va ro\'yxatga qaytish', () => {
    vi.stubEnv('APP_URL', 'https://pack24.uz/');
    const kb = orderCardKeyboard(order(), 'ru', null);
    expect(urls(kb)).toEqual([`https://pack24.uz/ru/orders/${TOKEN}`, `https://pack24.uz/ru/orders/${TOKEN}/invoice`]);
    expect(callbacks(kb)).toEqual(['o_123', 'ol_0']);
    // Havolasiz (eski) buyurtma va hisob-fakturasiz buyurtma
    expect(urls(orderCardKeyboard(order({ accessToken: null }), 'uz', null))).toEqual([]);
    expect(urls(orderCardKeyboard(order({ corporateInvoices: [] }), 'uz', null))).toEqual([`https://pack24.uz/uz/orders/${TOKEN}`]);
  });

  it("«To'lash» faqat to'lanmagan va bekor qilinmagan buyurtmada", () => {
    const pay = 'https://checkout.paycom.uz/abc';
    const has = (patch: Partial<OrderCardData>, url: string | null = pay) => urls(orderCardKeyboard(order(patch), 'uz', url)).includes(pay);
    expect(has({})).toBe(true);
    expect(has({ paymentStatus: 'failed' })).toBe(true);
    expect(has({ paymentStatus: 'paid' })).toBe(false);
    expect(has({ paymentStatus: 'refunded' })).toBe(false);
    expect(has({ status: 'cancelled' })).toBe(false);
    expect(has({}, null)).toBe(false);
  });

  it("muddat kuni to'liq hisobga kiradi: hisob-faktura keyingi kun (Toshkent vaqti) boshlangachgina muddati o'tgan bo'ladi", () => {
    const card = (dueDate: Date, now = NOW) => orderCardHtml(order({ corporateInvoices: [{ invoiceNo: 'INV-1', dueDate, totalAmount: 1130000, paidAmount: 0 }] }), 'uz', now);
    // NOW — Toshkentda 10.10.2026, 12:00. Muddat shu kuni 10:00 (hisob-faktura 7 kun oldin shu soatda berilgan): mijozga faqat
    // sana ko'rsatiladi, kun esa hali tugamagan
    const today = card(at('2026-10-10T05:00:00Z'));
    expect(today).toContain("To'lov muddati: 10.10.2026");
    expect(today).not.toContain("muddati o'tgan");
    expect(card(at('2026-10-09T19:00:00Z'))).not.toContain("muddati o'tgan"); // bugun 00:00
    expect(card(at('2026-10-09T18:59:59Z'))).toContain("To'lov muddati: 09.10.2026 ⚠️ muddati o'tgan"); // kecha 23:59:59
    // Kun almashgach (11.10.2026, 00:00) o'sha hisob-faktura muddati o'tgan bo'ladi; undan bir soniya oldin — hali yo'q
    expect(card(at('2026-10-10T05:00:00Z'), at('2026-10-10T18:59:59Z'))).not.toContain("muddati o'tgan");
    expect(card(at('2026-10-10T05:00:00Z'), at('2026-10-10T19:00:00Z'))).toContain("To'lov muddati: 10.10.2026 ⚠️ muddati o'tgan");
  });

  it("to'langan buyurtmada ochiq qolgan hisob-faktura qarz bo'lib ko'rinmaydi; bekor qilingan yoki puli qaytarilgan buyurtmada muddat ham, qoldiq ham yo'q", () => {
    const open = [{ invoiceNo: 'INV-1', dueDate: at('2026-10-01T05:00:00Z'), totalAmount: 1130000, paidAmount: 130000 }];
    const paid = orderCardHtml(order({ paymentStatus: 'paid', corporateInvoices: open }), 'uz', NOW);
    expect(paid).toContain("To'lov: Bank o'tkazmasi · To'langan");
    expect(paid).toContain('Hisob-faktura <b>INV-1</b>');
    expect(paid).toContain(customerTexts.uz.card.invoicePaid);
    expect(paid).not.toContain('Qoldiq');
    expect(paid).not.toContain("muddati o'tgan");
    for (const patch of [{ status: 'cancelled' }, { paymentStatus: 'refunded' }, { status: 'cancelled', paymentStatus: 'paid' }] satisfies Partial<OrderCardData>[]) {
      const html = orderCardHtml(order({ ...patch, corporateInvoices: open }), 'ru', NOW);
      expect(html).toContain('Счёт-фактура <b>INV-1</b>');
      expect(html).not.toContain('Остаток');
      expect(html).not.toContain('Срок оплаты');
      expect(html).not.toContain('просрочен');
      expect(html).not.toContain(customerTexts.ru.card.invoicePaid);
    }
  });
});

describe('mijoz boti: balans', () => {
  it("(a) qarz yo'q", () => {
    const html = balanceHtml(debt(), 'uz');
    expect(html).toContain("Qarzingiz yo'q ✅");
    expect(html).not.toContain("Jami to'lanishi kerak");
    expect(html).not.toContain('Hisob-fakturalar');
    expect(html).not.toContain('Shartnoma');
    expect(balanceHtml(debt(), 'ru')).toContain('Задолженности нет ✅');
    expect(balanceKeyboard(debt(), 'uz')).toEqual([[{ text: customerTexts.uz.menu.requisites, callback_data: 'req' }]]);
  });

  it("(b) muddati o'tgan hisob-faktura va limitli shartnoma", () => {
    vi.stubEnv('APP_URL', 'https://pack24.uz');
    const d = debt({
      invoices: [
        { invoiceNo: 'INV-2026-0007', orderId: 45, accessToken: TOKEN, total: 1500000, paid: 300000, remaining: 1200000, dueDate: at('2026-10-01T05:00:00Z'), overdue: true, contractNo: 'SH-2026-001' },
        { invoiceNo: 'INV-2026-0009', orderId: 48, accessToken: null, total: 1050000, paid: 0, remaining: 1050000, dueDate: at('2026-10-20T05:00:00Z'), overdue: false, contractNo: 'SH-2026-001' },
      ],
      invoiceTotal: 2250000,
      overdueTotal: 1200000,
      contracts: [{ contractNo: 'SH-2026-001', companyName: '"Baraka & Savdo" MChJ', creditLimit: 10000000, used: 2250000, available: 7750000, paymentTermDays: 14 }],
      total: 2250000,
    });
    const html = balanceHtml(d, 'uz');
    expect(html).toContain("Jami to'lanishi kerak: <b>2 250 000 so'm</b>");
    expect(html).not.toContain("Qarzingiz yo'q");
    expect(html).toContain("• <b>INV-2026-0007</b> · buyurtma #45 · qoldiq 1 200 000 so'm · muddat 01.10.2026 ⚠️ muddati o'tgan");
    expect(html).toContain("• <b>INV-2026-0009</b> · buyurtma #48 · qoldiq 1 050 000 so'm · muddat 20.10.2026");
    expect(html.match(/⚠️ muddati o'tgan/g)).toHaveLength(1);
    expect(html).toContain("Shundan muddati o'tgan: <b>1 200 000 so'm</b>");
    expect(html).toContain('<b>Shartnoma SH-2026-001</b> · "Baraka &amp; Savdo" MChJ');
    expect(html).toContain("Nasiya limiti: 10 000 000 so'm");
    expect(html).toContain("Foydalanilgan: 2 250 000 so'm");
    expect(html).toContain("Mavjud: 7 750 000 so'm");
    expect(html).toContain("To'lov muddati: 14 kun");
    // Hisob-faktura sahifasi faqat havolasi bor buyurtmalarga
    expect(urls(balanceKeyboard(d, 'uz'))).toEqual([`https://pack24.uz/uz/orders/${TOKEN}/invoice`]);
    const ru = balanceHtml(d, 'ru');
    expect(ru).toContain('Всего к оплате: <b>2 250 000 сум</b>');
    expect(ru).toContain('Кредитный лимит: 10 000 000 сум');
    expect(ru).toContain('⚠️ просрочен');
  });

  it("(c) to'lanmagan naqd buyurtma; limit belgilanmagan shartnoma", () => {
    const d = debt({
      unpaidOrders: [
        { id: 50, accessToken: TOKEN, total: 800000, paymentMethod: 'cash', deliveryMethod: 'courier', createdAt: REGISTERED },
        { id: 51, accessToken: null, total: 400000, paymentMethod: 'payme', deliveryMethod: null, createdAt: REGISTERED },
        { id: 52, accessToken: null, total: 100000, paymentMethod: 'bank_transfer', deliveryMethod: null, createdAt: REGISTERED },
      ],
      unpaidOrdersTotal: 1300000,
      contracts: [{ contractNo: 'SH-2', companyName: 'Test', creditLimit: 0, used: 0, available: null, paymentTermDays: 15 }],
      total: 1300000,
    });
    const html = balanceHtml(d, 'uz');
    expect(html).toContain("Jami to'lanishi kerak: <b>1 300 000 so'm</b>");
    expect(html).toContain("<b>To'lanmagan buyurtmalar</b> — 1 300 000 so'm");
    expect(html).toContain("• <b>#50</b> · 09.10.2026 · 800 000 so'm · naqd, yetkazishda");
    expect(html).toContain("• <b>#51</b> · 09.10.2026 · 400 000 so'm · onlayn to'lov tugallanmagan");
    expect(html).toContain("• <b>#52</b> · 09.10.2026 · 100 000 so'm · bank o'tkazmasi");
    expect(html).not.toContain('Hisob-fakturalar');
    expect(html).toContain('Nasiya limiti belgilanmagan.');
    expect(html).not.toContain('Mavjud:');
    expect(balanceHtml(d, 'ru')).toContain('наличными при доставке');
  });

  it("uzun ro'yxatlar qisqartiriladi; hisob-faktura tugmalari 5 tadan oshmaydi", () => {
    const invoices = Array.from({ length: 30 }, (_, i) => ({ invoiceNo: `INV-${i + 1}`, orderId: i + 1, accessToken: `${TOKEN}${i}`, total: 100000, paid: 0, remaining: 100000, dueDate: at('2026-10-20T05:00:00Z'), overdue: false, contractNo: null }));
    const d = debt({ invoices, invoiceTotal: 3000000, total: 3000000 });
    const html = balanceHtml(d, 'uz');
    expect(html).toContain('INV-10</b>');
    expect(html).not.toContain('INV-11</b>');
    expect(html).toContain('… yana 20 ta');
    expect(html.length).toBeLessThan(4000);
    expect(urls(balanceKeyboard(d, 'uz'))).toHaveLength(5);
  });

  it("naqd to'lanadigan buyurtma: olib ketiladigan bo'lsa «olib ketishda», yetkaziladigan yoki usuli yozilmagan (eski) bo'lsa «yetkazishda»", () => {
    const row = (id: number, deliveryMethod: string | null, paymentMethod = 'cash') => ({ id, accessToken: null, total: 100000, paymentMethod, deliveryMethod, createdAt: REGISTERED });
    const d = debt({ unpaidOrders: [row(60, 'pickup'), row(61, 'courier'), row(62, null), row(63, 'pickup', 'bank_transfer')], unpaidOrdersTotal: 400000, total: 400000 });
    const uz = balanceHtml(d, 'uz');
    expect(uz).toContain("• <b>#60</b> · 09.10.2026 · 100 000 so'm · naqd, olib ketishda");
    expect(uz).toContain("• <b>#61</b> · 09.10.2026 · 100 000 so'm · naqd, yetkazishda");
    expect(uz).toContain("• <b>#62</b> · 09.10.2026 · 100 000 so'm · naqd, yetkazishda");
    expect(uz).toContain("• <b>#63</b> · 09.10.2026 · 100 000 so'm · bank o'tkazmasi");
    const ru = balanceHtml(d, 'ru');
    expect(ru).toContain('• <b>#60</b> · 09.10.2026 · 100 000 сум · наличными при самовывозе');
    expect(ru).toContain('• <b>#61</b> · 09.10.2026 · 100 000 сум · наличными при доставке');
  });

  it("20 tadan ko'p to'lanmagan buyurtma: 10 tasi ko'rsatiladi, qolgani «… yana N ta» — jami esa hammasi bo'yicha", () => {
    const unpaidOrders = Array.from({ length: 23 }, (_, i) => ({ id: 100 - i, accessToken: null, total: 100000, paymentMethod: 'cash', deliveryMethod: 'courier', createdAt: REGISTERED }));
    const html = balanceHtml(debt({ unpaidOrders, unpaidOrdersTotal: 2300000, total: 2300000 }), 'uz');
    expect(html).toContain("Jami to'lanishi kerak: <b>2 300 000 so'm</b>");
    expect(html).toContain("<b>To'lanmagan buyurtmalar</b> — 2 300 000 so'm");
    expect(html.split('\n').filter((line) => line.startsWith('• <b>#'))).toHaveLength(10);
    expect(html).toContain('… yana 13 ta');
    expect(html.length).toBeLessThan(4000);
  });
});

describe('mijoz boti: rekvizitlar va aloqa', () => {
  const settings = {
    companyName: 'Pack24', legalName: '"PACK 24" MChJ', inn: '301234567', bankDetails: 'H/r: 2020 8000 1234 5678 9001\nBank: "Kapitalbank" <Toshkent>\nMFO: 01088',
    directorName: 'A. Valiyev', address: { uz: "Toshkent, Oybek ko'chasi 14", ru: 'Ташкент, ул. Айбека 14' }, phone: '998880557888',
    phone2: '998712000000', email: 'info@pack24.uz', workHours: { uz: 'Du-Sh, 9:00-18:00', ru: 'Пн-Сб, 9:00-18:00' }, telegramChannel: '@pack24uz',
  };

  it("rekvizitlar: yuridik nom, STIR, bank ma'lumoti o'z holicha, to'lov maqsadi eslatmasi", () => {
    const html = requisitesHtml(settings, 'uz');
    expect(html).toContain('<b>"PACK 24" MChJ</b>');
    expect(html).toContain('STIR: <code>301234567</code>');
    expect(html).toContain('H/r: 2020 8000 1234 5678 9001\nBank: "Kapitalbank" &lt;Toshkent&gt;\nMFO: 01088');
    expect(html).toContain('Direktor: A. Valiyev');
    expect(html).toContain("Manzil: Toshkent, Oybek ko'chasi 14");
    expect(html).toContain('Telefon: +998 88 055 78 88');
    expect(html).toContain(customerTexts.uz.requisites.purpose);
    expect(requisitesHtml({ ...settings, legalName: '' }, 'ru')).toContain('<b>Pack24</b>');
  });

  it("bank rekvizitlari kiritilmagan: menejer yuboradi va telefon", () => {
    const html = requisitesHtml({ ...settings, bankDetails: '  ' }, 'uz');
    expect(html).toContain("Rekvizitlarni so'rovingiz bo'yicha menejer yuboradi.");
    expect(html).toContain('+998 88 055 78 88');
    expect(html).not.toContain(customerTexts.uz.requisites.purpose);
    expect(requisitesHtml({ ...settings, bankDetails: '' }, 'ru')).toContain('отправит менеджер');
  });

  it('aloqa: telefonlar, email, manzil, ish vaqti, sayt va Telegram kanal', () => {
    vi.stubEnv('APP_URL', 'https://pack24.uz');
    const html = contactsHtml(settings, 'ru');
    expect(html).toContain('+998 88 055 78 88');
    expect(html).toContain('+998 71 200 00 00');
    expect(html).toContain('info@pack24.uz');
    expect(html).toContain('Ташкент, ул. Айбека 14');
    expect(html).toContain('Время работы: Пн-Сб, 9:00-18:00');
    expect(html).toContain('Сайт: https://pack24.uz');
    expect(html).toContain('https://t.me/pack24uz');
    expect(contactsHtml({ ...settings, telegramChannel: '', phone2: '' }, 'uz')).not.toContain('t.me');
  });

  it('salomlashuvda Telegram ismi qochiriladi', () => {
    expect(helloHtml('uz', '<b>Ali</b> & Co', 'Pack24')).toContain('Assalomu alaykum, &lt;b&gt;Ali&lt;/b&gt; &amp; Co!');
    expect(helloHtml('ru', '', 'Pack24')).toContain('Здравствуйте!');
  });
});

describe('mijoz boti: tugmalar', () => {
  it('har bir callback_data 64 baytdan oshmaydi va ma\'lum prefiks bilan boshlanadi', () => {
    const big: OrderListData = {
      items: Array.from({ length: 6 }, (_, i) => ({ id: MAX_ID - i, status: 'new_' as const, paymentStatus: 'pending' as const, totalAmount: 1, createdAt: REGISTERED })),
      total: 600000, page: 50000, pages: 100000,
    };
    const invoices = Array.from({ length: 8 }, (_, i) => ({ invoiceNo: `INV-${i}`, orderId: MAX_ID, accessToken: TOKEN, total: 1, paid: 0, remaining: 1, dueDate: NOW, overdue: true, contractNo: null }));
    const keyboards: InlineKeyboard[] = (['uz', 'ru'] as const).flatMap((lang) => [
      langKeyboard(),
      langKeyboard(lang),
      sharePhoneKeyboard(lang),
      stopConfirmKeyboard(lang),
      ordersListKeyboard(big),
      orderCardKeyboard(order({ id: MAX_ID }), lang, 'https://checkout.paycom.uz/abc'),
      balanceKeyboard(debt({ invoices, total: 8 }), lang),
      settingsKeyboard({ notify: true, phone: '998901234567' }, lang),
      settingsKeyboard({ notify: false, phone: null }, lang),
    ]);
    const all = keyboards.flatMap(callbacks);
    expect(all.length).toBeGreaterThan(40);
    const prefixes = Object.values(CB);
    for (const data of all) {
      expect(Buffer.byteLength(data, 'utf8')).toBeLessThanOrEqual(64);
      expect(prefixes.some((p) => data.startsWith(p))).toBe(true);
    }
    // Har tugmada matn va aynan bitta harakat (callback yoki havola) bor
    for (const b of keyboards.flat(2)) {
      expect(b.text.length).toBeGreaterThan(0);
      expect(Number(!!b.callback_data) + Number(!!b.url)).toBe(1);
    }
  });

  it('prefikslar bir-birini yutib yubormaydi (marshrutlagich startsWith bilan tanlaydi)', () => {
    const prefixes = Object.values(CB);
    for (const a of prefixes) for (const b of prefixes) if (a !== b) expect(a.startsWith(b)).toBe(false);
  });

  it('sozlamalar tugmalari holatga qarab: xabarnoma, telefon, chiqish', () => {
    expect(callbacks(settingsKeyboard({ notify: true, phone: '998901234567' }, 'uz'))).toEqual(['lang_uz', 'lang_ru', 'ntf_off', 'phone', 'stop_ask']);
    expect(callbacks(settingsKeyboard({ notify: false, phone: null }, 'ru'))).toEqual(['lang_uz', 'lang_ru', 'ntf_on', 'phone', 'stop_ask']);
    expect(settingsKeyboard({ notify: true, phone: null }, 'uz')[2][0].text).toBe(customerTexts.uz.phone.share);
    expect(settingsKeyboard({ notify: true, phone: '998901234567' }, 'uz')[2][0].text).toBe(customerTexts.uz.settings.changePhone);
    expect(callbacks(stopConfirmKeyboard('uz'))).toEqual(['stop_yes', 'stop_no']);
    expect(langKeyboard('ru')[0].map((b) => b.text)).toEqual([customerTexts.uz.lang.button, `✓ ${customerTexts.ru.lang.button}`]);
  });
});

describe('mijoz boti: suhbat', () => {
  const { uz, ru } = customerTexts;
  const USER = { id: 777, first_name: 'Ali', last_name: 'Valiyev', language_code: 'uz' };
  const SCOPE = { telegramId: '777', phone: '998901234567', userId: 42 };
  const chat = { id: USER.id, type: 'private' };

  const message = (text?: string, extra: Partial<TgMessage> = {}): TgUpdate => ({ update_id: 1, message: { message_id: 10, from: USER, chat, date: 0, text, ...extra } });
  const press = (data: string, inline_keyboard: InlineKeyboard = []): TgUpdate => ({ update_id: 2, callback_query: { id: 'cb1', from: USER, data, message: { message_id: 20, chat, date: 0, reply_markup: { inline_keyboard } } } });
  /** Botga update beradi va shu update davomida Telegram'ga ketgan so'rovlarni qaytaradi */
  const send = async (update: TgUpdate): Promise<Sent[]> => {
    db.sent.length = 0;
    await bot.handle(update);
    return [...db.sent];
  };
  const known = (patch: Partial<TelegramCustomer> = {}) => void db.customers.set('777', db.row('777', { name: 'Ali Valiyev', ...patch }));
  const methods = (sent: Sent[]) => sent.map((s) => s.method);
  const menuOf = (s: Sent) => (s.params.reply_markup?.keyboard ?? []).flat().map((b) => b.text);
  const asksContact = (s: Sent) => s.params.reply_markup?.keyboard?.[0]?.[0]?.request_contact === true;
  const inlineOf = (s: Sent) => callbacks(s.params.reply_markup?.inline_keyboard ?? []);

  beforeEach(() => {
    db.customers.clear();
    db.sessions.clear();
    vi.resetAllMocks();
    vi.stubEnv('CUSTOMER_BOT_TOKEN', '111:test');
    vi.stubEnv('APP_URL', 'https://pack24.uz');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      db.sent.push({ method: url.split('/').pop() ?? '', params: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: true }));
    }));
  });

  it('guruh chatida jim turadi: hech kimning buyurtmasi guruhga chiqmaydi', async () => {
    known({ phone: SCOPE.phone });
    const group = { id: -1001234, type: 'supergroup' };
    expect(await send({ update_id: 1, message: { message_id: 1, from: USER, chat: group, date: 0, text: '/orders' } })).toEqual([]);
    expect(methods(await send({ update_id: 2, callback_query: { id: 'cb', from: USER, data: 'o_5', message: { message_id: 2, chat: group, date: 0 } } }))).toEqual(['answerCallbackQuery']);
    expect(account.listOrders).not.toHaveBeenCalled();
    expect(account.getOrder).not.toHaveBeenCalled();
  });

  it("birinchi /start: til so'raladi; havola darhol bog'lanadi va sessiyada saqlanadi", async () => {
    customers.bindOrderByToken.mockResolvedValueOnce({ order: { id: 123 } as never, bound: true });
    const sent = await send(message(`/start ${TOKEN}`));
    expect(customers.ensureBotCustomer).toHaveBeenCalledWith(777, { name: 'Ali Valiyev', lang: 'uz' });
    expect(customers.bindOrderByToken).toHaveBeenCalledWith(777, TOKEN);
    expect(sent).toHaveLength(1);
    expect(sent[0].params.text).toBe(`${uz.lang.choose}\n${ru.lang.choose}`);
    expect(inlineOf(sent[0])).toEqual(['lang_uz', 'lang_ru']);
    expect(db.sessions.get('777')).toEqual({ askLang: true, token: TOKEN });
    expect(account.getOrder).not.toHaveBeenCalled();
  });

  it("til tanlangach: salomlashuv, telefon so'rovi va havoladagi buyurtma kartasi", async () => {
    customers.bindOrderByToken.mockResolvedValue({ order: { id: 123 } as never, bound: true });
    account.getOrder.mockResolvedValue(order() as never);
    await send(message(`/start ${TOKEN}`));
    const sent = await send(press('lang_ru'));
    expect(customers.setCustomerLang).toHaveBeenCalledWith(777, 'ru');
    expect(db.sessions.has('777')).toBe(false);
    expect(methods(sent)).toEqual(['editMessageText', 'sendMessage', 'sendMessage', 'answerCallbackQuery']);
    expect(sent[0].params.text).toBe(ru.lang.chosen);
    expect(sent[1].params.text).toContain('Здравствуйте, Ali Valiyev!');
    expect(sent[1].params.text).toContain(ru.phone.why);
    expect(asksContact(sent[1])).toBe(true);
    expect(menuOf(sent[1])).toEqual([ru.phone.share, ru.phone.later]);
    expect(sent[2].params.text).toContain('Заказ #123');
    expect(account.getOrder).toHaveBeenCalledWith({ telegramId: '777', phone: null, userId: null }, 123);
  });

  it("yangi mijoz /start siz yozsa ham avval til so'raladi; tanlamaguncha menyu ochilmaydi", async () => {
    expect(inlineOf((await send(message('salom')))[0])).toEqual(['lang_uz', 'lang_ru']);
    expect(inlineOf((await send(message(uz.menu.orders)))[0])).toEqual(['lang_uz', 'lang_ru']);
    expect(account.listOrders).not.toHaveBeenCalled();
    // Boshlang'ich til Telegram tilidan taxmin qilinadi
    db.customers.clear();
    await send({ update_id: 1, message: { message_id: 1, from: { ...USER, language_code: 'ru-RU' }, chat, date: 0, text: '/start' } });
    expect(customers.ensureBotCustomer).toHaveBeenLastCalledWith(777, { name: 'Ali Valiyev', lang: 'ru' });
  });

  it("yozuvi yo'q chat xabarnomadagi tugmani bossa: karta darhol ochiladi, til keyingi xabarda so'raladi", async () => {
    account.getOrder.mockResolvedValueOnce(order() as never);
    const card = await send(press('o_123'));
    expect(methods(card)).toEqual(['editMessageText', 'answerCallbackQuery']);
    expect(card[0].params.text).toContain('Buyurtma #123');
    expect(db.sessions.get('777')).toEqual({ askLang: true });
    expect(inlineOf((await send(message(uz.menu.orders)))[0])).toEqual(['lang_uz', 'lang_ru']);
    const chosen = await send(press('lang_uz'));
    expect(chosen[0].params.text).toBe(uz.lang.chosen);
    expect(db.sessions.has('777')).toBe(false);
    expect(methods(await send(message(uz.menu.contacts)))).toEqual(['sendMessage']);
  });

  it('telefoni ulangan mijozga /start: salomlashuv va asosiy menyu', async () => {
    known({ phone: SCOPE.phone });
    const sent = await send(message('/start'));
    expect(sent).toHaveLength(1);
    expect(sent[0].params.text).toContain('Assalomu alaykum, Ali Valiyev!');
    expect(sent[0].params.text).toContain(uz.start.menuHint);
    expect(menuOf(sent[0])).toEqual(Object.values(uz.menu));
    expect(customers.bindOrderByToken).not.toHaveBeenCalled();
  });

  it('boshqa hisobga ulangan buyurtma: muloyim xabar, buyurtma haqida hech narsa ochilmaydi', async () => {
    known();
    customers.bindOrderByToken.mockResolvedValueOnce({ order: { id: 999 } as never, bound: false });
    const sent = await send(message(`/start ${TOKEN}`));
    const all = sent.map((s) => s.params.text).join('\n');
    expect(all).toContain(uz.start.orderTaken);
    expect(all).not.toContain('999');
    expect(account.getOrder).not.toHaveBeenCalled();
    // Yaroqsiz (topilmagan) havola
    const missing = await send(message(`/start ${TOKEN}`));
    expect(missing.map((s) => s.params.text).join('\n')).toContain(uz.start.orderMissing);
    // Tokenga o'xshamagan payload e'tiborsiz qoladi
    await send(message('/start promo'));
    expect(customers.bindOrderByToken).toHaveBeenCalledTimes(2);
  });

  it("boshqa chatga ulangan buyurtma mijozning o'z telefoni bo'yicha ko'rinsa: karta ochiladi; ko'rinmasa — o'sha muloyim xabar", async () => {
    known({ phone: SCOPE.phone });
    customers.bindOrderByToken.mockResolvedValue({ order: { id: 123 } as never, bound: false });
    // Buyurtma egasi (telefoni tasdiqlangan): havolani birinchi bo'lib hamkasbi ochgan bo'lsa ham kartani ko'radi
    account.getOrder.mockResolvedValue(order() as never);
    const own = await send(message(`/start ${TOKEN}`));
    expect(account.getOrder).toHaveBeenCalledWith(SCOPE, 123);
    expect(methods(own)).toEqual(['sendMessage', 'sendMessage']);
    expect(menuOf(own[0])).toEqual(Object.values(uz.menu));
    expect(own[1].params.text).toContain('Buyurtma #123');
    expect(own.map((s) => s.params.text).join('\n')).not.toContain(uz.start.orderTaken);
    // Telefoni ulangan, lekin buyurtma uniki emas: karta ham, "topilmadi" ham chiqmaydi
    account.getOrder.mockResolvedValue(null);
    const foreign = await send(message(`/start ${TOKEN}`));
    expect(methods(foreign)).toEqual(['sendMessage', 'sendMessage']);
    expect(foreign[1].params.text).toBe(uz.start.orderTaken);
    expect(foreign.map((s) => s.params.text).join('\n')).not.toContain('123');
  });

  it('begona yoki user_id siz kontakt qabul qilinmaydi', async () => {
    known();
    for (const contact of [{ phone_number: '+998901234567', first_name: 'Vali', user_id: 555 }, { phone_number: '+998901234567', first_name: 'Vali' }]) {
      const sent = await send(message(undefined, { contact }));
      expect(sent).toHaveLength(1);
      expect(sent[0].params.text).toBe(uz.phone.notOwn);
      expect(asksContact(sent[0])).toBe(true);
    }
    expect(customers.linkCustomerPhone).not.toHaveBeenCalled();
    expect(db.customers.get('777')?.phone).toBeNull();
  });

  it("o'z kontakti: raqam ulanadi, topilgan buyurtmalar soni aytiladi, menyu ochiladi", async () => {
    known();
    account.listOrders.mockResolvedValueOnce({ items: [], total: 3, page: 0, pages: 3 });
    const sent = await send(message(undefined, { contact: { phone_number: '+998 90 123 45 67', first_name: 'Ali', user_id: 777 } }));
    expect(customers.linkCustomerPhone).toHaveBeenCalledWith(777, '+998 90 123 45 67', 'Ali Valiyev');
    expect(account.listOrders).toHaveBeenCalledWith(SCOPE, 0, 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].params.text).toContain('+998 90 123 45 67');
    expect(sent[0].params.text).toContain('Topilgan buyurtmalar: 3 ta.');
    expect(menuOf(sent[0])).toEqual(Object.values(uz.menu));
  });

  it("O'zbekistondan tashqari raqam: faqat +998 qo'llab-quvvatlanishi va kompaniya telefoni aytiladi", async () => {
    known();
    const sent = await send(message(undefined, { contact: { phone_number: '+79001234567', first_name: 'Ali', user_id: 777 } }));
    expect(sent[0].params.text).toContain('(+998)');
    expect(sent[0].params.text).toContain('+998 88 055 78 88');
    expect(db.customers.get('777')?.phone).toBeNull();
    expect(account.listOrders).not.toHaveBeenCalled();
  });

  it("yozib yuborilgan raqam hech narsani ulamaydi: tugmadan foydalanish yo'riqnomasi", async () => {
    known();
    for (const text of ['+998901234567', '90 123 45 67', '998 (90) 123-45-67']) {
      const sent = await send(message(text));
      expect(sent).toHaveLength(1);
      expect(sent[0].params.text).toBe(uz.phone.typed);
      expect(asksContact(sent[0])).toBe(true);
    }
    expect(customers.linkCustomerPhone).not.toHaveBeenCalled();
    expect(db.customers.get('777')?.phone).toBeNull();
  });

  it("telefoni ulangan mijoz raqam yozsa (STIR, to'lov raqami): oddiy yo'riqnoma, asosiy menyu joyida qoladi", async () => {
    known({ phone: SCOPE.phone });
    for (const text of ['305123456', '+998 90 765 43 21']) {
      const sent = await send(message(text));
      expect(sent).toHaveLength(1);
      expect(sent[0].params.text).toBe(uz.fallback);
      expect(menuOf(sent[0])).toEqual(Object.values(uz.menu));
    }
    expect(customers.linkCustomerPhone).not.toHaveBeenCalled();
    expect(db.customers.get('777')?.phone).toBe(SCOPE.phone);
  });

  it("menyu tugmasi boshqa tildagi klaviaturadan bosilsa ham ishlaydi; so'rov mijoz doirasida", async () => {
    known({ phone: SCOPE.phone });
    account.listOrders.mockResolvedValueOnce({ items: [order()], total: 1, page: 0, pages: 1 } as never);
    const sent = await send(message(ru.menu.orders));
    expect(account.listOrders).toHaveBeenCalledWith(SCOPE, 0, 6);
    expect(methods(sent)).toEqual(['sendMessage']);
    expect(sent[0].params.text).toContain('Buyurtmalarim');
    expect(inlineOf(sent[0])).toEqual(['o_123']);
  });

  it("buyurtma yo'q: telefon ulangan bo'lsa sayt havolasi, ulanmagan bo'lsa raqam so'raladi", async () => {
    known({ phone: SCOPE.phone });
    expect((await send(message('/orders')))[0].params.text).toBe(uz.orders.empty('https://pack24.uz'));
    known();
    const sent = await send(message('/orders'));
    expect(sent[0].params.text).toBe(uz.phone.needForOrders);
    expect(asksContact(sent[0])).toBe(true);
    // Inline tugmadan kelganda xabar tahrirlanadi va "Raqamni ulashish" tugmasi chiqadi
    const edited = await send(press('ol_0'));
    expect(methods(edited)).toEqual(['editMessageText', 'answerCallbackQuery']);
    expect(inlineOf(edited[0])).toEqual(['phone']);
  });

  it('varaqlash (ol_<sahifa>): xabar tahrirlanadi', async () => {
    known({ phone: SCOPE.phone });
    account.listOrders.mockResolvedValueOnce({ items: [order()], total: 13, page: 2, pages: 3 } as never);
    const sent = await send(press('ol_2'));
    expect(account.listOrders).toHaveBeenCalledWith(SCOPE, 2, 6);
    expect(methods(sent)).toEqual(['editMessageText', 'answerCallbackQuery']);
    expect(inlineOf(sent[0])).toEqual(['o_123', 'ol_1', 'ol_2']);
    await send(press('ol_x'));
    expect(account.listOrders).toHaveBeenLastCalledWith(SCOPE, 0, 6);
  });

  it("«Batafsil» (o_<id>): karta shu xabarni tahrirlab chiqadi, so'rov mijoz doirasida", async () => {
    known({ phone: SCOPE.phone });
    account.getOrder.mockResolvedValue(order() as never);
    const sent = await send(press('o_123', [[{ text: '📦 Batafsil', callback_data: 'o_123' }]]));
    expect(account.getOrder).toHaveBeenCalledWith(SCOPE, 123);
    expect(methods(sent)).toEqual(['editMessageText', 'answerCallbackQuery']);
    expect(sent[0].params.message_id).toBe(20);
    expect(sent[0].params.text).toContain('Buyurtma #123');
    expect(inlineOf(sent[0])).toEqual(['o_123', 'ol_0']);
    expect(sent[1].params.text).toBeUndefined();
    // Kartaning o'z "Yangilash" tugmasi: qisqa tasdiq
    const refreshed = await send(press('o_123', [[{ text: uz.card.refresh, callback_data: 'o_123' }]]));
    expect(refreshed[1].params.text).toBe(uz.card.refreshed);
  });

  it("begona yoki mavjud bo'lmagan buyurtma: bir xil javob, xabar tahrirlanmaydi", async () => {
    known({ phone: SCOPE.phone });
    const sent = await send(press('o_999'));
    expect(account.getOrder).toHaveBeenCalledWith(SCOPE, 999);
    expect(methods(sent).every((m) => m === 'answerCallbackQuery')).toBe(true);
    expect(sent[0].params).toMatchObject({ text: uz.card.notFound, show_alert: true });
    const bad = await send(press('o_abc'));
    expect(bad[0].params).toMatchObject({ text: uz.card.notFound, show_alert: true });
    expect(account.getOrder).toHaveBeenCalledTimes(1);
  });

  it("balans: telefon ulanmagan bo'lsa hisoblanmaydi; ulangan bo'lsa mijoz doirasida", async () => {
    known();
    const ask = await send(message(uz.menu.balance));
    expect(account.customerDebt).not.toHaveBeenCalled();
    expect(ask[0].params.text).toBe(uz.phone.needForBalance);
    expect(asksContact(ask[0])).toBe(true);
    known({ phone: SCOPE.phone });
    account.customerDebt.mockResolvedValueOnce(debt());
    const sent = await send(message('/balance'));
    expect(account.customerDebt).toHaveBeenCalledWith(SCOPE);
    expect(sent[0].params.text).toContain(uz.balance.noDebt);
    expect(inlineOf(sent[0])).toEqual(['req']);
    // Rekvizitlar balans xabarini almashtirmaydi — yangi xabar bo'lib keladi
    const req = await send(press('req'));
    expect(methods(req)).toEqual(['sendMessage', 'answerCallbackQuery']);
    expect(req[0].params.text).toContain(uz.requisites.title);
  });

  it("sozlamalar: xabarnoma, til va telefon; noma'lum qiymat e'tiborsiz", async () => {
    known({ phone: SCOPE.phone });
    const shown = await send(message(uz.menu.settings));
    expect(shown[0].params.text).toContain('+998 ** *** ** 67');
    expect(inlineOf(shown[0])).toEqual(['lang_uz', 'lang_ru', 'ntf_off', 'phone', 'stop_ask']);
    const off = await send(press('ntf_off'));
    expect(customers.setCustomerNotify).toHaveBeenCalledWith(777, false);
    expect(methods(off)).toEqual(['editMessageText', 'answerCallbackQuery']);
    expect(inlineOf(off[0])).toContain('ntf_on');
    expect(off[1].params.text).toBe(uz.settings.turnedOff);
    await send(press('ntf_bogus'));
    expect(customers.setCustomerNotify).toHaveBeenCalledTimes(1);
    // Til sozlamalardan almashtirildi: sozlamalar yangi tilda, menyu yangi xabar bilan yangilanadi
    const lang = await send(press('lang_ru'));
    expect(customers.setCustomerLang).toHaveBeenCalledWith(777, 'ru');
    expect(methods(lang)).toEqual(['editMessageText', 'sendMessage', 'answerCallbackQuery']);
    expect(lang[0].params.text).toContain('Настройки');
    expect(lang[1].params.text).toBe(ru.lang.changed);
    expect(menuOf(lang[1])).toEqual(Object.values(ru.menu));
    await send(press('lang_en'));
    expect(customers.setCustomerLang).toHaveBeenCalledTimes(1);
    // "Raqamni yangilash": kontakt tugmasi yangi xabarda
    const phone = await send(press('phone'));
    expect(phone[0].params.text).toBe(ru.phone.change);
    expect(asksContact(phone[0])).toBe(true);
  });

  it('birinchi til tanlovidagi tugma ikki marta bosilsa: ikkinchi bosish xabarga ham, klaviaturaga ham tegmaydi', async () => {
    await send(message('/start'));
    const first = await send(press('lang_uz'));
    expect(methods(first)).toEqual(['editMessageText', 'sendMessage', 'answerCallbackQuery']);
    expect(first[0].params.text).toBe(uz.lang.chosen);
    expect(asksContact(first[1])).toBe(true);
    // Ikkinchi bosish: "✅ Til" xabari sozlamalarga aylanmaydi, kontakt tugmasi o'rniga menyu kelmaydi — faqat qisqa javob
    const second = await send(press('lang_uz'));
    expect(methods(second)).toEqual(['answerCallbackQuery']);
    expect(second[0].params.text).toBe(uz.lang.chosen);
    expect(customers.setCustomerLang).toHaveBeenCalledTimes(1);
  });

  it("eskirgan birinchi til so'rovi (sessiya o'chgan): taxmin qilingan til bosilsa ham salomlashuv keladi", async () => {
    const old = Math.floor(Date.now() / 1000) - 8 * 86_400;
    const prompt = (data: string, kb: InlineKeyboard, date: number): TgUpdate => ({ update_id: 2, callback_query: { id: 'cb1', from: USER, data, message: { message_id: 20, chat, date, reply_markup: { inline_keyboard: kb } } } });
    const first = [[{ text: uz.lang.button, callback_data: 'lang_uz' }, { text: ru.lang.button, callback_data: 'lang_ru' }]];
    known({ lang: 'uz' });
    const r = await send(prompt('lang_uz', first, old));
    expect(methods(r)).toEqual(['editMessageText', 'sendMessage', 'answerCallbackQuery']);
    expect(r[0].params.text).toBe(uz.lang.chosen);
    expect(asksContact(r[1])).toBe(true);
    // Yangi so'rovdagi takroriy bosish va ✓ belgili (sozlamalar, /lang) klaviatura avvalgidek: faqat qisqa javob
    const fresh = await send(prompt('lang_uz', first, Math.floor(Date.now() / 1000) - 60));
    expect(methods(fresh)).toEqual(['answerCallbackQuery']);
    const marked = [[{ text: `✓ ${uz.lang.button}`, callback_data: 'lang_uz' }, { text: ru.lang.button, callback_data: 'lang_ru' }]];
    expect(methods(await send(prompt('lang_uz', marked, old)))).toEqual(['answerCallbackQuery']);
    expect((await send(prompt('lang_ru', marked, old)))[1].params.text).toBe(ru.lang.changed);
  });

  it("sozlamalarda tanlangan tilning o'zi bosilsa: «til o'zgartirildi» deyilmaydi; boshqa til — almashtiriladi", async () => {
    known({ phone: SCOPE.phone, lang: 'ru' });
    const same = await send(press('lang_ru'));
    expect(methods(same)).toEqual(['answerCallbackQuery']);
    expect(same[0].params.text).toBe(ru.lang.chosen);
    expect(customers.setCustomerLang).not.toHaveBeenCalled();
    const other = await send(press('lang_uz'));
    expect(customers.setCustomerLang).toHaveBeenCalledWith(777, 'uz');
    expect(methods(other)).toEqual(['editMessageText', 'sendMessage', 'answerCallbackQuery']);
    expect(other[1].params.text).toBe(uz.lang.changed);
    expect(menuOf(other[1])).toEqual(Object.values(uz.menu));
  });

  it('botdan chiqish: faqat tasdiqdan keyin uziladi, klaviatura olib tashlanadi', async () => {
    known({ phone: SCOPE.phone });
    db.sessions.set('777', { token: TOKEN });
    const ask = await send(message('/stop'));
    expect(ask[0].params.text).toBe(uz.stop.confirm);
    expect(inlineOf(ask[0])).toEqual(['stop_yes', 'stop_no']);
    expect((await send(press('stop_ask')))[0].params.text).toBe(uz.stop.confirm);
    const no = await send(press('stop_no'));
    expect(no[0].params.text).toContain(uz.settings.title);
    expect(customers.unlinkCustomer).not.toHaveBeenCalled();
    const yes = await send(press('stop_yes'));
    expect(customers.unlinkCustomer).toHaveBeenCalledWith(777);
    expect(db.customers.has('777')).toBe(false);
    expect(db.sessions.has('777')).toBe(false);
    expect(methods(yes)).toEqual(['editMessageText', 'sendMessage', 'answerCallbackQuery']);
    expect(yes[0].params.text).toBe(uz.stop.done);
    expect(yes[1].params.text).toBe(uz.stop.bye);
    expect(yes[1].params.text).toContain('/start');
    expect(yes[1].params.reply_markup).toEqual({ remove_keyboard: true });
  });

  it("boshqa matn: qisqa yo'riqnoma va menyu; «Keyinroq» ikkala tilda", async () => {
    known({ lang: 'ru' });
    const hint = await send(message('Здравствуйте, где мой заказ?'));
    expect(hint[0].params.text).toBe(ru.fallback);
    expect(menuOf(hint[0])).toEqual(Object.values(ru.menu));
    for (const text of [uz.phone.later, ru.phone.later]) {
      const later = await send(message(text));
      expect(later[0].params.text).toBe(ru.phone.laterNote);
      expect(menuOf(later[0])).toEqual(Object.values(ru.menu));
    }
    expect((await send(message('/help')))[0].params.text).toContain('+998 88 055 78 88');
  });

  it('Telegram "/" menyusidagi (botMeta) har bir buyruqni bot ushlaydi: yo\'riqnoma emas, o\'z javobi keladi', async () => {
    known({ phone: SCOPE.phone });
    expect(botMeta.customer.commands.length).toBeGreaterThan(0);
    for (const { command } of botMeta.customer.commands) {
      const sent = await send(message(`/${command}`));
      expect(sent.length, command).toBeGreaterThan(0);
      for (const s of sent) expect(s.params.text, command).not.toBe(uz.fallback);
    }
    // Solishtirish uchun: bot bilmaydigan buyruq umumiy yo'riqnomaga tushadi
    expect((await send(message('/bogus')))[0].params.text).toBe(uz.fallback);
  });

  it('xato: umumiy uzr, xato matni mijozga chiqmaydi', async () => {
    known({ phone: SCOPE.phone });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    account.listOrders.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const sent = await send(message('/orders'));
    expect(sent).toHaveLength(1);
    expect(sent[0].params.text).toBe(`${uz.error}\n${ru.error}`);
    account.getOrder.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const alert = await send(press('o_5'));
    expect(alert[0].params).toMatchObject({ text: `${uz.error}\n${ru.error}`, show_alert: true });
    expect(JSON.stringify([...sent, ...alert])).not.toContain('ECONNREFUSED');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
