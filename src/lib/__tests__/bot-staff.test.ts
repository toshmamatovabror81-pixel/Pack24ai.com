import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import type { InlineKeyboard, TgUpdate } from '@/lib/telegram/api';

/**
 * Boshqaruv boti: bazasiz testlar. Baza, sessiya, xodimni ulash va holat o'zgartirish modullari soxta;
 * Telegram API o'rnida fetch ushlanadi — bot nima yuborgani `calls` da ko'rinadi.
 */
vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({
  sessions: new Map<string, object>(),
  prisma: {
    order: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    corporateInvoice: { findMany: vi.fn(), aggregate: vi.fn() },
  },
  staffByTelegram: vi.fn(),
  linkStaffByPhone: vi.fn(),
  linkStaffByCode: vi.fn(),
  unlinkStaff: vi.fn(),
  setStaffNotify: vi.fn(),
  changeOrderStatus: vi.fn(),
  setManualPayment: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: h.prisma }));
// Kalit bazadagi kabi sessiya turi + Telegram ID: suhbat sessiyasi ('staff') va noto'g'ri kodlar hisobi ('staff_code') alohida qatorlar
vi.mock('@/lib/telegram/session', () => ({
  getSession: async (bot: string, id: number | string) => h.sessions.get(`${bot}:${id}`) ?? null,
  setSession: async (bot: string, id: number | string, data: object) => void h.sessions.set(`${bot}:${id}`, data),
  clearSession: async (bot: string, id: number | string) => void h.sessions.delete(`${bot}:${id}`),
}));
vi.mock('@/lib/telegram/staffLink', () => ({
  staffByTelegram: h.staffByTelegram, linkStaffByPhone: h.linkStaffByPhone, linkStaffByCode: h.linkStaffByCode, unlinkStaff: h.unlinkStaff, setStaffNotify: h.setStaffNotify,
}));
vi.mock('@/lib/orderFlow', () => ({ changeOrderStatus: h.changeOrderStatus, setManualPayment: h.setManualPayment }));
vi.mock('@/lib/orderNotify', () => ({ sendDailyDigest: vi.fn() }));

const { can } = await import('@/lib/auth/permissions');
const { overdueInvoiceWhere } = await import('@/lib/invoiceStatus');
const { ORDER_FLOW } = await import('@/lib/orderStatus');
const { cancelConfirmKeyboard, canMarkPaid, staffOrderHtml, staffOrderKeyboard, staffOrderLine } = await import('@/lib/telegram/staffCards');
const V = await import('@/lib/telegram/bots/staffViews');
const { bot } = await import('@/lib/telegram/bots/staff');
const { botMeta } = await import('@/lib/telegram/bots');

const STATUSES: OrderStatus[] = ['draft', 'new_', 'processing', 'shipping', 'delivered', 'cancelled'];
const PAYMENTS: PaymentStatus[] = ['pending', 'processing', 'paid', 'failed', 'refunded'];
const datas = (rows: InlineKeyboard) => rows.flat().map((b) => b.callback_data).filter((d): d is string => !!d);
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

// ─── Sof qismlar: staffViews va staffCards ───────────────────────────────────

describe('boshqaruv boti: menyu', () => {
  const texts = (role: Parameters<typeof V.menuKeyboard>[0]) => V.menuKeyboard(role).keyboard.flat().map((b) => b.text);

  it('menyu rol ruxsatlariga qarab tuziladi', () => {
    expect(texts('staff')).toEqual([V.BTN.newOrders, V.BTN.active, V.BTN.find, V.BTN.today, V.BTN.notify, V.BTN.help]);
    expect(texts('manager')).toEqual([V.BTN.newOrders, V.BTN.active, V.BTN.find, V.BTN.today, V.BTN.debts, V.BTN.notify, V.BTN.help]);
    expect(texts('admin')).toEqual(texts('manager'));
    // Ruxsati yo'q rolga buyurtma va moliya tugmalari umuman chiqmaydi
    expect(texts('user')).toEqual([V.BTN.notify, V.BTN.help]);
    for (const role of ['staff', 'manager', 'admin'] as const) {
      expect(texts(role).includes(V.BTN.newOrders)).toBe(can(role, 'orders'));
      expect(texts(role).includes(V.BTN.debts)).toBe(can(role, 'finance'));
    }
  });

  it('menyu doimiy, qatorida ko\'pi bilan 2 ta tugma; mehmonga faqat kontakt tugmasi', () => {
    const kb = V.menuKeyboard('admin');
    expect(kb.is_persistent).toBe(true);
    expect(kb.resize_keyboard).toBe(true);
    expect(kb.keyboard.every((r) => r.length <= 2)).toBe(true);
    expect(V.guestKeyboard().keyboard).toEqual([[{ text: V.BTN.contact, request_contact: true }]]);
  });

  it('yordam matni ham ruxsatga qarab: xodimga qarzdorlik haqida yozilmaydi', () => {
    expect(V.helpHtml('staff')).not.toContain(V.BTN.debts);
    expect(V.helpHtml('manager')).toContain(V.BTN.debts);
    expect(V.helpHtml('staff')).toContain(V.BTN.newOrders);
    expect(V.helpHtml('user')).not.toContain(V.BTN.newOrders);
  });

  it('ism HTML sifatida emas, matn sifatida chiqadi', () => {
    const html = V.welcomeHtml({ name: '<i>Ali</i> & Co', role: 'manager', telegramNotify: false }, true);
    expect(html).toContain('&lt;i&gt;Ali&lt;/i&gt; &amp; Co');
    expect(html).not.toContain('<i>');
    expect(html).toContain('Rol: <b>Menejer</b>');
    expect(html).toContain('🔕');
    expect(V.statusNote('processing', '<b>x</b>')).toBe('✅ <b>Holat: Tayyorlanmoqda</b> — &lt;b&gt;x&lt;/b&gt;');
    expect(V.statusNote('cancelled', 'Ali').startsWith('❌ <b>Holat: Bekor qilingan</b>')).toBe(true);
    expect(V.paidNote('A&B')).toBe("💵 <b>To'lov belgilandi</b> — A&amp;B");
  });
});

describe('boshqaruv boti: buyurtma kartasi tugmalari', () => {
  it("holat tugmalari aynan ORDER_FLOW o'tishlari; bekor qilish faqat tasdiq orqali (oc_)", () => {
    for (const status of STATUSES) {
      const d = datas(staffOrderKeyboard({ id: 12, status, paymentStatus: 'paid', paymentMethod: 'payme' }, true));
      const offered: OrderStatus[] = d.filter((x) => x.startsWith('os_')).map((x) => V.parseStatusData(x)!.status);
      if (d.includes('oc_12')) offered.push('cancelled');
      expect([...offered].sort()).toEqual([...ORDER_FLOW[status]].sort());
      expect(d).not.toContain('os_12_cancelled');
      expect(d).toContain('or_12');
    }
  });

  it("ruxsat bo'lmasa (canEdit=false) o'zgartiruvchi tugma yo'q — faqat yangilash va admin panel havolasi", () => {
    for (const status of STATUSES) {
      for (const paymentStatus of PAYMENTS) {
        const rows = staffOrderKeyboard({ id: 12, status, paymentStatus, paymentMethod: 'cash' }, false);
        expect(datas(rows)).toEqual(['or_12']);
        expect(rows.flat().filter((b) => b.url).map((b) => b.url)).toEqual(['https://pack24.uz/admin/orders/12']);
      }
    }
  });

  it("«To'landi» faqat qo'lda belgilanadigan usulda va hali to'lanmagan bo'lsa", () => {
    const has = (paymentMethod: string | null, paymentStatus: PaymentStatus, status: OrderStatus = 'processing') =>
      datas(staffOrderKeyboard({ id: 7, status, paymentStatus, paymentMethod: paymentMethod as never }, true)).includes('op_7');
    for (const method of ['cash', 'bank_transfer', null]) {
      expect(has(method, 'pending')).toBe(true);
      expect(has(method, 'failed')).toBe(true);
      expect(has(method, 'paid')).toBe(false);
      expect(has(method, 'refunded')).toBe(false);
      expect(has(method, 'pending', 'cancelled')).toBe(false);
    }
    for (const method of ['payme', 'click']) for (const p of PAYMENTS) expect(has(method, p)).toBe(false);
    // Tugma sharti va bot bosilganda tekshiradigan shart bitta funksiya
    expect(canMarkPaid({ status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash' })).toBe(true);
    expect(canMarkPaid({ status: 'cancelled', paymentStatus: 'pending', paymentMethod: 'cash' })).toBe(false);
    expect(canMarkPaid({ status: 'new_', paymentStatus: 'pending', paymentMethod: 'click' })).toBe(false);
  });

  it('os_ callback tahlili: faqat ma\'lum holat va yaroqli raqam', () => {
    expect(V.parseStatusData('os_12_processing')).toEqual({ id: 12, status: 'processing' });
    expect(V.parseStatusData('os_12_new_')).toEqual({ id: 12, status: 'new_' });
    for (const bad of ['os_12_draft', 'os_12_paid', 'os_0_processing', 'os_-1_processing', 'os_x_processing', 'os_12', 'os_99999999999_processing', 'or_12', 'os_12_processing; drop']) {
      expect(V.parseStatusData(bad)).toBeNull();
    }
  });

  it('karta matni: mijoz yozgan hamma narsa qochiriladi', () => {
    const html = staffOrderHtml({
      id: 5, status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash', totalAmount: 1250000, createdAt: new Date('2026-10-09T05:00:00Z'),
      customerName: 'Vali <script>', contactPhone: '998901234567', companyInn: null, deliveryMethod: 'courier', shippingAddress: 'Chilonzor <1>', comment: 'a & b',
      items: [{ quantity: 2, product: { name: 'Quti <30x20>' } }], corporateInvoices: [],
    } as never, V.statusNote('processing', 'Ali'));
    expect(html.split('\n')[0]).toBe('✅ <b>Holat: Tayyorlanmoqda</b> — Ali');
    expect(html).toContain('Vali &lt;script&gt;');
    expect(html).toContain('Quti &lt;30x20&gt; × 2');
    expect(html).toContain('Chilonzor &lt;1&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('+998 90 123 45 67');
    expect(staffOrderLine({ id: 5, status: 'shipping', totalAmount: 1000 as never, createdAt: new Date('2026-10-09T05:00:00Z'), customerName: '<b>' })).toContain('&lt;b&gt;');
  });

  it('karta matni: sayt qabul qiladigan eng uzun buyurtmada ham Telegram chegarasidan (4000 belgi) oshmaydi', () => {
    // Checkout chegaralari: ism 100 + kompaniya 150, manzil 500, izoh 1000, savatda 100 tagacha mahsulot
    const html = staffOrderHtml({
      id: 2147483646, status: 'new_', paymentStatus: 'pending', paymentMethod: 'bank_transfer', totalAmount: 999999999999, createdAt: new Date('2026-10-09T05:00:00Z'),
      customerName: 'A'.repeat(253), contactPhone: '998901234567', companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: 'B'.repeat(500), comment: 'C'.repeat(1000),
      items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: 'Q'.repeat(300) } })), corporateInvoices: [{ invoiceNo: 'INV-2026-0001' }],
    } as never, V.statusNote('processing', 'D'.repeat(100)));
    expect(html.length).toBeLessThan(4000);
    expect(html).toContain(`• ${'Q'.repeat(80)} × 100000`);
    expect(html).not.toContain('Q'.repeat(81));
    expect(html).toContain('… yana 85 ta');
    // Oddiy matn qochirilgan uzunlik chegaralariga yetmaydi: hech bir maydon qisqartirilmagan
    expect(html).toContain(`👤 ${'A'.repeat(253)}\n`);
    expect(html).toContain(`📍 ${'B'.repeat(500)}\n`);
    expect(html.endsWith(`💬 ${'C'.repeat(300)}`)).toBe(true);
  });

  it("karta matni: qochiriladigan belgilar (& < >) bilan ham 4000 dan oshmaydi, bekor qilish so'rovi bilan birga", () => {
    for (const ch of ['&', '<', '>']) {
      const html = staffOrderHtml({
        id: 2147483646, status: 'new_', paymentStatus: 'pending', paymentMethod: 'bank_transfer', totalAmount: 999999999999, createdAt: new Date('2026-10-09T05:00:00Z'),
        customerName: ch.repeat(253), contactPhone: '998901234567', companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: ch.repeat(500), comment: ch.repeat(1000),
        items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: ch.repeat(300) } })), corporateInvoices: [{ invoiceNo: 'INV-2026-0001' }],
      } as never, V.statusNote('processing', 'D'.repeat(100)));
      // Eng uzun xabar — bekor qilish so'rovi: karta + savol. Kesilsa, <b> yopilmay qoladi va Telegram butun xabarni rad etadi
      const full = `${html}\n\n${V.cancelAskHtml(2147483646)}`;
      expect(full.length, ch).toBeLessThanOrEqual(4000);
      expect(full, ch).not.toMatch(/&[a-z]*(?![a-z;])/); // yarim qolgan &amp; yo'q
      expect((full.match(/<b>/g) ?? []).length).toBe((full.match(/<\/b>/g) ?? []).length);
      expect(full).toContain('💬');
      expect(full).toContain('bekor qilinsinmi?</b>');
    }
  });

  it('kesilgan matnda yarim emoji (juftsiz surrogat) qolmaydi: Telegram bunday xabarni butunlay rad etadi', () => {
    const at = new Date('2026-10-09T05:00:00Z');
    const line = (customerName: string) => staffOrderLine({ id: 5, status: 'new_', totalAmount: 1000 as never, createdAt: at, customerName });
    // Emoji aynan 40-belgi chegarasida (UTF-16 bo'yicha 39/40): yarmi qolmaydi; to'liq sig'sa — qoladi
    expect(line(`${'A'.repeat(39)}😀x`).isWellFormed()).toBe(true);
    expect(line(`${'A'.repeat(39)}😀x`).endsWith(` · ${'A'.repeat(39)}`)).toBe(true);
    expect(line(`${'A'.repeat(38)}😀x`).endsWith(` · ${'A'.repeat(38)}😀`)).toBe(true);

    const html = staffOrderHtml({
      id: 5, status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash', totalAmount: 1000, createdAt: at,
      customerName: 'Vali', contactPhone: null, companyInn: null, deliveryMethod: 'courier', shippingAddress: 'Chilonzor', comment: `${'c'.repeat(299)}😀 rahmat`,
      items: [{ quantity: 1, product: { name: `${'Q'.repeat(79)}😀x` } }], corporateInvoices: [],
    } as never);
    expect(html.isWellFormed()).toBe(true);
    expect(html).toContain(`• ${'Q'.repeat(79)} × 1`);
    expect(html.endsWith(`💬 ${'c'.repeat(299)}`)).toBe(true);

    const debts = V.debtsHtml([{ invoiceNo: 'INV-1', remaining: 1000, dueDate: at, customer: `${'K'.repeat(39)}😀 MChJ` }], 1, 1000, at);
    expect(debts.isWellFormed()).toBe(true);
    expect(debts.endsWith(` · ${'K'.repeat(39)}`)).toBe(true);
  });
});

describe('boshqaruv boti: qidiruv matni', () => {
  it('1–7 xonali son — buyurtma raqami', () => {
    expect(V.classifyFind('5')).toEqual({ kind: 'order', id: 5 });
    expect(V.classifyFind(' 1234567 ')).toEqual({ kind: 'order', id: 1234567 });
    expect(V.classifyFind('#42')).toEqual({ kind: 'order', id: 42 });
    expect(V.classifyFind('№ 42')).toEqual({ kind: 'order', id: 42 });
    expect(V.classifyFind('0007')).toEqual({ kind: 'order', id: 7 });
  });

  it('telefon — normalizePhone qabul qilgan yozuv', () => {
    const phone = { kind: 'phone', phone: '998901234567' };
    expect(V.classifyFind('901234567')).toEqual(phone);
    expect(V.classifyFind('90 123 45 67')).toEqual(phone);
    expect(V.classifyFind('+998 (90) 123-45-67')).toEqual(phone);
    expect(V.classifyFind('998901234567')).toEqual(phone);
  });

  it('qolgan hammasi — tushunarsiz', () => {
    for (const junk of ['', '0', '000', 'salom', '12345678', '1234567890', '+7 900 123 45 67', '12a', '-5', '1.5', 'buyurtma 5', 'Ali 90 123 45 67 ga qo\'ng\'iroq', '/order', '<b>5</b>']) {
      expect(V.classifyFind(junk)).toEqual({ kind: 'none' });
    }
  });

  it('buyruq argumenti va ulash kodi', () => {
    expect(V.commandArg('/find 90 123 45 67')).toBe('90 123 45 67');
    expect(V.commandArg('/start@pack24AUP_bot 123456')).toBe('123456');
    expect(V.commandArg('/order')).toBe('');
    expect(V.isLinkCode('123456')).toBe(true);
    for (const bad of ['12345', '1234567', '12345a', '123 456', '', '+12345']) expect(V.isLinkCode(bad)).toBe(false);
  });
});

describe('boshqaruv boti: kodni terib topishdan himoya', () => {
  const T0 = 1_800_000_000_000;
  const MIN = 60_000;

  it('5 ta xatogacha qulf yo\'q, 5-xatodan keyin 30 daqiqa qulf', () => {
    let s: ReturnType<typeof V.codeFailed> | null = null;
    for (let i = 1; i <= V.CODE_MAX_FAILS; i += 1) {
      expect(V.codeLockLeft(s, T0 + i)).toBe(0);
      s = V.codeFailed(s, T0 + i);
      expect(s.codeFails).toBe(i);
    }
    expect(V.codeLockLeft(s, T0 + 5)).toBe(V.CODE_LOCK_MS);
    expect(V.codeLockLeft(s, T0 + 5 + 10 * MIN)).toBe(20 * MIN);
    expect(V.codeLockLeft(s, T0 + 5 + 30 * MIN - 1)).toBe(1);
    expect(V.codeLockLeft(s, T0 + 5 + 30 * MIN)).toBe(0);
  });

  it('qulf tugagach hisob noldan boshlanadi; 30 daqiqadan eski xatolar ham unutiladi', () => {
    const locked = { codeFails: 5, codeFailAt: T0 };
    expect(V.codeFailed(locked, T0 + 30 * MIN)).toEqual({ codeFails: 1, codeFailAt: T0 + 30 * MIN });
    expect(V.codeFailed({ codeFails: 3, codeFailAt: T0 }, T0 + 29 * MIN)).toEqual({ codeFails: 4, codeFailAt: T0 + 29 * MIN });
    expect(V.codeFailed({ codeFails: 3, codeFailAt: T0 }, T0 + 31 * MIN)).toEqual({ codeFails: 1, codeFailAt: T0 + 31 * MIN });
  });

  it('bo\'sh yoki buzilgan sessiya — qulf yo\'q, soat orqaga surilsa qulf 30 daqiqadan oshmaydi', () => {
    expect(V.codeLockLeft(null, T0)).toBe(0);
    expect(V.codeLockLeft({}, T0)).toBe(0);
    expect(V.codeLockLeft({ codeFails: 'x' as never, codeFailAt: T0 }, T0)).toBe(0);
    expect(V.codeLockLeft({ codeFails: 9, codeFailAt: T0 + 999 * MIN }, T0)).toBe(V.CODE_LOCK_MS);
    expect(V.codeFailed(undefined, T0)).toEqual({ codeFails: 1, codeFailAt: T0 });
    expect(V.codeLockedHtml(61_000)).toContain('2 daqiqadan');
    expect(V.codeLockedHtml(1)).toContain('1 daqiqadan');
  });
});

describe('boshqaruv boti: ro\'yxat va callback_data', () => {
  it('ro\'yxat tugmalari: #id lar 5 tadan, sahifalash, o\'rtadagi tugma shu sahifani yangilaydi', () => {
    const ids = Array.from({ length: 10 }, (_, i) => 100 - i);
    const rows = V.listKeyboard({ key: 'new' }, ids, 1, 3);
    expect(rows.slice(0, 2).map((r) => r.map((b) => b.callback_data))).toEqual([ids.slice(0, 5).map((id) => `or_${id}`), ids.slice(5).map((id) => `or_${id}`)]);
    expect(rows[2].map((b) => b.callback_data)).toEqual(['sl_new_0', 'sb_new_1', 'sl_new_2']);
    expect(V.listKeyboard({ key: 'active' }, [1], 0, 1).at(-1)!.map((b) => b.callback_data)).toEqual(['sb_active_0']);
    expect(V.listKeyboard({ key: 'new' }, ids, 0, 3).at(-1)!.map((b) => b.callback_data)).toEqual(['sb_new_0', 'sl_new_1']);
    expect(V.listKeyboard({ key: 'new' }, ids, 2, 3).at(-1)!.map((b) => b.callback_data)).toEqual(['sl_new_1', 'sb_new_2']);
  });

  it('ro\'yxat callback\'i qayta o\'qiladi; begona yozuv rad etiladi', () => {
    expect(V.parseListData('sl_new_2')).toEqual({ kind: { key: 'new' }, page: 2 });
    expect(V.parseListData('sb_active_0')).toEqual({ kind: { key: 'active' }, page: 0 });
    expect(V.parseListData('sb_p998901234567_1')).toEqual({ kind: { key: 'phone', phone: '998901234567' }, page: 1 });
    for (const bad of ['sl_done_0', 'sl_new_', 'sl_new_-1', 'sl_new_99999', 'sl_p90123_0', 'sx_new_0', 'sl_new_0_x']) expect(V.parseListData(bad)).toBeNull();
    for (const kind of [{ key: 'new' }, { key: 'active' }, { key: 'phone', phone: '998901234567' }] as const) {
      for (const d of datas(V.listKeyboard(kind, [1], 3, 9)).filter((x) => !x.startsWith('or_'))) expect(V.parseListData(d)!.kind).toEqual(kind);
    }
    expect(V.listPageSize({ key: 'new' })).toBe(10);
    expect(V.listPageSize({ key: 'phone', phone: '998901234567' })).toBe(5);
  });

  it('ro\'yxatdan ochilgan kartada qaytish tugmasi; xabarnoma kartasida yo\'q', () => {
    const list = V.listKeyboard({ key: 'active' }, [7, 8], 2, 4);
    expect(V.backRow(list)).toEqual([[{ text: "⬅️ Ro'yxatga qaytish", callback_data: 'sb_active_2' }]]);
    // Kartaning o'zidan (qaytish tugmasi bilan) keyingi tahrirda ham saqlanadi
    expect(V.backRow([...cancelConfirmKeyboard(7), ...V.backRow(list)])).toEqual(V.backRow(list));
    expect(V.backRow(staffOrderKeyboard({ id: 7, status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash' }, true))).toEqual([]);
    expect(V.backRow(undefined)).toEqual([]);
    expect(V.backRow([[{ text: 'x', callback_data: 'sb_hack_0' }]])).toEqual([]);
  });

  it('ro\'yxat matni: jami soni sarlavhada, bo\'sh ro\'yxat alohida', () => {
    const html = V.listHtml({ key: 'new' }, ['a', 'b'], 23, 1, 3);
    expect(html.split('\n')[0]).toBe('🆕 <b>Yangi buyurtmalar</b>: <b>23 ta</b> · 2/3-sahifa');
    expect(V.listHtml({ key: 'active' }, ['a'], 1, 0, 1).split('\n')[0]).toBe('⚙️ <b>Jarayondagi buyurtmalar</b>: <b>1 ta</b>');
    expect(V.listHtml({ key: 'new' }, [], 0, 0, 1)).toContain("yo'q");
    expect(V.listHtml({ key: 'phone', phone: '998901234567' }, [], 0, 0, 1)).toContain('+998 90 123 45 67');
  });

  it('barcha callback_data 64 baytdan oshmaydi', () => {
    const MAX = 2147483646;
    const all: string[] = [...datas(cancelConfirmKeyboard(MAX)), ...datas(V.stopKeyboard())];
    for (const status of STATUSES) for (const p of PAYMENTS) all.push(...datas(staffOrderKeyboard({ id: MAX, status, paymentStatus: p, paymentMethod: 'cash' }, true)));
    for (const kind of [{ key: 'new' }, { key: 'active' }, { key: 'phone', phone: '998901234567' }] as const) {
      const rows = V.listKeyboard(kind, Array.from({ length: 10 }, (_, i) => MAX - i), 9998, 9999 + 1);
      all.push(...datas(rows), ...datas(V.backRow(rows)));
    }
    expect(all.length).toBeGreaterThan(50);
    for (const d of all) expect(bytes(d)).toBeLessThanOrEqual(64);
    // Reply-tugma matnlari takrorlanmaydi: har biri o'z bo'limini ochadi
    expect(new Set(Object.values(V.BTN)).size).toBe(Object.values(V.BTN).length);
  });
});

describe('boshqaruv boti: bugun va qarzdorlik matni', () => {
  it('moliya ruxsati bo\'lmasa hisob-faktura satri chiqmaydi', () => {
    const base = { day: '2026-10-10', created: 3, createdSum: 4_500_000, open: { new_: 2, processing: 0, shipping: 1 }, unpaid: 4 };
    const plain = V.todayHtml({ ...base, overdue: null });
    expect(plain).toContain('10.10.2026');
    expect(plain).toContain("<b>3 ta</b> · 4 500 000 so'm");
    expect(plain).not.toContain('hisob-faktura');
    expect(V.todayHtml({ ...base, overdue: { count: 2, remaining: 900_000 } })).toContain("<b>2 ta</b> · 900 000 so'm");
  });

  it('qarzdorlik: qoldiq, muddat, necha kun o\'tgani, mijoz nomi qochirilgan', () => {
    const now = new Date('2026-10-10T07:00:00Z');
    const rows = [{ invoiceNo: 'INV-2026-0001', remaining: 1_200_000, dueDate: new Date('2026-09-01T07:00:00Z'), customer: '"Quti & Ko" <MChJ>' }];
    const html = V.debtsHtml(rows, 12, 45_000_000, now);
    expect(html).toContain("Muddati o'tgan hisob-fakturalar: 12 ta");
    expect(html).toContain("45 000 000 so'm");
    expect(html).toContain("<b>INV-2026-0001</b> · 1 200 000 so'm · muddati 01.09.2026 (39 kun) · \"Quti &amp; Ko\" &lt;MChJ&gt;");
    expect(html).toContain('… yana 11 ta');
    expect(V.debtsHtml([], 0, 0, now)).toContain("yo'q");
    expect(V.debtsKeyboard()[0][0].url).toBe('https://pack24.uz/admin/invoices?status=overdue');
  });
});

// ─── Bot: har bir so'rovda tekshiruv ─────────────────────────────────────────

type Call = { method: string; params: Record<string, unknown> };
const calls: Call[] = [];
const of = (method: string) => calls.filter((c) => c.method === method).map((c) => c.params);
const sent = () => of('sendMessage');
const edits = () => of('editMessageText');
const answers = () => of('answerCallbackQuery');
const lastText = () => String(sent().at(-1)?.text ?? '');
const inlineOf = (p: Record<string, unknown> | undefined) => ((p?.reply_markup as { inline_keyboard?: InlineKeyboard } | undefined)?.inline_keyboard ?? []);
const dbCalls = () => [...Object.values(h.prisma.order), ...Object.values(h.prisma.corporateInvoice)].reduce((n, f) => n + f.mock.calls.length, 0);

const ME = 777;
/** Soxta sessiya kalitlari: suhbat sessiyasi va (undan alohida) noto'g'ri kodlar hisobi */
const CHAT = `staff:${ME}`;
const GUARD = `staff_code:${ME}`;
const from = { id: ME, first_name: 'Ali' };
const chat = (type = 'private') => ({ id: type === 'private' ? ME : -100500, type });
const msg = (text: string, type = 'private'): TgUpdate => ({ update_id: 1, message: { message_id: 10, date: 0, chat: chat(type), from, text } });
const contactMsg = (userId: number | undefined, phone: string): TgUpdate => ({ update_id: 1, message: { message_id: 10, date: 0, chat: chat(), from, contact: { phone_number: phone, first_name: 'X', user_id: userId } } });
const cb = (data: string, markup?: InlineKeyboard, type = 'private'): TgUpdate => ({
  update_id: 2,
  callback_query: { id: 'q1', from, data, message: { message_id: 20, date: 0, chat: chat(type), ...(markup ? { reply_markup: { inline_keyboard: markup } } : {}) } },
});

const ali = { id: 1, name: 'Ali <b>', role: 'staff' as const, phone: '998901112233', telegramId: String(ME), telegramNotify: true };
const boss = { ...ali, id: 2, name: 'Rahbar', role: 'manager' as const };
const order = (over: Record<string, unknown> = {}) => ({
  id: 5, status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash', totalAmount: 1250000, createdAt: new Date('2026-10-09T05:00:00Z'),
  customerName: 'Vali', contactPhone: '998901234567', companyInn: null, deliveryMethod: 'pickup', shippingAddress: null, comment: null,
  items: [{ quantity: 2, product: { name: 'Quti' } }], corporateInvoices: [], ...over,
});
const ACTOR = { name: ali.name, via: 'staff_bot' };
const ALL_CALLBACKS = ['os_5_processing', 'oc_5', 'ocy_5', 'or_5', 'op_5', 'opy_5', 'sl_new_0', 'sb_active_1', 'sx_y', 'sx_n'];

beforeEach(() => {
  vi.stubEnv('STAFF_BOT_TOKEN', '1:test');
  vi.stubEnv('APP_URL', 'https://pack24.uz');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ method: String(url).split('/').pop()!, params: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T20:30:00Z')); // Toshkentda 10-oktabr 01:30
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  calls.length = 0;
  h.sessions.clear();
});

describe('boshqaruv boti: ulanmagan odam', () => {
  beforeEach(() => {
    h.staffByTelegram.mockResolvedValue(null);
  });

  it('har qanday buyruq, menyu matni yoki raqamga faqat "qanday ulanish" javobi — baza umuman so\'ralmaydi', async () => {
    const inputs = ['/start', '/new', '/active', '/find 5', '/order 5', '/today', '/debts', '/help', '/stop', V.BTN.newOrders, V.BTN.debts, V.BTN.notify, '5', 'salom'];
    for (const text of inputs) await bot.handle(msg(text));
    expect(h.staffByTelegram).toHaveBeenCalledTimes(inputs.length);
    expect(sent()).toHaveLength(inputs.length);
    for (const m of sent()) {
      expect(m.text).toBe(V.guestHtml());
      expect(m.reply_markup).toEqual(V.guestKeyboard());
    }
    expect(dbCalls()).toBe(0);
    expect(h.linkStaffByCode).not.toHaveBeenCalled();
    expect(h.setStaffNotify).not.toHaveBeenCalled();
    expect(h.unlinkStaff).not.toHaveBeenCalled();
  });

  it('eski xabardagi tugmalar ishlamaydi: "Avval botga ulaning", hech narsa o\'zgarmaydi', async () => {
    for (const data of ALL_CALLBACKS) await bot.handle(cb(data));
    expect(answers().filter((a) => a.text).map((a) => [a.text, a.show_alert])).toEqual(ALL_CALLBACKS.map(() => ['Avval botga ulaning: /start', true]));
    expect(edits()).toHaveLength(0);
    expect(sent()).toHaveLength(0);
    expect(dbCalls()).toBe(0);
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(h.unlinkStaff).not.toHaveBeenCalled();
  });

  it('yozib yuborilgan telefon raqami ulamaydi; begona kontakt ham', async () => {
    await bot.handle(msg('+998 90 111 22 33'));
    await bot.handle(msg('901112233'));
    await bot.handle(contactMsg(999, '+998901112233'));
    await bot.handle(contactMsg(undefined, '+998901112233'));
    expect(h.linkStaffByPhone).not.toHaveBeenCalled();
    expect(h.linkStaffByCode).not.toHaveBeenCalled();
    expect(sent().slice(2).map((m) => m.text)).toEqual([V.OWN_CONTACT_ONLY, V.OWN_CONTACT_ONLY]);
  });

  it('o\'z kontakti: ro\'yxatda bo\'lsa ulanadi (ism, rol, menyu), bo\'lmasa tushuntirish', async () => {
    h.linkStaffByPhone.mockResolvedValueOnce({ ok: false, reason: 'not_found' });
    await bot.handle(contactMsg(ME, '+998901112233'));
    expect(h.linkStaffByPhone).toHaveBeenLastCalledWith(ME, '+998901112233');
    expect(lastText()).toContain("+998 90 111 22 33</b> raqami Xodimlar ro'yxatida topilmadi");
    expect(lastText()).toContain('Telegram kodi');
    expect(sent().at(-1)!.reply_markup).toEqual(V.guestKeyboard());
    // Jami 9 raqamli (xorijiy) kontakt oldiga 998 qo'shilmaydi: bot uni tekshirilmagan O'zbekiston raqami qilib ko'rsatmaydi
    expect(V.notInStaffListHtml('+508 41 12 34')).toContain('<b>+508 41 12 34</b> raqami');
    expect(V.notInStaffListHtml('508411234')).not.toContain('+998');
    expect(V.notInStaffListHtml('<b>1')).toContain('<b>&lt;b&gt;1</b> raqami');

    h.linkStaffByPhone.mockResolvedValueOnce({ ok: true, user: boss });
    await bot.handle(contactMsg(ME, '+998901112233'));
    expect(lastText()).toContain('<b>Rahbar</b>');
    expect(lastText()).toContain('Rol: <b>Menejer</b>');
    expect(sent().at(-1)!.reply_markup).toEqual(V.menuKeyboard('manager'));
  });

  it('kod: matn yoki /start <kod>; to\'g\'ri kod ulaydi va xatolar hisobini tozalaydi', async () => {
    h.linkStaffByCode.mockResolvedValue({ ok: false, reason: 'code' });
    await bot.handle(msg('000000'));
    expect(h.linkStaffByCode).toHaveBeenLastCalledWith(ME, '000000');
    expect(lastText()).toContain('Yana <b>4</b> ta urinish');
    await bot.handle(msg('/start 111111'));
    expect(h.linkStaffByCode).toHaveBeenLastCalledWith(ME, '111111');
    expect(h.sessions.get(GUARD)).toMatchObject({ codeFails: 2 });
    // /start xatolar hisobini tozalamaydi
    await bot.handle(msg('/start'));
    expect(h.sessions.get(GUARD)).toMatchObject({ codeFails: 2 });

    h.linkStaffByCode.mockResolvedValue({ ok: true, user: ali });
    await bot.handle(msg('123456'));
    expect(lastText()).toContain('Ali &lt;b&gt;');
    expect(lastText()).toContain('Rol: <b>Xodim</b>');
    expect(sent().at(-1)!.reply_markup).toEqual(V.menuKeyboard('staff'));
    // Hisob faqat shu yerda — to'g'ri kod bilan ulanganda tozalanadi
    expect(h.sessions.size).toBe(0);
  });

  it('5 ta noto\'g\'ri koddan keyin 30 daqiqa: kod bazadan qidirilmaydi, kontakt orqali ulanish ishlaydi', async () => {
    h.linkStaffByCode.mockResolvedValue({ ok: false, reason: 'code' });
    for (let i = 0; i < 5; i += 1) await bot.handle(msg(`00000${i}`));
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(5);
    expect(lastText()).toContain("to'xtatildi");
    expect(lastText()).toContain('30 daqiqadan');

    vi.setSystemTime(Date.now() + 10 * 60_000);
    await bot.handle(msg('123456'));
    await bot.handle(msg('/start 123456'));
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(5);
    expect(lastText()).toContain('20 daqiqadan');

    vi.setSystemTime(Date.now() + 21 * 60_000);
    await bot.handle(msg('123456'));
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(6);
    expect(lastText()).toContain('Yana <b>4</b> ta urinish');

    for (let i = 0; i < 4; i += 1) await bot.handle(msg('999999'));
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(10);
    await bot.handle(msg('999999'));
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(10);
    h.linkStaffByPhone.mockResolvedValue({ ok: true, user: ali });
    await bot.handle(contactMsg(ME, '998901112233'));
    expect(sent().at(-1)!.reply_markup).toEqual(V.menuKeyboard('staff'));
    // Telefon bilan ulanish kod qulfini yechmaydi (o'z raqami bilan kirib, hisobni nolga tushirib bo'lmasin)
    expect(h.sessions.has(CHAT)).toBe(false);
    expect(h.sessions.get(GUARD)).toMatchObject({ codeFails: 5 });
  });

  it("kod hisobi suhbat sessiyasidan alohida: telefon bilan ulanish, menyu, qidiruv va /stop uni nolga tushirmaydi", async () => {
    h.linkStaffByCode.mockResolvedValue({ ok: false, reason: 'code' });
    h.linkStaffByPhone.mockResolvedValue({ ok: true, user: ali });
    // Xodim: 5 ta kod -> o'z telefoni bilan ulanish -> sessiyani tozalaydigan hamma yo'llar -> /stop -> yana kod ...
    for (let round = 0; round < 3; round += 1) {
      h.staffByTelegram.mockResolvedValue(null);
      for (let i = 0; i < 5; i += 1) await bot.handle(msg(`${round}0000${i}`));
      await bot.handle(contactMsg(ME, '+998901112233'));
      expect(lastText()).toContain('Bot ulandi!');
      h.staffByTelegram.mockResolvedValue(ali);
      for (const text of ['/start', '/help', V.BTN.find, '5', '/find 77', V.BTN.notify, '/stop']) await bot.handle(msg(text));
      await bot.handle(cb('sx_y'));
      expect(h.sessions.has(CHAT)).toBe(false);
    }
    // Faqat birinchi 5 ta kod bazadan tekshirilgan; qolgan 10 tasi qulfga urilgan
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(5);
    expect(h.sessions.get(GUARD)).toMatchObject({ codeFails: 5 });
    h.staffByTelegram.mockResolvedValue(null);
    await bot.handle(msg('123456'));
    expect(lastText()).toContain("to'xtatildi");
    expect(h.linkStaffByCode).toHaveBeenCalledTimes(5);
  });
});

describe('boshqaruv boti: xodim', () => {
  beforeEach(() => {
    h.staffByTelegram.mockResolvedValue(ali);
  });

  it('guruh chatida jim: buyurtma ma\'lumoti shaxsiy chatdan tashqariga chiqmaydi', async () => {
    await bot.handle(msg('/new', 'group'));
    await bot.handle(msg('5', 'supergroup'));
    await bot.handle(cb('or_5', undefined, 'group'));
    expect(sent()).toHaveLength(0);
    expect(edits()).toHaveLength(0);
    expect(dbCalls()).toBe(0);
    expect(h.staffByTelegram).not.toHaveBeenCalled();
  });

  it('/start: ism, rol va ruxsatga mos menyu', async () => {
    await bot.handle(msg('/start 123456'));
    expect(h.linkStaffByCode).not.toHaveBeenCalled();
    expect(lastText()).toContain('Ali &lt;b&gt;');
    expect(lastText()).toContain('Rol: <b>Xodim</b>');
    expect(sent().at(-1)!.reply_markup).toEqual(V.menuKeyboard('staff'));
  });

  it('Telegram "/" menyusidagi (botMeta) har bir buyruqni bot ushlaydi: umumiy ko\'rsatma emas, o\'z javobi keladi', async () => {
    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.order.count.mockResolvedValue(0);
    h.prisma.order.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { totalAmount: null } });
    h.prisma.order.groupBy.mockResolvedValue([]);
    h.prisma.corporateInvoice.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { totalAmount: null, paidAmount: null } });
    expect(botMeta.staff.commands.length).toBeGreaterThan(0);
    for (const { command } of botMeta.staff.commands) {
      calls.length = 0;
      await bot.handle(msg(`/${command}`));
      expect(sent(), command).toHaveLength(1);
      expect(lastText(), command).not.toBe(V.menuHint('manager'));
    }
    // Solishtirish uchun: bot bilmaydigan buyruq umumiy ko'rsatmaga tushadi
    await bot.handle(msg('/bogus'));
    expect(lastText()).toBe(V.menuHint('manager'));
  });

  it('moliya ruxsati yo\'q xodimga qarzdorlik ochilmaydi (tugma ham, buyruq ham)', async () => {
    await bot.handle(msg(V.BTN.debts));
    await bot.handle(msg('/debts'));
    expect(sent().map((m) => m.text)).toEqual(["⛔ Bu bo'limga ruxsatingiz yo'q.", "⛔ Bu bo'limga ruxsatingiz yo'q."]);
    expect(sent()[0].reply_markup).toEqual(V.menuKeyboard('staff'));
    expect(dbCalls()).toBe(0);
  });

  it('roli olingan xodim: tugmalar "Ruxsat yo\'q", matnlar rad etiladi', async () => {
    h.staffByTelegram.mockResolvedValue({ ...ali, role: 'user' });
    for (const data of ALL_CALLBACKS.filter((d) => !d.startsWith('sx_'))) await bot.handle(cb(data));
    expect(answers().filter((a) => a.text).map((a) => a.text)).toEqual(Array(8).fill("Ruxsat yo'q"));
    for (const text of ['/new', '/order 5', '/today', V.BTN.find, '5', '90 123 45 67']) await bot.handle(msg(text));
    expect(edits()).toHaveLength(0);
    expect(dbCalls()).toBe(0);
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it('yangi buyurtmalar: jami soni, 10 tadan, yangilari tepada, sahifalash', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: 100 - i, status: 'new_', totalAmount: 1000, createdAt: new Date('2026-10-09T05:00:00Z'), customerName: `M${i}` }));
    h.prisma.order.count.mockResolvedValue(23);
    h.prisma.order.findMany.mockResolvedValue(items);
    await bot.handle(msg(V.BTN.newOrders));
    expect(h.prisma.order.count).toHaveBeenLastCalledWith({ where: { deletedAt: null, status: 'new_' } });
    expect(h.prisma.order.findMany.mock.lastCall![0]).toMatchObject({ where: { deletedAt: null, status: 'new_' }, orderBy: { id: 'desc' }, skip: 0, take: 10 });
    expect(lastText().split('\n')[0]).toBe('🆕 <b>Yangi buyurtmalar</b>: <b>23 ta</b> · 1/3-sahifa');
    expect(lastText()).toContain('<b>#100</b>');
    const rows = inlineOf(sent().at(-1));
    expect(rows.map((r) => r.length)).toEqual([5, 5, 2]);
    expect(datas(rows).slice(-2)).toEqual(['sb_new_0', 'sl_new_1']);

    await bot.handle(cb('sl_new_99', rows));
    expect(h.prisma.order.findMany.mock.lastCall![0]).toMatchObject({ skip: 20, take: 10 });
    expect(edits().at(-1)!.message_id).toBe(20);
    expect(datas(inlineOf(edits().at(-1))).slice(-2)).toEqual(['sl_new_1', 'sb_new_2']);

    await bot.handle(msg('/active'));
    expect(h.prisma.order.count).toHaveBeenLastCalledWith({ where: { deletedAt: null, status: { in: ['processing', 'shipping'] } } });
  });

  it('karta: ro\'yxatdan ochilsa xabar o\'rnida, qaytish tugmasi bilan', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order());
    const list = V.listKeyboard({ key: 'new' }, [5, 4], 1, 3);
    await bot.handle(cb('or_5', list));
    expect(h.prisma.order.findFirst.mock.lastCall![0]).toMatchObject({ where: { id: 5, deletedAt: null } });
    const e = edits().at(-1)!;
    expect(e.message_id).toBe(20);
    expect(String(e.text)).toContain('<b>Buyurtma #5</b>');
    expect(datas(inlineOf(e))).toEqual(['os_5_processing', 'op_5', 'oc_5', 'or_5', 'sb_new_1']);
    expect(sent()).toHaveLength(0);
  });

  it('«🔄 Yangilash»: hech narsa o\'zgarmagan bo\'lsa ham qisqa javob keladi; boshqa tugmalarda — yo\'q', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order());
    h.prisma.order.count.mockResolvedValue(12);
    h.prisma.order.findMany.mockResolvedValue([{ id: 5, status: 'new_', totalAmount: 1000, createdAt: new Date('2026-10-09T05:00:00Z'), customerName: 'Vali' }]);
    const card = staffOrderKeyboard(order() as never, true);
    const list = V.listKeyboard({ key: 'new' }, [5], 1, 2);
    const fromList = [...card, ...V.backRow(list)];
    /** Tugma bosiladi; Telegram'ga ketgan yagona callback javobi qaytadi */
    const pressed = async (data: string, markup: InlineKeyboard) => {
      calls.length = 0;
      await bot.handle(cb(data, markup));
      expect(answers(), data).toHaveLength(1);
      return answers()[0];
    };
    // Kartaning o'z tugmasi (xabarnomadagi va ro'yxatdan ochilgan karta) va ro'yxatning o'rtadagi tugmasi (ko'p va bir sahifali)
    const refresh: [string, InlineKeyboard][] = [['or_5', card], ['or_5', fromList], ['sb_new_1', list], ['sb_active_0', V.listKeyboard({ key: 'active' }, [5], 0, 1)]];
    for (const [data, markup] of refresh) {
      expect(await pressed(data, markup), data).toMatchObject({ text: 'Yangilandi ✅', show_alert: false });
      expect(edits(), data).toHaveLength(1);
    }
    // Xuddi shu callback'ni yuboradigan boshqa tugmalar: "#5" (kartani ochish), "Yo'q", "Ro'yxatga qaytish", sahifalash
    const other: [string, InlineKeyboard][] = [['or_5', list], ['or_5', cancelConfirmKeyboard(5)], ['sb_new_1', fromList], ['sl_new_0', list]];
    for (const [data, markup] of other) {
      expect((await pressed(data, markup)).text, data).toBeUndefined();
      expect(edits(), data).toHaveLength(1);
    }
    // O'chirilgan buyurtma: faqat "topilmadi" oynasi (callback'ga bitta javob beriladi)
    h.prisma.order.findFirst.mockResolvedValue(null);
    expect(await pressed('or_5', card)).toMatchObject({ text: 'Buyurtma topilmadi', show_alert: true });
  });

  it('os_: holat faqat tabiiy yo\'l bo\'yicha, kartada kim o\'zgartirgani', async () => {
    h.changeOrderStatus.mockResolvedValue({ ok: true, changed: true, order: {} });
    h.prisma.order.findFirst.mockResolvedValue(order({ status: 'processing' }));
    await bot.handle(cb('os_5_processing'));
    expect(h.changeOrderStatus).toHaveBeenCalledWith(5, 'processing', ACTOR, { enforceFlow: true });
    const e = edits().at(-1)!;
    expect(String(e.text).split('\n')[0]).toBe('✅ <b>Holat: Tayyorlanmoqda</b> — Ali &lt;b&gt;');
    expect(datas(inlineOf(e))).toEqual(['os_5_shipping', 'op_5', 'oc_5', 'or_5']);
    expect(answers().every((a) => !a.text)).toBe(true);
  });

  it('os_: holat allaqachon o\'zgargan bo\'lsa ogohlantirish va karta yangilanadi', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order({ status: 'shipping' }));
    for (const res of [{ ok: true, changed: false, order: {} }, { ok: false, reason: 'conflict' }, { ok: false, reason: 'flow' }]) {
      calls.length = 0;
      h.changeOrderStatus.mockResolvedValue(res);
      await bot.handle(cb('os_5_processing'));
      expect(answers()[0]).toMatchObject({ text: "Holat allaqachon o'zgargan", show_alert: true });
      expect(String(edits().at(-1)!.text).split('\n')[0]).toContain('<b>Buyurtma #5</b>');
      expect(datas(inlineOf(edits().at(-1)))).toContain('os_5_delivered');
    }
    calls.length = 0;
    h.changeOrderStatus.mockResolvedValue({ ok: false, reason: 'not_found' });
    h.prisma.order.findFirst.mockResolvedValue(null);
    await bot.handle(cb('os_5_processing'));
    expect(answers()[0]).toMatchObject({ text: 'Buyurtma topilmadi', show_alert: true });
    expect(inlineOf(edits().at(-1))).toEqual([]);
  });

  it('bekor qilish: avval tasdiq (oc_ va qo\'lda yasalgan os_.._cancelled), keyin ocy_; "Yo\'q" kartani qaytaradi', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order());
    for (const data of ['oc_5', 'os_5_cancelled']) {
      calls.length = 0;
      await bot.handle(cb(data));
      expect(h.changeOrderStatus).not.toHaveBeenCalled();
      expect(String(edits().at(-1)!.text)).toContain('Buyurtma #5 bekor qilinsinmi?');
      expect(datas(inlineOf(edits().at(-1)))).toEqual(['ocy_5', 'or_5']);
    }
    await bot.handle(cb('or_5', cancelConfirmKeyboard(5)));
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
    expect(datas(inlineOf(edits().at(-1)))).toContain('oc_5');

    h.changeOrderStatus.mockResolvedValue({ ok: true, changed: true, order: {} });
    h.prisma.order.findFirst.mockResolvedValue(order({ status: 'cancelled' }));
    await bot.handle(cb('ocy_5', cancelConfirmKeyboard(5)));
    expect(h.changeOrderStatus).toHaveBeenCalledWith(5, 'cancelled', ACTOR, { enforceFlow: true });
    expect(String(edits().at(-1)!.text).split('\n')[0]).toBe('❌ <b>Holat: Bekor qilingan</b> — Ali &lt;b&gt;');
    expect(datas(inlineOf(edits().at(-1)))).toEqual(['or_5']);

    // Yetkazilgan buyurtmada eski "Bekor qilish" tugmasi: tasdiq so'ralmaydi
    calls.length = 0;
    h.prisma.order.findFirst.mockResolvedValue(order({ status: 'delivered' }));
    await bot.handle(cb('oc_5'));
    expect(answers()[0]).toMatchObject({ text: "Holat allaqachon o'zgargan", show_alert: true });
    expect(datas(inlineOf(edits().at(-1)))).not.toContain('ocy_5');
  });

  it('op_: avval tasdiq so\'raydi (hisob-faktura yopilishi aytiladi) va hech narsa yozmaydi', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order({ corporateInvoices: [{ invoiceNo: 'INV-2026-0007' }] }));
    await bot.handle(cb('op_5'));
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(String(edits().at(-1)!.text)).toContain("hisob-faktura INV-2026-0007 to'langan deb yopiladi");
    expect(datas(inlineOf(edits().at(-1)))).toEqual(['opy_5', 'or_5']);

    // Eski xabardagi tugma: onlayn usul yoki bekor qilingan buyurtmada tasdiq ham so'ralmaydi
    for (const over of [{ paymentMethod: 'payme' }, { status: 'cancelled' }, { paymentStatus: 'paid' }]) {
      calls.length = 0;
      h.prisma.order.findFirst.mockResolvedValue(order(over));
      await bot.handle(cb('op_5'));
      expect(answers()[0].show_alert).toBe(true);
      expect(datas(inlineOf(edits().at(-1)))).not.toContain('opy_5');
    }
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it('opy_: qo\'lda to\'lov belgilanadi; onlayn usul va bekor qilingan buyurtmada — yo\'q', async () => {
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid' }));
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {} });
    h.prisma.order.findFirst.mockResolvedValueOnce(order());
    await bot.handle(cb('opy_5'));
    expect(h.setManualPayment).toHaveBeenCalledWith(5, 'paid', ACTOR);
    expect(String(edits().at(-1)!.text).split('\n')[0]).toBe("💵 <b>To'lov belgilandi</b> — Ali &lt;b&gt;");
    expect(datas(inlineOf(edits().at(-1)))).not.toContain('op_5');

    calls.length = 0;
    h.setManualPayment.mockClear();
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentMethod: 'payme' }));
    await bot.handle(cb('opy_5'));
    expect(String(answers()[0].text)).toContain('Payme / Click');
    expect(answers()[0].show_alert).toBe(true);
    expect(h.setManualPayment).not.toHaveBeenCalled();

    calls.length = 0;
    h.prisma.order.findFirst.mockResolvedValue(order({ status: 'cancelled' }));
    await bot.handle(cb('opy_5'));
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(answers()[0]).toMatchObject({ text: 'Buyurtma bekor qilingan', show_alert: true });
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'refunded' }));
    await bot.handle(cb('opy_5'));
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it('qidiruv: tugma bosqich qo\'yadi; raqam — karta, telefon — oxirgi 5 ta, boshqasi — ko\'rsatma', async () => {
    await bot.handle(msg(V.BTN.find));
    expect(h.sessions.get(CHAT)).toEqual({ step: 'find' });
    expect(lastText()).toBe(V.FIND_PROMPT);
    await bot.handle(msg('salom'));
    expect(lastText()).toBe(V.FIND_HINT);
    expect(h.sessions.get(CHAT)).toEqual({ step: 'find' });

    h.prisma.order.findFirst.mockResolvedValue(order());
    await bot.handle(msg('5'));
    expect(lastText()).toContain('<b>Buyurtma #5</b>');
    expect(datas(inlineOf(sent().at(-1)))).toEqual(['os_5_processing', 'op_5', 'oc_5', 'or_5']);
    expect(h.sessions.has(CHAT)).toBe(false);
    await bot.handle(msg('salom'));
    expect(lastText()).toBe(V.menuHint('staff'));

    h.prisma.order.count.mockResolvedValue(7);
    h.prisma.order.findMany.mockResolvedValue([{ id: 9, status: 'delivered', totalAmount: 1000, createdAt: new Date('2026-10-01T05:00:00Z'), customerName: 'Vali' }]);
    await bot.handle(msg('/find +998 90 123 45 67'));
    expect(h.prisma.order.findMany.mock.lastCall![0]).toMatchObject({ where: { deletedAt: null, contactPhone: '998901234567' }, orderBy: { id: 'desc' }, skip: 0, take: 5 });
    expect(lastText()).toContain('+998 90 123 45 67</b> — buyurtmalar: <b>7 ta</b> · 1/2-sahifa');
    expect(datas(inlineOf(sent().at(-1)))).toEqual(['or_9', 'sb_p998901234567_0', 'sl_p998901234567_1']);
    // Ulangan xodim yuborgan kontakt (mijozning kartasi) — qidiruv, ulash emas
    h.prisma.order.count.mockClear();
    await bot.handle(contactMsg(999, '+998 90 123 45 67'));
    expect(h.linkStaffByPhone).not.toHaveBeenCalled();
    expect(h.prisma.order.count).toHaveBeenLastCalledWith({ where: { deletedAt: null, contactPhone: '998901234567' } });
    // Qidiruvda (ulashdan farqli) telefon kitobidagi 9 xonali mahalliy yozuv ham qabul qilinadi
    h.prisma.order.count.mockClear();
    await bot.handle(contactMsg(undefined, '90 123 45 67'));
    expect(h.prisma.order.count).toHaveBeenLastCalledWith({ where: { deletedAt: null, contactPhone: '998901234567' } });

    h.prisma.order.findFirst.mockResolvedValue(null);
    await bot.handle(msg('/order 77'));
    expect(lastText()).toBe(V.orderGoneHtml(77));
    await bot.handle(msg('/order abc'));
    expect(lastText()).toBe(V.ORDER_HINT);
    await bot.handle(msg('/find ???'));
    expect(lastText()).toBe(V.FIND_HINT);
  });

  it('bugun: Toshkent kuni boshidan; moliya raqamlari faqat ruxsati borga', async () => {
    h.prisma.order.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { totalAmount: 4500000 } });
    h.prisma.order.groupBy.mockResolvedValue([{ status: 'new_', _count: { _all: 2 } }, { status: 'shipping', _count: { _all: 1 } }]);
    h.prisma.order.count.mockResolvedValue(4);
    await bot.handle(msg(V.BTN.today));
    expect(h.prisma.order.aggregate.mock.lastCall![0].where).toEqual({ deletedAt: null, status: { notIn: ['draft', 'cancelled'] }, createdAt: { gte: new Date('2026-10-09T19:00:00Z') } });
    expect(h.prisma.corporateInvoice.aggregate).not.toHaveBeenCalled();
    expect(lastText()).toContain('Bugun, 10.10.2026');
    expect(lastText()).toContain("<b>3 ta</b> · 4 500 000 so'm");
    expect(lastText()).toContain('Yangi: <b>2</b>');
    expect(lastText()).toContain('Tayyorlanmoqda: <b>0</b>');
    expect(lastText()).toContain("Yo'lda: <b>1</b>");
    expect(lastText()).toContain("To'lanmagan buyurtmalar: <b>4 ta</b>");
    expect(lastText()).not.toContain('hisob-faktura');

    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.corporateInvoice.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { totalAmount: 1500000, paidAmount: 600000 } });
    await bot.handle(msg('/today'));
    // Kunlik eslatma bilan bitta shart (overdueInvoiceWhere); muddat kuni to'liq hisobga kiradi — chegara bugungi Toshkent kunining boshi
    expect(h.prisma.corporateInvoice.aggregate.mock.lastCall![0].where).toEqual(overdueInvoiceWhere(new Date('2026-10-09T20:30:00Z')));
    expect(h.prisma.corporateInvoice.aggregate.mock.lastCall![0].where).toMatchObject({ status: { in: ['issued', 'partial', 'overdue'] }, dueDate: { lt: new Date('2026-10-09T19:00:00Z') } });
    expect(lastText()).toContain("hisob-fakturalar: <b>2 ta</b> · 900 000 so'm");
  });

  it('qarzdorlik (menejer): muddati eng ko\'p o\'tgan 10 ta va admin panel havolasi', async () => {
    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.corporateInvoice.findMany.mockResolvedValue([
      { invoiceNo: 'INV-2026-0001', totalAmount: 2000000, paidAmount: 800000, dueDate: new Date('2026-09-01T07:00:00Z'), order: { customerName: 'Vali', companyName: 'Quti <MChJ>' } },
    ]);
    h.prisma.corporateInvoice.aggregate.mockResolvedValue({ _count: { _all: 12 }, _sum: { totalAmount: 50000000, paidAmount: 5000000 } });
    await bot.handle(msg(V.BTN.debts));
    expect(h.prisma.corporateInvoice.findMany.mock.lastCall![0]).toMatchObject({ where: overdueInvoiceWhere(new Date('2026-10-09T20:30:00Z')), orderBy: { dueDate: 'asc' }, take: 10 });
    expect(h.prisma.corporateInvoice.aggregate.mock.lastCall![0].where).toEqual(h.prisma.corporateInvoice.findMany.mock.lastCall![0].where);
    expect(lastText()).toContain("Muddati o'tgan hisob-fakturalar: 12 ta");
    expect(lastText()).toContain("45 000 000 so'm");
    expect(lastText()).toContain("<b>INV-2026-0001</b> · 1 200 000 so'm · muddati 01.09.2026");
    expect(lastText()).toContain('Quti &lt;MChJ&gt;');
    expect(inlineOf(sent().at(-1))[0][0].url).toBe('https://pack24.uz/admin/invoices?status=overdue');
  });

  it('xabarnoma almashtiriladi va yangi holat aytiladi', async () => {
    await bot.handle(msg(V.BTN.notify));
    expect(h.setStaffNotify).toHaveBeenLastCalledWith(1, false);
    expect(lastText()).toBe(V.notifyHtml(false));
    h.staffByTelegram.mockResolvedValue({ ...ali, telegramNotify: false });
    await bot.handle(msg(V.BTN.notify));
    expect(h.setStaffNotify).toHaveBeenLastCalledWith(1, true);
    expect(lastText()).toBe(V.notifyHtml(true));
  });

  it('/stop: faqat "Ha" dan keyin uziladi va menyu olib tashlanadi', async () => {
    await bot.handle(msg('/stop'));
    expect(datas(inlineOf(sent().at(-1)))).toEqual(['sx_y', 'sx_n']);
    await bot.handle(cb('sx_n'));
    expect(h.unlinkStaff).not.toHaveBeenCalled();
    await bot.handle(cb('sx_y'));
    expect(h.unlinkStaff).toHaveBeenCalledWith(1);
    expect(sent().at(-1)!.reply_markup).toEqual({ remove_keyboard: true });
  });

  it('xato: umumiy uzr, xato matni foydalanuvchiga chiqmaydi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.staffByTelegram.mockRejectedValue(new Error('connect ECONNREFUSED postgres://pack24:parol@db'));
    await bot.handle(msg('/new'));
    await bot.handle(cb('or_5'));
    const shown = [lastText(), String(answers()[0].text)];
    for (const t of shown) {
      expect(t).toContain('Xatolik yuz berdi');
      expect(t).not.toContain('postgres');
      expect(t).not.toContain('ECONNREFUSED');
    }
  });
});
