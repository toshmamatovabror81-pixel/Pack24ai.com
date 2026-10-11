import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
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
const { clip, editMessageText, sendMessage } = await import('@/lib/telegram/api');
const { cancelConfirmKeyboard, canMarkPaid, canRevertPaid, payConfirmKeyboard, revertConfirmKeyboard, staffOrderHtml, staffOrderKeyboard, staffOrderLine } = await import('@/lib/telegram/staffCards');
const V = await import('@/lib/telegram/bots/staffViews');
const { bot } = await import('@/lib/telegram/bots/staff');
const { botMeta } = await import('@/lib/telegram/bots');

const STATUSES: OrderStatus[] = ['draft', 'new_', 'processing', 'shipping', 'delivered', 'cancelled'];
const PAYMENTS: PaymentStatus[] = ['pending', 'processing', 'paid', 'failed', 'refunded'];
/** null — usuli yozilmagan eski buyurtma: naqd kabi qo'lda belgilanadi */
const METHODS: (PaymentMethod | null)[] = ['cash', 'bank_transfer', 'payme', 'click', null];
const ROLES = ['admin', 'manager', 'staff', 'user'] as const;
const datas = (rows: InlineKeyboard) => rows.flat().map((b) => b.callback_data).filter((d): d is string => !!d);
/** Tugmalar qatorma-qator (havola tugmasi tashlab ketiladi): qaysi tugma qaysi qatorda turgani ham tekshiriladi */
const grid = (rows: InlineKeyboard) => rows.map((r) => r.map((b) => b.callback_data).filter((d): d is string => !!d));
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');
/** Kartadagi «To'lov belgisini bekor qilish» tugmasining nomi: yordam va tasdiq matnlari aynan shu nomni aytadi */
const UNDO_LABEL = "To'lov belgisini bekor qilish";
/** Yordamdagi shartli va'da: bekor qilish faqat SHU belgi yopgan hisob-fakturani ochadi (hammasini emas) */
const CLOSED_BY_MARK = 'shu belgi yopgan hisob-faktura';
/**
 * Ogohlantirishdagi sabab izohi (qavs ichida): hisob-faktura nega avtomatik ochilmagani. Ikkala ehtimol ham aytiladi — surati
 * saqlanmagan (yangilanishdan oldingi) belgi yopgan yoki hisob-faktura alohida to'langan; qaysi biri ekanini tizim bilmaydi.
 */
const STILL_PAID_REASON = "(avtomatik ochilmadi: yangilanishdan oldingi belgi yoki alohida to'lov)";
/** Avvalgi izoh: surati yo'q eski belgi hisob-fakturani aynan o'zi yopgan bo'ladi — o'sha holatda bu gap noto'g'ri edi, endi chiqmaydi */
const OLD_STILL_PAID_REASON = '(uni bu belgi yopmagan)';
/** Belgi bekor qilingach ham "to'langan" turgan hisob-fakturalar haqidagi ogohlantirish satri (kartadagi yozuvning ikkinchi satri) — so'zma-so'z */
const stillPaidLine = (numbers: string) =>
  `⚠️ Hisob-faktura ${numbers} to'langan holida qoldi ${STILL_PAID_REASON}. Admin panelda hisob-faktura sahifasida tekshiring — kerak bo'lsa u yerda «Qayta ochish» tugmasi bor.`;
/** sendMessage / editMessageText matnni shu uzunlikda kesadi (src/lib/telegram/api.ts dagi clip) — Telegram'ning o'z chegarasi 4096 */
const CLIP_AT = 4000;
const REVERTED = "↩️ <b>To'lov belgisi bekor qilindi</b>";
const REOPENED = ' · hisob-faktura qayta ochildi';

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

  it("yordam matni: to'lovni belgilash va bekor qilish faqat moliya ruxsati borga tushuntiriladi; xodimga — bu moliyaning ishi ekani", () => {
    for (const role of ['manager', 'admin'] as const) {
      const html = V.helpHtml(role);
      expect(html, role).toContain("«To'landi» naqd yoki bank o'tkazmasi to'lovini belgilaydi (hisob-faktura ham yopiladi)");
      // Va'da shartli: faqat SHU belgi yopgan hisob-faktura ochiladi (alohida to'langani yoki eski belgi yopgani o'z holida qoladi)
      expect(html, role).toContain(`Xato bosilgan bo'lsa «${UNDO_LABEL}» uni qaytaradi: ${CLOSED_BY_MARK} qayta ochiladi, mijozga tuzatish xabari boradi.`);
      // Eski, shartsiz va'da ("har qanday hisob-faktura qayta ochiladi") qolmagan
      expect(html, role).not.toContain('uni qaytaradi: hisob-faktura qayta ochiladi');
      expect(html.split(CLOSED_BY_MARK), role).toHaveLength(2);
      expect(html, role).not.toContain('faqat moliya ruxsati bor xodimda');
    }
    const staff = V.helpHtml('staff');
    expect(staff).toContain("To'lovni belgilash («To'landi») faqat moliya ruxsati bor xodimda — menejer yoki administratorda.");
    expect(staff).not.toContain(UNDO_LABEL);
    expect(staff).not.toContain("to'lovini belgilaydi");
    expect(staff).not.toContain(CLOSED_BY_MARK);
    // Buyurtmani bekor qilish xodimda qoladi — yordamda ham turibdi
    expect(staff).toContain("«Bekor qilish» avval tasdiq so'raydi");
    // Buyurtma ruxsati yo'q rolga karta ham, to'lov ham tilga olinmaydi
    const user = V.helpHtml('user');
    for (const word of ["To'landi", UNDO_LABEL, 'moliya', 'Buyurtma kartasi', CLOSED_BY_MARK]) expect(user, word).not.toContain(word);
    // Matn va ruxsat bir manbadan: bekor qilish aynan "finance" ruxsati bor rollarga aytiladi
    for (const role of ROLES) {
      expect(V.helpHtml(role).includes(UNDO_LABEL), role).toBe(can(role, 'finance'));
      expect(V.helpHtml(role).includes(CLOSED_BY_MARK), role).toBe(can(role, 'finance'));
      expect(V.helpHtml(role).includes('faqat moliya ruxsati bor xodimda'), role).toBe(can(role, 'orders') && !can(role, 'finance'));
    }
    // Yordam aytgan tugma nomi kartadagi tugmaning o'zi
    const undo = staffOrderKeyboard({ id: 5, status: 'new_', paymentStatus: 'paid', paymentMethod: 'cash' }, true, true).flat().find((b) => b.callback_data === 'ou_5');
    expect(undo?.text).toBe(`↩️ ${UNDO_LABEL}`);
  });

  it("to'lov matnlari: tasdiq so'rovlari nima bo'lishini oldindan aytadi, hisob-faktura — faqat bo'lsa", () => {
    const pay = V.payAskHtml(5, 'INV-2026-0007');
    expect(pay.split('\n')[0]).toBe("❓ <b>Buyurtma #5 uchun to'lov to'liq qabul qilindimi?</b>");
    expect(pay).toContain("Mijozga «to'lov qabul qilindi» xabari boradi va hisob-faktura INV-2026-0007 to'langan deb yopiladi.");
    // Endi ortga qaytarish yo'li bor: eski "qaytarib bo'lmaydi" ogohlantirishi o'rniga qaysi tugma bilan qaytarilishi aytiladi
    expect(pay).toContain(`Xato bosilsa — kartadagi «${UNDO_LABEL}» tugmasi bilan qaytariladi.`);
    expect(pay).not.toContain("qaytarib bo'lmaydi");
    for (const none of [undefined, null, '']) {
      expect(V.payAskHtml(5, none)).toContain("Mijozga «to'lov qabul qilindi» xabari boradi. Xato bosilsa");
      expect(V.payAskHtml(5, none)).not.toContain('hisob-faktura');
    }

    const revert = V.revertAskHtml(5, 'INV-2026-0007');
    expect(revert.split('\n')[0]).toBe("❓ <b>Buyurtma #5 uchun «to'landi» belgisi bekor qilinsinmi?</b>");
    // Shartli gap: hisob-faktura faqat shu belgi yopgan bo'lsa ochiladi (alohida to'langani o'z holida qoladi)
    expect(revert.split('\n')[1]).toBe("Buyurtma «to'lanmagan»ga qaytadi, hisob-faktura INV-2026-0007 shu belgi bilan yopilgan bo'lsa — avvalgi holiga ochiladi va mijozga tuzatish xabari boradi.");
    for (const none of [undefined, null, '']) {
      expect(V.revertAskHtml(5, none).split('\n')[1]).toBe("Buyurtma «to'lanmagan»ga qaytadi va mijozga tuzatish xabari boradi.");
      expect(V.revertAskHtml(5, none)).not.toContain('hisob-faktura');
    }
    // Hisob-faktura raqami ham matn sifatida chiqadi; ochilgan <b> yopilgan
    for (const html of [V.payAskHtml(5, '<b>&1'), V.revertAskHtml(5, '<b>&1')]) {
      expect(html).toContain('hisob-faktura &lt;b&gt;&amp;1 ');
      expect((html.match(/<b>/g) ?? []).length).toBe((html.match(/<\/b>/g) ?? []).length);
    }
  });

  it("to'lov matnlari: bekor qilinganda kim qilgani va hisob-faktura ochilgani; ruxsatsiz bosishga javob oynaga sig'adi", () => {
    expect(V.revertedNote('Ali')).toBe("↩️ <b>To'lov belgisi bekor qilindi</b> — Ali");
    expect(V.revertedNote('Ali', 0)).toBe(V.revertedNote('Ali'));
    expect(V.revertedNote('Ali', 1)).toBe("↩️ <b>To'lov belgisi bekor qilindi</b> — Ali · hisob-faktura qayta ochildi");
    expect(V.revertedNote('Ali', 3)).toBe(V.revertedNote('Ali', 1));
    expect(V.revertedNote('<i>A</i>&B', 1)).toBe("↩️ <b>To'lov belgisi bekor qilindi</b> — &lt;i&gt;A&lt;/i&gt;&amp;B · hisob-faktura qayta ochildi");
    // Bir xil ko'rinmasin: belgilash va bekor qilish yozuvlari boshqa-boshqa
    expect(V.revertedNote('Ali')).not.toBe(V.paidNote('Ali'));
    expect(V.PAY_FORBIDDEN).toBe("To'lovni faqat moliya ruxsati bor xodim (menejer yoki administrator) belgilaydi");
    // answerCallbackQuery matni 200 belgidan oshsa kesiladi
    expect(V.PAY_FORBIDDEN.length).toBeLessThanOrEqual(200);
  });

  it("revertedNote: ogohlantirish satri faqat «to'langan» holida qolgan hisob-faktura bo'lsa chiqadi", () => {
    // Qolgani yo'q (berilmagan yoki bo'sh ro'yxat): yozuv bir satr, ogohlantirishsiz — qayta ochilgan-ochilmaganidan qat'i nazar
    for (const reopened of [undefined, 0, 1, 3]) {
      for (const plain of [V.revertedNote('Ali', reopened), V.revertedNote('Ali', reopened, []), V.revertedNote('Ali', reopened, undefined)]) {
        expect(plain, String(reopened)).toBe(`${REVERTED} — Ali${reopened ? REOPENED : ''}`);
        expect(plain).not.toContain('\n');
        expect(plain).not.toContain('⚠️');
        expect(plain).not.toContain("to'langan holida qoldi");
      }
    }
    // Hech narsa ochilmadi, lekin hisob-faktura yopiq qoldi (eski belgi yoki alohida to'langan): qaysi biri va qayerda tuzatilishi aytiladi
    expect(V.revertedNote('Ali', 0, ['INV-2026-0007'])).toBe(`${REVERTED} — Ali\n${stillPaidLine('INV-2026-0007')}`);
    expect(V.revertedNote('Ali', undefined, ['INV-2026-0007'])).toBe(V.revertedNote('Ali', 0, ['INV-2026-0007']));
    // Bittasi ochildi, boshqasi qoldi: ikkalasi ham aytiladi — birinchi satrda ochilgani, ikkinchisida qolgani
    const both = V.revertedNote('Ali', 1, ['INV-2026-0008']);
    expect(both.split('\n')).toEqual([`${REVERTED} — Ali${REOPENED}`, stillPaidLine('INV-2026-0008')]);
    expect(both.startsWith(`${V.revertedNote('Ali', 1)}\n⚠️ `)).toBe(true);
    // Nechta ochilgani yozuvni o'zgartirmaydi; ogohlantirish har doim ikkinchi (oxirgi) satr
    expect(V.revertedNote('Ali', 5, ['INV-2026-0008'])).toBe(both);
    for (const reopened of [0, 1]) {
      // Sabab izohi ogohlantirish satrining ichida: yozuv baribir aynan ikki satr
      const lines = V.revertedNote('Ali', reopened, ['INV-1', 'INV-2']).split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(V.revertedNote('Ali', reopened));
      expect(lines[1]).toBe(stillPaidLine('INV-1, INV-2'));
    }
    // «Qayta ochildi» faqat birinchi satrda: yopiq qolgan hisob-faktura "qayta ochildi" deb o'qilmaydi
    expect(V.revertedNote('Ali', 0, ['INV-1'])).not.toContain('qayta ochildi');
    expect(V.revertedNote('Ali', 1, ['INV-1']).split('\n')[1]).not.toContain('qayta ochildi');
  });

  it("revertedNote: ko'pi bilan 3 ta hisob-faktura raqami sanaladi, raqamlar va ism matn sifatida (qochirilgan) chiqadi", () => {
    const five = ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003', 'INV-2026-0004', 'INV-2026-0005'];
    expect(V.revertedNote('Ali', 0, five.slice(0, 2)).split('\n')[1]).toBe(stillPaidLine('INV-2026-0001, INV-2026-0002'));
    expect(V.revertedNote('Ali', 0, five.slice(0, 3)).split('\n')[1]).toBe(stillPaidLine('INV-2026-0001, INV-2026-0002, INV-2026-0003'));
    // To'rtinchisidan boshlab sanalmaydi: yozuv uzunligi hisob-fakturalar soniga qarab o'smaydi (karta bilan birga chegaraga sig'ishi kerak)
    for (const many of [five.slice(0, 4), five, Array.from({ length: 500 }, (_, i) => `INV-2026-${String(i + 1).padStart(4, '0')}`)]) {
      const long = V.revertedNote('Ali', 1, many);
      expect(long, String(many.length)).toBe(V.revertedNote('Ali', 1, five.slice(0, 3)));
      expect(long).not.toContain('INV-2026-0004');
      expect(long).not.toContain('INV-2026-0005');
    }
    // Tartib saqlanadi (bazadan id bo'yicha keladi) va berilgan ro'yxat o'zgartirilmaydi
    const input = ['INV-9', 'INV-1', 'INV-5', 'INV-3'];
    expect(V.revertedNote('Ali', 0, input).split('\n')[1]).toBe(stillPaidLine('INV-9, INV-1, INV-5'));
    expect(input).toEqual(['INV-9', 'INV-1', 'INV-5', 'INV-3']);

    // Qochirish: raqam ham, ism ham HTML sifatida emas — matn sifatida; xabardagi yagona teg — sarlavhadagi <b>
    const hostile = V.revertedNote('<i>A</i>&B', 1, ['<b>&1', 'A>B<', '&amp;']);
    expect(hostile.split('\n')).toEqual([`${REVERTED} — &lt;i&gt;A&lt;/i&gt;&amp;B${REOPENED}`, stillPaidLine('&lt;b&gt;&amp;1, A&gt;B&lt;, &amp;amp;')]);
    expect(hostile.match(/<[^>]*>/g)).toEqual(['<b>', '</b>']);
    // Qochirish har bir raqamga alohida: ajratuvchi ", " o'zi qochirilmaydi, to'rtinchi (tashlab ketilgan) raqam ham chiqmaydi
    expect(V.revertedNote('Ali', 0, ['a&b', 'c<d', 'e>f', '<script>']).split('\n')[1]).toBe(stillPaidLine('a&amp;b, c&lt;d, e&gt;f'));
    expect(V.revertedNote('Ali', 0, ['a&b', 'c<d', 'e>f', '<script>'])).not.toContain('script');
  });

  it("revertedNote: sabab izohi so'zma-so'z — «avtomatik ochilmadi: yangilanishdan oldingi belgi yoki alohida to'lov»; eski (noto'g'ri) izoh qolmagan", () => {
    // Butun yozuv harfma-harf (yordamchi konstantalarsiz): sarlavha, raqam, sabab, qayerda tuzatilishi
    expect(V.revertedNote('Ali', 0, ['INV-2026-0007'])).toBe(
      "↩️ <b>To'lov belgisi bekor qilindi</b> — Ali\n⚠️ Hisob-faktura INV-2026-0007 to'langan holida qoldi (avtomatik ochilmadi: yangilanishdan oldingi belgi yoki alohida to'lov). Admin panelda hisob-faktura sahifasida tekshiring — kerak bo'lsa u yerda «Qayta ochish» tugmasi bor.",
    );
    expect(V.revertedNote('Ali', 1, ['INV-2026-0007', 'INV-2026-0008'])).toBe(
      "↩️ <b>To'lov belgisi bekor qilindi</b> — Ali · hisob-faktura qayta ochildi\n⚠️ Hisob-faktura INV-2026-0007, INV-2026-0008 to'langan holida qoldi (avtomatik ochilmadi: yangilanishdan oldingi belgi yoki alohida to'lov). Admin panelda hisob-faktura sahifasida tekshiring — kerak bo'lsa u yerda «Qayta ochish» tugmasi bor.",
    );

    const five = ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003', 'INV-2026-0004', 'INV-2026-0005'];
    for (const by of ['Ali', '<i>A</i>&B', 'D'.repeat(100)]) for (const reopened of [undefined, 0, 1, 5]) for (const n of [1, 2, 3, 4, 5]) {
      const label = `${by.slice(0, 12)} ${reopened} ${n}`;
      const note = V.revertedNote(by, reopened, five.slice(0, n));
      const warning = note.split('\n')[1];
      // Sabab bir marta, «qoldi» dan keyin va «Admin panelda …» dan oldin; ism, ochilganlar soni va raqamlar soniga bog'liq emas
      expect(note.split(STILL_PAID_REASON), label).toHaveLength(2);
      expect(warning, label).toContain(` to'langan holida qoldi ${STILL_PAID_REASON}. Admin panelda hisob-faktura sahifasida tekshiring — `);
      expect(warning.slice(warning.indexOf(" to'langan holida qoldi")), label).toBe(stillPaidLine('').slice(stillPaidLine('').indexOf(" to'langan holida qoldi")));
      // Ikkala ehtimol ham aytilgan: surati yo'q (yangilanishdan oldingi) belgi yopgan YOKI alohida to'langan
      expect(warning, label).toContain('yangilanishdan oldingi belgi');
      expect(warning, label).toContain(" yoki alohida to'lov)");
      // Eski izoh bitta sababni qat'iy aytardi ("uni bu belgi yopmagan") — eski belgi yopgan hisob-faktura uchun bu noto'g'ri: endi yo'q
      expect(note, label).not.toContain(OLD_STILL_PAID_REASON);
      expect(note, label).not.toContain('yopmagan');
      // Yozuvdagi yagona qavs — shu izoh (ism va raqamlarda qavs yo'q); izoh matn, teg emas; satr ichida uzilmaydi
      expect(warning.match(/[()]/g), label).toEqual(['(', ')']);
      expect(warning.match(/\([^()]*\)/g), label).toEqual([STILL_PAID_REASON]);
      expect(warning, label).not.toMatch(/<[^>]*>/);
      expect(note.split('\n'), label).toHaveLength(2);
      // Birinchi satrda (kim bekor qilgani, qayta ochilgani) sabab izohi yo'q
      expect(note.split('\n')[0], label).toBe(V.revertedNote(by, reopened));
      expect(note.split('\n')[0], label).not.toContain('avtomatik ochilmadi');
    }
    // Izoh HTML uchun xavfsiz: qochiriladigan belgi yo'q (esc() dan o'tsa ham o'zgarmaydi), emoji ham yo'q
    expect(STILL_PAID_REASON).not.toMatch(/[&<>]/);
    expect(STILL_PAID_REASON.isWellFormed()).toBe(true);
    expect(bytes(STILL_PAID_REASON)).toBe(STILL_PAID_REASON.length);

    // Yopiq qolgan hisob-faktura bo'lmasa sabab ham chiqmaydi; boshqa yozuv va so'rovlarda umuman yo'q
    const quiet = [
      V.revertedNote('Ali'), V.revertedNote('Ali', 1), V.revertedNote('Ali', 1, []), V.paidNote('Ali'), ...STATUSES.map((s) => V.statusNote(s, 'Ali')),
      V.payAskHtml(5, 'INV-2026-0007'), V.revertAskHtml(5, 'INV-2026-0007'), V.cancelAskHtml(5), ...ROLES.map((r) => V.helpHtml(r)),
    ];
    for (const text of quiet) {
      expect(text).not.toContain('avtomatik ochilmadi');
      expect(text).not.toContain('yangilanishdan oldingi');
      expect(text).not.toContain(OLD_STILL_PAID_REASON);
    }
  });

  it("revertedNote: sabab izohi admin paneldagi ogohlantirish bilan bir xil — bot va panel bir narsani aytadi", () => {
    // Admin panelda belgi bekor qilinganda chiqadigan ogohlantirish (buyurtma sahifasi): sabab qavsi aynan shu matn
    const page = readFileSync(new URL('../../app/admin/(panel)/orders/[id]/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain(`hisob-fakturasi to'langan holida qoldi ${STILL_PAID_REASON}.`);
    expect(page.split(STILL_PAID_REASON)).toHaveLength(2);
    // Eski izoh bot matnida ham, panelda ham qolmagan
    expect(page).not.toContain(OLD_STILL_PAID_REASON);
    const views = readFileSync(new URL('../telegram/bots/staffViews.ts', import.meta.url), 'utf8');
    expect(views.split(STILL_PAID_REASON)).toHaveLength(2);
    expect(views).not.toContain('uni bu belgi yopmagan');
  });

  it("revertedNote: ogohlantirish aytgan «Qayta ochish» tugmasi admin paneldagi hisob-faktura sahifasida haqiqatan bor", () => {
    const page = readFileSync(new URL('../../app/admin/(panel)/invoices/[id]/page.tsx', import.meta.url), 'utf8');
    expect(V.revertedNote('Ali', 0, ['INV-1'])).toContain('hisob-faktura sahifasida tekshiring');
    expect(V.revertedNote('Ali', 0, ['INV-1'])).toContain('«Qayta ochish» tugmasi');
    expect(page).toMatch(/<form action=\{reopenInvoice\}[\s\S]*?<button[^>]*>\s*Qayta ochish\s*<\/button>/);
    // Tugma shart bilan chiqadi (to'langan hisob-faktura, buyurtmasi to'langan ham, puli qaytarilgan ham emas). Belgi bekor qilingach
    // buyurtma «to'lanmagan» (pending) bo'ladi — shart uni chetlab o'tmaydi: ogohlantirish va'da qilgan tugma o'sha payt haqiqatan ko'rinadi
    const guard = /\{([^{}\n]+) && \(\s*<form action=\{reopenInvoice\}/.exec(page)?.[1] ?? '';
    expect(guard).toContain("status === 'paid'");
    expect(guard).not.toContain('pending');
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
        // canPay berilmasa — yo'q degani: to'lov tugmasi tasodifan ochilib qolmaydi
        for (const rows of [staffOrderKeyboard({ id: 12, status, paymentStatus, paymentMethod: 'cash' }, false), staffOrderKeyboard({ id: 12, status, paymentStatus, paymentMethod: 'cash' }, false, false)]) {
          expect(datas(rows)).toEqual(['or_12']);
          expect(rows.flat().filter((b) => b.url).map((b) => b.url)).toEqual(['https://pack24.uz/admin/orders/12']);
        }
      }
    }
  });

  it("«To'landi» faqat moliya ruxsati bilan (canPay), qo'lda belgilanadigan usulda va hali to'lanmagan bo'lsa", () => {
    const has = (paymentMethod: string | null, paymentStatus: PaymentStatus, status: OrderStatus = 'processing', canPay = true) =>
      datas(staffOrderKeyboard({ id: 7, status, paymentStatus, paymentMethod: paymentMethod as never }, true, canPay)).includes('op_7');
    for (const method of ['cash', 'bank_transfer', null]) {
      expect(has(method, 'pending')).toBe(true);
      expect(has(method, 'failed')).toBe(true);
      expect(has(method, 'paid')).toBe(false);
      expect(has(method, 'refunded')).toBe(false);
      expect(has(method, 'pending', 'cancelled')).toBe(false);
      // Moliya ruxsati yo'q xodimga (orders bor) tugma hech bir holatda chiqmaydi
      for (const p of PAYMENTS) expect(has(method, p, 'processing', false)).toBe(false);
    }
    for (const method of ['payme', 'click']) for (const p of PAYMENTS) expect(has(method, p)).toBe(false);
    // Uchinchi argument berilmasa ham chiqmaydi (eski chaqiruv ko'rinishi)
    expect(datas(staffOrderKeyboard({ id: 7, status: 'processing', paymentStatus: 'pending', paymentMethod: 'cash' }, true))).toEqual(['os_7_shipping', 'oc_7', 'or_7']);
    // Tugma sharti va bot bosilganda tekshiradigan shart bitta funksiya
    expect(canMarkPaid({ status: 'new_', paymentStatus: 'pending', paymentMethod: 'cash' })).toBe(true);
    expect(canMarkPaid({ status: 'cancelled', paymentStatus: 'pending', paymentMethod: 'cash' })).toBe(false);
    expect(canMarkPaid({ status: 'new_', paymentStatus: 'pending', paymentMethod: 'click' })).toBe(false);
  });

  it("canRevertPaid: faqat qo'lda belgilanadigan usul va hozir «to'langan» — boshqa hech qaysi holatda emas", () => {
    for (const paymentMethod of METHODS) {
      const manual = paymentMethod === 'cash' || paymentMethod === 'bank_transfer' || paymentMethod === null;
      for (const paymentStatus of PAYMENTS) {
        expect(canRevertPaid({ paymentStatus, paymentMethod }), `${paymentMethod} ${paymentStatus}`).toBe(manual && paymentStatus === 'paid');
        // Bir vaqtda ham belgilash, ham bekor qilish taklif qilinmaydi
        for (const status of STATUSES) expect(canMarkPaid({ status, paymentStatus, paymentMethod }) && canRevertPaid({ paymentStatus, paymentMethod })).toBe(false);
      }
    }
    // Aniq qatorlar: Payme / Click to'lovini to'lov tizimi belgilagan — bot uni bekor qilmaydi
    expect(canRevertPaid({ paymentStatus: 'paid', paymentMethod: 'cash' })).toBe(true);
    expect(canRevertPaid({ paymentStatus: 'paid', paymentMethod: 'bank_transfer' })).toBe(true);
    expect(canRevertPaid({ paymentStatus: 'paid', paymentMethod: null })).toBe(true);
    expect(canRevertPaid({ paymentStatus: 'paid', paymentMethod: 'payme' })).toBe(false);
    expect(canRevertPaid({ paymentStatus: 'paid', paymentMethod: 'click' })).toBe(false);
    expect(canRevertPaid({ paymentStatus: 'pending', paymentMethod: 'cash' })).toBe(false);
    // Puli qaytarilgan buyurtma "to'langan" emas: undagi belgi bu tugma bilan o'zgartirilmaydi
    expect(canRevertPaid({ paymentStatus: 'refunded', paymentMethod: 'cash' })).toBe(false);
  });

  it("tugmalar jadvali: (canEdit, canPay) × to'lov holati × usul — to'lov tugmalari faqat canPay bilan, bekor qilish o'z qatorida", () => {
    type Case = [canEdit: boolean, canPay: boolean, method: PaymentMethod, payment: PaymentStatus, rows: string[][]];
    // Buyurtma "Tayyorlanmoqda": holat tugmasi «Jo'natildi», buyurtmani bekor qilish mumkin
    const processing: Case[] = [
      [true, true, 'cash', 'pending', [['os_7_shipping'], ['op_7', 'oc_7'], ['or_7']]],
      [true, true, 'cash', 'paid', [['os_7_shipping'], ['oc_7'], ['ou_7'], ['or_7']]],
      [true, true, 'cash', 'refunded', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, true, 'bank_transfer', 'pending', [['os_7_shipping'], ['op_7', 'oc_7'], ['or_7']]],
      [true, true, 'bank_transfer', 'paid', [['os_7_shipping'], ['oc_7'], ['ou_7'], ['or_7']]],
      [true, true, 'bank_transfer', 'refunded', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      // Rol "staff": buyurtma tugmalari bor, to'lov tugmalari yo'q
      [true, false, 'cash', 'pending', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, false, 'cash', 'paid', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, false, 'cash', 'refunded', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, false, 'bank_transfer', 'pending', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, false, 'bank_transfer', 'paid', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      [true, false, 'bank_transfer', 'refunded', [['os_7_shipping'], ['oc_7'], ['or_7']]],
      // Faqat moliya (bunday rol hozir yo'q, lekin funksiya ikki ruxsatni alohida oladi): holat tugmalari chiqmaydi
      [false, true, 'cash', 'pending', [['op_7'], ['or_7']]],
      [false, true, 'cash', 'paid', [['ou_7'], ['or_7']]],
      [false, true, 'cash', 'refunded', [['or_7']]],
      [false, true, 'bank_transfer', 'pending', [['op_7'], ['or_7']]],
      [false, true, 'bank_transfer', 'paid', [['ou_7'], ['or_7']]],
      [false, true, 'bank_transfer', 'refunded', [['or_7']]],
      [false, false, 'cash', 'pending', [['or_7']]],
      [false, false, 'cash', 'paid', [['or_7']]],
      [false, false, 'bank_transfer', 'paid', [['or_7']]],
    ];
    for (const [canEdit, canPay, paymentMethod, paymentStatus, rows] of processing) {
      expect(grid(staffOrderKeyboard({ id: 7, status: 'processing', paymentStatus, paymentMethod }, canEdit, canPay)), `processing ${canEdit} ${canPay} ${paymentMethod} ${paymentStatus}`).toEqual(rows);
    }
    // Onlayn usul: ruxsat qanday bo'lmasin to'lov tugmasi yo'q
    for (const paymentMethod of ['payme', 'click'] as const) {
      for (const paymentStatus of ['pending', 'paid', 'refunded'] as const) {
        for (const canPay of [true, false]) {
          expect(grid(staffOrderKeyboard({ id: 7, status: 'processing', paymentStatus, paymentMethod }, true, canPay)), `${paymentMethod} ${paymentStatus}`).toEqual([['os_7_shipping'], ['oc_7'], ['or_7']]);
          expect(grid(staffOrderKeyboard({ id: 7, status: 'processing', paymentStatus, paymentMethod }, false, canPay)), `${paymentMethod} ${paymentStatus}`).toEqual([['or_7']]);
        }
      }
    }

    // Bekor qilingan buyurtma: «To'landi» yo'q (mijozga noto'g'ri xabar ketmasin), lekin xato qo'yilgan belgini bekor qilish qoladi
    const cancelled: Case[] = [
      [true, true, 'cash', 'pending', [['or_7']]],
      [true, true, 'cash', 'paid', [['ou_7'], ['or_7']]],
      [true, true, 'cash', 'refunded', [['or_7']]],
      [true, true, 'bank_transfer', 'pending', [['or_7']]],
      [true, true, 'bank_transfer', 'paid', [['ou_7'], ['or_7']]],
      [true, true, 'bank_transfer', 'refunded', [['or_7']]],
      [true, true, 'payme', 'paid', [['or_7']]],
      [true, true, 'click', 'paid', [['or_7']]],
      [true, true, 'payme', 'pending', [['or_7']]],
      [true, true, 'click', 'refunded', [['or_7']]],
      [true, false, 'cash', 'paid', [['or_7']]],
      [true, false, 'bank_transfer', 'paid', [['or_7']]],
      [false, true, 'cash', 'paid', [['ou_7'], ['or_7']]],
      [false, false, 'cash', 'paid', [['or_7']]],
    ];
    for (const [canEdit, canPay, paymentMethod, paymentStatus, rows] of cancelled) {
      expect(grid(staffOrderKeyboard({ id: 7, status: 'cancelled', paymentStatus, paymentMethod }, canEdit, canPay)), `cancelled ${canEdit} ${canPay} ${paymentMethod} ${paymentStatus}`).toEqual(rows);
    }
  });

  it("tugmalar jadvali (to'liq): har bir holat × to'lov × usul × ruxsat uchun qoida bir xil", () => {
    for (const status of STATUSES) for (const paymentStatus of PAYMENTS) for (const paymentMethod of METHODS) for (const canEdit of [true, false]) for (const canPay of [true, false]) {
      const label = `${status} ${paymentStatus} ${paymentMethod} edit=${canEdit} pay=${canPay}`;
      const rows = staffOrderKeyboard({ id: 7, status, paymentStatus, paymentMethod }, canEdit, canPay);
      const d = datas(rows);
      const manual = paymentMethod !== 'payme' && paymentMethod !== 'click';
      expect(d.includes('op_7'), label).toBe(canPay && manual && status !== 'cancelled' && ['pending', 'processing', 'failed'].includes(paymentStatus));
      expect(d.includes('ou_7'), label).toBe(canPay && manual && paymentStatus === 'paid');
      // Buyurtma tugmalari "finance" ga bog'liq emas: canPay ularni qo'shmaydi ham, olib tashlamaydi ham
      expect(d.filter((x) => x.startsWith('os_') || x.startsWith('oc_')), label).toEqual(datas(staffOrderKeyboard({ id: 7, status, paymentStatus, paymentMethod }, canEdit, false)).filter((x) => x.startsWith('os_') || x.startsWith('oc_')));
      expect(d.some((x) => x.startsWith('os_') || x.startsWith('oc_')), label).toBe(canEdit && ORDER_FLOW[status].length > 0);
      // Tasdiq tugmalari (opy_, ouy_) kartada hech qachon yo'q: to'lov bir bosishda o'zgarmaydi
      expect(d.some((x) => x.startsWith('opy_') || x.startsWith('ouy_') || x.startsWith('ocy_')), label).toBe(false);
      // Belgini bekor qilish o'z qatorida yolg'iz turadi — «Bekor qilish» (buyurtmani) bilan yonma-yon emas
      const undoRow = rows.find((r) => r.some((b) => b.callback_data === 'ou_7'));
      if (undoRow) expect(undoRow.map((b) => b.text), label).toEqual([`↩️ ${UNDO_LABEL}`]);
      // Oxirgi qator har doim yangilash va admin panel
      expect(rows.at(-1)!.map((b) => b.callback_data ?? b.url), label).toEqual(['or_7', 'https://pack24.uz/admin/orders/7']);
      expect(new Set(d).size, label).toBe(d.length);
    }
  });

  it("tasdiq tugmalari: «Ha» amalni bajaradi, «Yo'q» kartaga qaytaradi (or_); uch tasdiqning callback'i har xil", () => {
    expect(payConfirmKeyboard(5)).toEqual([[{ text: "Ha, to'landi", callback_data: 'opy_5' }, { text: "Yo'q", callback_data: 'or_5' }]]);
    expect(revertConfirmKeyboard(5)).toEqual([[{ text: 'Ha, belgi bekor qilinsin', callback_data: 'ouy_5' }, { text: "Yo'q", callback_data: 'or_5' }]]);
    expect(cancelConfirmKeyboard(5)).toEqual([[{ text: 'Ha, bekor qilinsin', callback_data: 'ocy_5' }, { text: "Yo'q", callback_data: 'or_5' }]]);
    // Belgini bekor qilish tasdig'i buyurtmani bekor qilish (ocy_) yoki to'lash (opy_) callback'ini yubormaydi
    expect(datas(revertConfirmKeyboard(5))).not.toContain('ocy_5');
    expect(datas(revertConfirmKeyboard(5))).not.toContain('opy_5');
  });

  it("tasdiq tugmalari: uchala «Ha» tugmasining yozuvi har xil — to'lov belgisini bekor qilish buyurtmani bekor qilish bilan adashtirilmaydi", () => {
    const yes = (rows: InlineKeyboard) => rows[0][0];
    const confirms = { pay: payConfirmKeyboard(5), revert: revertConfirmKeyboard(5), cancel: cancelConfirmKeyboard(5) };
    const labels = Object.values(confirms).map((rows) => yes(rows).text);
    expect(labels).toEqual(["Ha, to'landi", 'Ha, belgi bekor qilinsin', 'Ha, bekor qilinsin']);
    expect(new Set(labels).size).toBe(3);
    // Avval ikkalasi ham «Ha, bekor qilinsin» edi: endi belgini bekor qilish tasdig'i nimani bekor qilishini o'zi aytadi
    expect(yes(confirms.revert).text).not.toBe(yes(confirms.cancel).text);
    expect(yes(confirms.revert).text).toContain('belgi');
    expect(yes(confirms.cancel).text).not.toContain('belgi');
    // Uchala tasdiq bir xil tuzilgan: bitta qator, chapda «Ha, …» (o'z callback'i bilan), o'ngda «Yo'q» (kartaga qaytaradi)
    expect(Object.values(confirms).map((rows) => yes(rows).callback_data)).toEqual(['opy_5', 'ouy_5', 'ocy_5']);
    for (const [name, rows] of Object.entries(confirms)) {
      expect(rows, name).toHaveLength(1);
      expect(rows[0], name).toHaveLength(2);
      expect(yes(rows).text.startsWith('Ha, '), name).toBe(true);
      expect(rows[0][1], name).toEqual({ text: "Yo'q", callback_data: 'or_5' });
    }
    // /stop tasdig'i ham o'z yozuvi bilan: botdagi hech qaysi ikki «Ha» bir xil emas
    expect(new Set([...labels, V.stopKeyboard()[0][0].text]).size).toBe(4);
    // Yozuv buyurtma raqamiga bog'liq emas
    expect(yes(revertConfirmKeyboard(2147483646))).toEqual({ text: 'Ha, belgi bekor qilinsin', callback_data: 'ouy_2147483646' });
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

  it("karta matni: to'lov tasdiqlari (bekor qilish so'rovidan uzunroq) va eng uzun yozuv bilan ham 4000 dan oshmaydi", () => {
    const worst = (ch: string, note?: string) => staffOrderHtml({
      id: 2147483646, status: 'new_', paymentStatus: 'paid', paymentMethod: 'bank_transfer', totalAmount: 999999999999, createdAt: new Date('2026-10-09T05:00:00Z'),
      customerName: ch.repeat(253), contactPhone: '998901234567', companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: ch.repeat(500), comment: ch.repeat(1000),
      items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: ch.repeat(300) } })), corporateInvoices: [{ invoiceNo: 'INV-2026-0001' }],
    } as never, note);
    const asks = [V.payAskHtml(2147483646, 'INV-2026-0001'), V.revertAskHtml(2147483646, 'INV-2026-0001')];
    // Yangi so'rovlar haqiqatan ham eng uzuni: chegara aynan shular bilan tekshirilishi kerak
    for (const ask of asks) expect(ask.length).toBeGreaterThan(V.cancelAskHtml(2147483646).length);
    for (const ch of ['&', '<', '>', 'A']) {
      // Tasdiq so'rovi: karta (yozuvsiz) + savol. Kesilsa savol yarmida uziladi yoki <b> yopilmay qoladi
      for (const ask of asks) {
        const full = `${worst(ch)}\n\n${ask}`;
        expect(full.length, ch).toBeLessThanOrEqual(4000);
        expect((full.match(/<b>/g) ?? []).length).toBe((full.match(/<\/b>/g) ?? []).length);
        expect(full.endsWith(ask)).toBe(true);
      }
      // Amaldan keyingi karta: tepada kim bajargani (bir satrli yozuvlar; yopiq qolgan hisob-faktura ogohlantirishi bilan eng uzuni — keyingi testda)
      for (const note of [V.revertedNote('D'.repeat(100), 1), V.paidNote('D'.repeat(100))]) {
        const full = worst(ch, note);
        expect(full.length, ch).toBeLessThanOrEqual(4000);
        expect(full.startsWith(`${note}\n`)).toBe(true);
        expect(full).toContain('💬');
      }
    }
  });

  it("karta matni: eng uzun yozuv (belgi bekor qilindi + qayta ochildi + 3 ta yopiq qolgan hisob-faktura, sabab izohi bilan) bilan ham kesilmaydi", () => {
    // Kartadagi hisob-faktura raqami ham eng uzuni (yozuvda sanalganlarning birinchisi): karta va yozuv birga eng yomon holatda
    const worst = (ch: string, status: OrderStatus, paymentStatus: PaymentStatus, invoiceNo: string, note?: string) => staffOrderHtml({
      id: 2147483646, status, paymentStatus, paymentMethod: 'bank_transfer', totalAmount: 999999999999, createdAt: new Date('2026-10-09T05:00:00Z'),
      customerName: ch.repeat(253), contactPhone: '998901234567', companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: ch.repeat(500), comment: ch.repeat(1000),
      items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: ch.repeat(300) } })), corporateInvoices: [{ invoiceNo }],
    } as never, note);
    // Xodim ismi admin panelda 100 belgigacha (oddiy harflar); hisob-faktura raqami INV-<yil>-<tartib> (documents.nextInvoiceNo) — tartib raqami zaxira bilan olingan
    const by = 'D'.repeat(100);
    const longest: Record<string, number> = {};
    for (const numbers of [['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003'], ['INV-2026-2147483645', 'INV-2026-2147483646', 'INV-2026-2147483647', 'INV-2026-2147483648', 'INV-2026-2147483649']]) {
      const note = V.revertedNote(by, 2, numbers);
      // Yozuv so'zma-so'z, sabab izohi bilan: uzunlik aynan hozirgi (avvalgidan uzunroq) matn bilan o'lchanadi
      expect(note.split('\n')).toEqual([`${REVERTED} — ${by}${REOPENED}`, stillPaidLine(numbers.slice(0, 3).join(', '))]);
      expect(note.split('\n')[1]).toContain(STILL_PAID_REASON);
      // Bu haqiqatan ham eng uzun yozuv: chegara aynan shu bilan tekshirilishi kerak
      for (const other of [V.revertedNote(by, 1), V.revertedNote(by, 0, numbers), V.paidNote(by), ...STATUSES.map((s) => V.statusNote(s, by))]) expect(note.length).toBeGreaterThan(other.length);
      for (const ch of ['&', '<', '>', 'A']) for (const status of STATUSES) for (const paymentStatus of PAYMENTS) {
        const label = `${ch} ${status} ${paymentStatus} ${numbers[0]}`;
        const full = worst(ch, status, paymentStatus, numbers[0], note);
        // sendMessage / editMessageText matnni 4000 belgida kesadi (Telegram chegarasi 4096): kesilsa karta oxiri yo'qoladi yoki &amp; yarmida uziladi
        expect(full.length, label).toBeLessThanOrEqual(4000);
        expect(full.length, label).toBeLessThanOrEqual(4096);
        // api.ts dagi haqiqiy clip ham hech narsani kesmaydi
        expect(clip(full, CLIP_AT), label).toBe(full);
        // Yozuv tepada, bo'sh satrdan keyin karta to'liq (oxirgi satri — izoh) turibdi
        expect(full, label).toBe(`${note}\n\n${worst(ch, status, paymentStatus, numbers[0])}`);
        expect(full.split('\n').at(-1)!.startsWith('💬 '), label).toBe(true);
        expect(full, label).not.toMatch(/&[a-z]*(?![a-z;])/); // yarim qolgan &amp; yo'q
        expect((full.match(/<b>/g) ?? []).length, label).toBe((full.match(/<\/b>/g) ?? []).length);
        expect(full.isWellFormed(), label).toBe(true);
        longest[numbers[0]] = Math.max(longest[numbers[0]] ?? 0, full.length);
      }
    }
    // Eng yomon holat haqiqatan o'lchangan (bo'sh aylanish emas): uzun raqamli to'plam uzunroq, u ham chegaradan past
    expect(Object.keys(longest)).toEqual(['INV-2026-0001', 'INV-2026-2147483645']);
    expect(longest['INV-2026-2147483645']).toBeGreaterThan(longest['INV-2026-0001']);
    expect(longest['INV-2026-2147483645']).toBeLessThanOrEqual(CLIP_AT);
    // Eng uzun karta — qochiriladigan belgilardan iborat mijoz matni bilan: oddiy harfli karta undan ancha qisqa
    expect(longest['INV-2026-0001']).toBeGreaterThan(worst('A', 'processing', 'pending', 'INV-2026-0001', V.revertedNote(by, 2, ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003'])).length);
  });

  it("karta matni: sabab izohi uzaygani chegarani buzmagan — belgi bekor qilingandan keyingi eng yomon karta yangi (uzunroq) yozuv bilan ham 4000 ichida", () => {
    // Belgi bekor qilingach buyurtma doim «to'lanmagan» (pending); karta sarlavhasi «Tayyorlanmoqda» holatida eng uzun. Karta: sayt qabul qiladigan eng uzun buyurtma
    const big = (ch: string, invoiceNo: string, note?: string) => staffOrderHtml({
      id: 2147483646, status: 'processing', paymentStatus: 'pending', paymentMethod: 'bank_transfer', totalAmount: 999999999999, createdAt: new Date('2026-10-09T05:00:00Z'),
      customerName: ch.repeat(253), contactPhone: '998901234567', companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: ch.repeat(500), comment: ch.repeat(1000),
      items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: ch.repeat(300) } })), corporateInvoices: [{ invoiceNo }],
    } as never, note);
    const by = 'D'.repeat(100);
    // Yangi izoh eskisidan uzun: yozuv aynan shu farqqa uzaygan, qisqa izoh bilan qilingan avvalgi o'lchov endi yetarli emas edi
    const grown = STILL_PAID_REASON.length - OLD_STILL_PAID_REASON.length;
    expect(grown).toBeGreaterThan(0);
    // Hisob-faktura raqamlari: odatdagi 4 xonali tartib, yiliga 9999 tadan oshgandagi 5 xonali va zaxira bilan olingan eng uzuni
    for (const numbers of [['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003'], ['INV-2026-99997', 'INV-2026-99998', 'INV-2026-99999'], ['INV-2026-2147483645', 'INV-2026-2147483646', 'INV-2026-2147483647']]) {
      const note = V.revertedNote(by, 2, numbers);
      expect(note.length - note.replace(STILL_PAID_REASON, OLD_STILL_PAID_REASON).length, numbers[0]).toBe(grown);
      for (const ch of ['&', '<', '>']) {
        const label = `${ch} ${numbers[0]}`;
        const full = big(ch, numbers[0], note);
        // Yozuv, bo'sh satr, karta — uzunlik aynan shularning yig'indisi (yashirin qo'shimcha yo'q)
        expect(full.length, label).toBe(note.length + 2 + big(ch, numbers[0]).length);
        expect(full.length, label).toBeLessThanOrEqual(CLIP_AT);
        expect(clip(full, CLIP_AT), label).toBe(full);
        // Kesilmagan: kartaning oxirgi satri (mijoz izohi) butun — oxirgi belgisi escCut qo'ygan «…»
        expect(full.split('\n').at(-1)!.startsWith('💬 '), label).toBe(true);
        expect(full.endsWith('…'), label).toBe(true);
      }
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
    const all: string[] = [...datas(cancelConfirmKeyboard(MAX)), ...datas(payConfirmKeyboard(MAX)), ...datas(revertConfirmKeyboard(MAX)), ...datas(V.stopKeyboard())];
    for (const status of STATUSES) for (const p of PAYMENTS) all.push(...datas(staffOrderKeyboard({ id: MAX, status, paymentStatus: p, paymentMethod: 'cash' }, true, true)));
    for (const kind of [{ key: 'new' }, { key: 'active' }, { key: 'phone', phone: '998901234567' }] as const) {
      const rows = V.listKeyboard(kind, Array.from({ length: 10 }, (_, i) => MAX - i), 9998, 9999 + 1);
      all.push(...datas(rows), ...datas(V.backRow(rows)));
    }
    expect(all.length).toBeGreaterThan(50);
    for (const d of all) expect(bytes(d)).toBeLessThanOrEqual(64);
    // To'lov tugmalari ham shu ro'yxatda (tekshiruv ularni chetlab o'tmagan), eng katta buyurtma raqami bilan
    for (const d of [`op_${MAX}`, `opy_${MAX}`, `ou_${MAX}`, `ouy_${MAX}`]) {
      expect(all, d).toContain(d);
      expect(bytes(d), d).toBeLessThanOrEqual(64);
    }
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
const chief = { ...ali, id: 3, name: 'Direktor', role: 'admin' as const };
const ACTOR = { name: ali.name, via: 'staff_bot' };
/** To'lovni belgilaydigan xodim: moliya ruxsati bor (menejer) */
const BOSS_ACTOR = { name: boss.name, via: 'staff_bot' };
const PAY_CALLBACKS = ['op_5', 'opy_5', 'ou_5', 'ouy_5'];
const ALL_CALLBACKS = ['os_5_processing', 'oc_5', 'ocy_5', 'or_5', ...PAY_CALLBACKS, 'sl_new_0', 'sb_active_1', 'sx_y', 'sx_n'];
const ONLINE_PAY = "Onlayn to'lovni Payme / Click o'zi avtomatik belgilaydi";
const ONLINE_REVERT = "Onlayn to'lovni Payme / Click o'zi boshqaradi — botdan bekor qilinmaydi";
const PAYMENT_MOVED = "To'lov holati allaqachon o'zgargan";

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

  it("uzilgan xodimning chatida qolgan kartadagi to'lov tugmalari (op_, opy_, ou_, ouy_): faqat \"ulaning\" oynasi, buyurtma o'qilmaydi ham", async () => {
    // Karta va tasdiq xabarlari moliya ruxsati bor xodimga yuborilgan edi — tugmalari chatda qolgan
    const stale: Record<string, InlineKeyboard> = {
      op_5: staffOrderKeyboard(order() as never, true, true),
      opy_5: payConfirmKeyboard(5),
      ou_5: staffOrderKeyboard(order({ paymentStatus: 'paid' }) as never, true, true),
      ouy_5: revertConfirmKeyboard(5),
    };
    for (const data of PAY_CALLBACKS) {
      calls.length = 0;
      expect(datas(stale[data]), data).toContain(data);
      await bot.handle(cb(data, stale[data]));
      // Telegram'ga yagona chaqiruv — oyna; xabar tahrirlanmaydi, yangi xabar ham yo'q
      expect(calls.map((c) => c.method), data).toEqual(['answerCallbackQuery']);
      expect(answers()[0], data).toMatchObject({ text: 'Avval botga ulaning: /start', show_alert: true });
    }
    expect(dbCalls()).toBe(0);
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
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
    // To'lov tugmalari ham: guruhga uzatilgan kartadan to'lov belgilanmaydi va bekor qilinmaydi (menejer bossa ham)
    h.staffByTelegram.mockResolvedValue(boss);
    for (const data of PAY_CALLBACKS) await bot.handle(cb(data, undefined, 'supergroup'));
    expect(sent()).toHaveLength(0);
    expect(edits()).toHaveLength(0);
    expect(dbCalls()).toBe(0);
    expect(h.staffByTelegram).not.toHaveBeenCalled();
    expect(h.setManualPayment).not.toHaveBeenCalled();
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
    const guarded = ALL_CALLBACKS.filter((d) => !d.startsWith('sx_'));
    // To'lov tugmalari ham shu ro'yxatda: "orders" ruxsati bo'lmasa moliya tekshiruvigacha ham bormaydi
    for (const data of PAY_CALLBACKS) expect(guarded).toContain(data);
    for (const data of guarded) await bot.handle(cb(data));
    expect(answers().map((a) => [a.text, a.show_alert])).toEqual(guarded.map(() => ["Ruxsat yo'q", true]));
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
    // Xodim (rol staff): holat tugmalari bor, «To'landi» yo'q — u moliya ruxsati bilan chiqadi
    expect(datas(inlineOf(e))).toEqual(['os_5_processing', 'oc_5', 'or_5', 'sb_new_1']);
    expect(sent()).toHaveLength(0);

    for (const staff of [boss, chief]) {
      h.staffByTelegram.mockResolvedValue(staff);
      await bot.handle(cb('or_5', list));
      expect(datas(inlineOf(edits().at(-1))), staff.role).toEqual(['os_5_processing', 'op_5', 'oc_5', 'or_5', 'sb_new_1']);
    }
  });

  it("karta: to'lov tugmalari har ochilganda xodimning HOZIRGI roliga qarab chiqadi (to'langan buyurtmada — bekor qilish)", async () => {
    const paid = order({ status: 'processing', paymentStatus: 'paid', corporateInvoices: [{ invoiceNo: 'INV-2026-0007' }] });
    h.prisma.order.findFirst.mockResolvedValue(paid);
    const shown: Record<string, string[][]> = {};
    for (const staff of [ali, boss, chief]) {
      h.staffByTelegram.mockResolvedValue(staff);
      await bot.handle(msg('/order 5'));
      shown[staff.role] = grid(inlineOf(sent().at(-1)));
    }
    expect(shown.staff).toEqual([['os_5_shipping'], ['oc_5'], ['or_5']]);
    expect(shown.manager).toEqual([['os_5_shipping'], ['oc_5'], ['ou_5'], ['or_5']]);
    expect(shown.admin).toEqual(shown.manager);
    // Bot kartani bazadagi buyurtma va xodimning roli bo'yicha tuzadi — sof funksiya bilan bir xil natija
    for (const staff of [ali, boss, chief]) expect(shown[staff.role]).toEqual(grid(staffOrderKeyboard(paid as never, can(staff.role, 'orders'), can(staff.role, 'finance'))));
    // Onlayn to'langan buyurtmada menejerga ham bekor qilish tugmasi yo'q
    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid', paymentMethod: 'click' }));
    await bot.handle(msg('/order 5'));
    expect(grid(inlineOf(sent().at(-1)))).toEqual([['os_5_processing'], ['oc_5'], ['or_5']]);
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
    // Holatni xodim (rol staff) o'zgartiradi; yangilangan kartada unga «To'landi» chiqmaydi
    expect(datas(inlineOf(e))).toEqual(['os_5_shipping', 'oc_5', 'or_5']);
    expect(answers().every((a) => !a.text)).toBe(true);

    // Menejer bosganda: xuddi shu amal, kartada to'lov tugmasi ham bor
    h.staffByTelegram.mockResolvedValue(boss);
    await bot.handle(cb('os_5_processing'));
    expect(h.changeOrderStatus).toHaveBeenLastCalledWith(5, 'processing', BOSS_ACTOR, { enforceFlow: true });
    expect(datas(inlineOf(edits().at(-1)))).toEqual(['os_5_shipping', 'op_5', 'oc_5', 'or_5']);
    // Holat tugmasi to'lovga tegmaydi
    expect(h.setManualPayment).not.toHaveBeenCalled();
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
    // Qidiruvdan ochilgan karta ham xodimning roliga qarab: rol staff ga «To'landi» yo'q
    expect(datas(inlineOf(sent().at(-1)))).toEqual(['os_5_processing', 'oc_5', 'or_5']);
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

    // Menejer raqam yozsa — o'sha karta, «To'landi» tugmasi bilan
    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.order.findFirst.mockResolvedValue(order());
    await bot.handle(msg('5'));
    expect(datas(inlineOf(sent().at(-1)))).toEqual(['os_5_processing', 'op_5', 'oc_5', 'or_5']);
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

  it("/help: xodimga to'lov moliyaning ishi ekani, moliya ruxsati borga bekor qilish tugmasi aytiladi", async () => {
    for (const staff of [ali, boss, chief]) {
      h.staffByTelegram.mockResolvedValue(staff);
      for (const text of ['/help', V.BTN.help]) {
        await bot.handle(msg(text));
        expect(lastText(), `${staff.role} ${text}`).toBe(V.helpHtml(staff.role));
        expect(lastText().includes(UNDO_LABEL), staff.role).toBe(staff.role !== 'staff');
        // Moliya ruxsati borga: qayta ochiladigani — faqat shu belgi yopgan hisob-faktura
        expect(lastText().includes(`«${UNDO_LABEL}» uni qaytaradi: ${CLOSED_BY_MARK} qayta ochiladi`), staff.role).toBe(staff.role !== 'staff');
        expect(sent().at(-1)!.reply_markup).toEqual(V.menuKeyboard(staff.role));
      }
    }
    // Yordam bitta xabarga sig'adi (4000 dan oshsa kesiladi va <b> yopilmay qoladi)
    for (const role of ROLES) {
      const html = V.helpHtml(role);
      expect(html.length, role).toBeLessThan(4000);
      expect((html.match(/<b>/g) ?? []).length, role).toBe((html.match(/<\/b>/g) ?? []).length);
    }
  });
});

// ─── To'lov belgisi: qo'yish va bekor qilish faqat moliya ruxsati bilan ──────

describe("boshqaruv boti: to'lovni belgilash va bekor qilish (moliya ruxsati)", () => {
  type FakeOrder = ReturnType<typeof order>;
  const INVOICE = [{ invoiceNo: 'INV-2026-0007' }];
  const card = (o: FakeOrder, note?: string) => staffOrderHtml(o as never, note);
  /** Shu rolga chiqishi kerak bo'lgan karta tugmalari (qatorma-qator) */
  const keysFor = (o: FakeOrder, role: (typeof ROLES)[number]) => grid(staffOrderKeyboard(o as never, can(role, 'orders'), can(role, 'finance')));
  /** Bitta tugma bosiladi; `calls` da faqat shu bosishda Telegram'ga ketgan chaqiruvlar qoladi */
  const press = async (data: string, markup?: InlineKeyboard) => {
    calls.length = 0;
    await bot.handle(cb(data, markup));
  };
  const lastEdit = () => edits().at(-1)!;
  const editedText = () => String(lastEdit().text);
  /** Callback'ga bitta javob beriladi: oyna (alert) matni yoki matnsiz jim javob */
  const alertText = () => {
    expect(answers()).toHaveLength(1);
    return answers()[0].show_alert ? String(answers()[0].text) : undefined;
  };

  beforeEach(() => {
    h.staffByTelegram.mockResolvedValue(boss);
  });

  it("op_: avval tasdiq so'raydi (hisob-faktura yopilishi va xato qanday qaytarilishi aytiladi) va hech narsa yozmaydi", async () => {
    h.prisma.order.findFirst.mockResolvedValue(order({ corporateInvoices: INVOICE }));
    await bot.handle(cb('op_5'));
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(String(edits().at(-1)!.text)).toContain("hisob-faktura INV-2026-0007 to'langan deb yopiladi");
    expect(editedText()).toBe(`${card(order({ corporateInvoices: INVOICE }))}\n\n${V.payAskHtml(5, 'INV-2026-0007')}`);
    expect(editedText()).toContain(`kartadagi «${UNDO_LABEL}» tugmasi bilan qaytariladi`);
    expect(datas(inlineOf(edits().at(-1)))).toEqual(['opy_5', 'or_5']);
    expect(inlineOf(lastEdit())).toEqual(payConfirmKeyboard(5));
    expect(alertText()).toBeUndefined();

    // Hisob-fakturasiz buyurtma: hisob-faktura tilga olinmaydi; ro'yxatdan ochilgan kartada qaytish tugmasi saqlanadi
    h.prisma.order.findFirst.mockResolvedValue(order());
    await press('op_5', [...staffOrderKeyboard(order() as never, true, true), ...V.backRow(V.listKeyboard({ key: 'new' }, [5], 1, 2))]);
    expect(editedText()).toBe(`${card(order())}\n\n${V.payAskHtml(5)}`);
    expect(editedText()).not.toContain('hisob-faktura');
    expect(grid(inlineOf(lastEdit()))).toEqual([['opy_5', 'or_5'], ['sb_new_1']]);

    // Eski xabardagi tugma: onlayn usul, bekor qilingan yoki allaqachon to'langan buyurtmada tasdiq ham so'ralmaydi
    const stale: [Record<string, unknown>, string][] = [
      [{ paymentMethod: 'payme' }, ONLINE_PAY],
      [{ paymentMethod: 'click' }, ONLINE_PAY],
      [{ status: 'cancelled' }, 'Buyurtma bekor qilingan'],
      [{ paymentStatus: 'paid' }, PAYMENT_MOVED],
      [{ paymentStatus: 'refunded' }, PAYMENT_MOVED],
    ];
    for (const [over, alert] of stale) {
      h.prisma.order.findFirst.mockResolvedValue(order(over));
      await press('op_5');
      expect(answers()[0].show_alert).toBe(true);
      expect(alertText(), JSON.stringify(over)).toBe(alert);
      expect(datas(inlineOf(edits().at(-1)))).not.toContain('opy_5');
      // Karta hozirgi holatda: savol matni yo'q, tugmalar shu holatga mos
      expect(editedText()).toBe(card(order(over)));
      expect(grid(inlineOf(lastEdit()))).toEqual(keysFor(order(over), 'manager'));
    }
    // Oxirgi holat — puli qaytarilgan: unda na «To'landi», na bekor qilish tugmasi bor
    expect(datas(inlineOf(lastEdit()))).toEqual(['os_5_processing', 'oc_5', 'or_5']);
    // Allaqachon (qo'lda) to'langan buyurtmaning yangilangan kartasida esa menejer bekor qilish tugmasini ko'radi
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid' }));
    await press('op_5');
    expect(datas(inlineOf(lastEdit()))).toEqual(['os_5_processing', 'oc_5', 'ou_5', 'or_5']);
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("opy_: qo'lda to'lov belgilanadi va kartada bekor qilish tugmasi paydo bo'ladi; onlayn usul va bekor qilingan buyurtmada — yo'q", async () => {
    // Ismi HTML belgili menejer: yozuvda ism qochiriladi
    h.staffByTelegram.mockResolvedValue({ ...ali, role: 'manager' });
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid' }));
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {} });
    h.prisma.order.findFirst.mockResolvedValueOnce(order());
    await bot.handle(cb('opy_5'));
    expect(h.setManualPayment).toHaveBeenCalledWith(5, 'paid', ACTOR);
    expect(h.setManualPayment).toHaveBeenCalledTimes(1);
    expect(String(edits().at(-1)!.text).split('\n')[0]).toBe("💵 <b>To'lov belgilandi</b> — Ali &lt;b&gt;");
    expect(datas(inlineOf(edits().at(-1)))).not.toContain('op_5');
    // Xato bosilgan bo'lsa qaytarish yo'li shu kartaning o'zida
    expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['oc_5'], ['ou_5'], ['or_5']]);

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
    // Ikki marta bosilgan tasdiq: buyurtma allaqachon to'langan — ikkinchi yozuv yo'q
    h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid' }));
    await press('opy_5', payConfirmKeyboard(5));
    expect(alertText()).toBe(PAYMENT_MOVED);
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("opy_: yozish paytida holat o'zgargan bo'lsa (conflict / o'zgarmadi / onlayn / o'chirilgan) — ogohlantirish va hozirgi karta", async () => {
    const results: [Record<string, unknown>, FakeOrder | null, string][] = [
      [{ ok: false, reason: 'conflict' }, order({ paymentStatus: 'paid' }), PAYMENT_MOVED],
      [{ ok: true, changed: false, order: {} }, order({ paymentStatus: 'paid' }), PAYMENT_MOVED],
      [{ ok: false, reason: 'online' }, order({ paymentMethod: 'click' }), ONLINE_PAY],
      [{ ok: false, reason: 'not_found' }, null, 'Buyurtma topilmadi'],
    ];
    for (const [res, after, alert] of results) {
      h.setManualPayment.mockReset().mockResolvedValue(res);
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(order()).mockResolvedValue(after);
      await press('opy_5', payConfirmKeyboard(5));
      expect(h.setManualPayment, alert).toHaveBeenCalledTimes(1);
      expect(alertText(), JSON.stringify(res)).toBe(alert);
      expect(edits()).toHaveLength(1);
      // «To'lov belgilandi» yozuvi chiqmaydi: hech narsa belgilanmadi
      expect(editedText()).toBe(after ? card(after) : V.orderGoneHtml(5));
      expect(grid(inlineOf(lastEdit()))).toEqual(after ? keysFor(after, 'manager') : []);
    }
  });

  it("moliya ruxsati yo'q xodim (rol staff) op_, opy_, ou_, ouy_ ni bossa: PAY_FORBIDDEN, hech narsa yozilmaydi, karta to'lov tugmalarisiz yangilanadi", async () => {
    h.staffByTelegram.mockResolvedValue(ali);
    // Chaqirilsa "muvaffaqiyatli" bo'lardi — rad etish aynan bot tomonida, yozuv funksiyasigacha bormasdan
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 1 });
    const back = V.backRow(V.listKeyboard({ key: 'new' }, [5], 1, 2));
    for (const o of [order({ corporateInvoices: INVOICE }), order({ paymentStatus: 'paid', corporateInvoices: INVOICE }), order({ paymentStatus: 'paid', paymentMethod: 'payme' })]) {
      h.prisma.order.findFirst.mockReset().mockResolvedValue(o);
      // Xodim menejer bo'lgan paytdagi xabarlar chatda qolgan: karta (op_/ou_ bilan) va tasdiq so'rovlari
      const stale: Record<string, InlineKeyboard> = {
        op_5: staffOrderKeyboard(order() as never, true, true),
        opy_5: payConfirmKeyboard(5),
        ou_5: staffOrderKeyboard(order({ paymentStatus: 'paid' }) as never, true, true),
        ouy_5: revertConfirmKeyboard(5),
      };
      for (const data of PAY_CALLBACKS) {
        const label = `${data} ${o.paymentStatus} ${o.paymentMethod}`;
        await press(data, [...stale[data], ...back]);
        expect(alertText(), label).toBe(V.PAY_FORBIDDEN);
        expect(sent(), label).toHaveLength(0);
        expect(edits(), label).toHaveLength(1);
        // Karta: savol ham, yozuv ham yo'q; to'lov tugmalari yo'qolgan, buyurtma tugmalari va ro'yxatga qaytish joyida
        expect(editedText(), label).toBe(card(o));
        expect(grid(inlineOf(lastEdit())), label).toEqual([['os_5_processing'], ['oc_5'], ['or_5'], ['sb_new_1']]);
        for (const pay of PAY_CALLBACKS) expect(datas(inlineOf(lastEdit())), label).not.toContain(pay);
      }
      // Har bosishda buyurtma faqat bir marta o'qiladi (kartani yangilash uchun)
      expect(h.prisma.order.findFirst).toHaveBeenCalledTimes(PAY_CALLBACKS.length);
    }
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(h.changeOrderStatus).not.toHaveBeenCalled();

    // O'chirilgan buyurtma: baribir avval ruxsat aytiladi (Telegram bitta javobni qabul qiladi), xabar "topilmadi"ga almashadi
    h.prisma.order.findFirst.mockReset().mockResolvedValue(null);
    for (const data of PAY_CALLBACKS) {
      await press(data);
      expect(alertText(), data).toBe(V.PAY_FORBIDDEN);
      expect(editedText(), data).toBe(V.orderGoneHtml(5));
      expect(inlineOf(lastEdit()), data).toEqual([]);
    }
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("roli tasdiq so'rovidan keyin pasaytirilgan menejer: «Ha» bosilganda ham ruxsat qayta tekshiriladi", async () => {
    const paid = order({ paymentStatus: 'paid', corporateInvoices: INVOICE });
    h.prisma.order.findFirst.mockResolvedValue(paid);
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 1 });
    await press('ou_5', staffOrderKeyboard(paid as never, true, true));
    const confirm = inlineOf(lastEdit());
    expect(datas(confirm)).toEqual(['ouy_5', 'or_5']);
    // Admin panelda rol "Xodim"ga o'zgartirildi — chatdagi tasdiq tugmasi eski huquq bilan ishlamaydi
    h.staffByTelegram.mockResolvedValue({ ...boss, role: 'staff' });
    await press('ouy_5', confirm);
    expect(alertText()).toBe(V.PAY_FORBIDDEN);
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(editedText()).toBe(card(paid));
    expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['oc_5'], ['or_5']]);
    // Rol qaytarilsa — o'sha tugma yana ishlaydi
    h.staffByTelegram.mockResolvedValue(boss);
    await press('ouy_5', confirm);
    expect(h.setManualPayment).toHaveBeenCalledWith(5, 'pending', BOSS_ACTOR, { expected: 'paid' });
  });

  it("\"orders\" ruxsati ham yo'q rol: to'lov tugmalariga \"Ruxsat yo'q\" — buyurtma o'qilmaydi, xabar o'zgarmaydi", async () => {
    h.staffByTelegram.mockResolvedValue({ ...boss, role: 'user' });
    for (const data of PAY_CALLBACKS) {
      await press(data, data.startsWith('ou') ? revertConfirmKeyboard(5) : payConfirmKeyboard(5));
      expect(calls.map((c) => c.method), data).toEqual(['answerCallbackQuery']);
      expect(alertText(), data).toBe("Ruxsat yo'q");
    }
    expect(dbCalls()).toBe(0);
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("yaroqsiz raqamli to'lov tugmasi: \"eskirgan\" — ruxsatdan qat'i nazar, baza so'ralmaydi; eng katta raqam esa ishlaydi", async () => {
    for (const staff of [boss, ali]) {
      h.staffByTelegram.mockResolvedValue(staff);
      for (const data of ['op_', 'op_x', 'opy_0', 'ou_', 'ou_-5', 'ou_abc', 'ou_1.5', 'ouy_', 'ouy_0', 'ouy_2147483647', 'ouy_99999999999']) {
        await press(data);
        expect(calls.map((c) => c.method), data).toEqual(['answerCallbackQuery']);
        expect(alertText(), data).toBe('Bu tugma eskirgan. /start bosing.');
      }
    }
    expect(dbCalls()).toBe(0);
    expect(h.setManualPayment).not.toHaveBeenCalled();

    // Bazadagi eng katta raqam (INT4) ham callback'dan to'g'ri o'qiladi
    h.staffByTelegram.mockResolvedValue(boss);
    h.prisma.order.findFirst.mockResolvedValue(order({ id: 2147483646, paymentStatus: 'paid' }));
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {} });
    await press('ou_2147483646');
    expect(h.prisma.order.findFirst.mock.lastCall![0]).toMatchObject({ where: { id: 2147483646, deletedAt: null } });
    expect(datas(inlineOf(lastEdit()))).toEqual(['ouy_2147483646', 'or_2147483646']);
    await press('ouy_2147483646');
    expect(h.setManualPayment).toHaveBeenCalledWith(2147483646, 'pending', BOSS_ACTOR, { expected: 'paid' });
  });

  it("ou_: avval tasdiq so'raydi va hech narsa yozmaydi; hisob-faktura raqami faqat bo'lsa aytiladi", async () => {
    const paid = order({ paymentStatus: 'paid', corporateInvoices: INVOICE });
    h.prisma.order.findFirst.mockResolvedValue(paid);
    await press('ou_5', staffOrderKeyboard(paid as never, true, true));
    expect(h.prisma.order.findFirst.mock.lastCall![0]).toMatchObject({ where: { id: 5, deletedAt: null } });
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(edits()).toHaveLength(1);
    expect(sent()).toHaveLength(0);
    expect(lastEdit().message_id).toBe(20);
    // Karta o'z joyida, ostida savol: nima qaytarilishi va mijozga xabar ketishi
    expect(editedText()).toBe(`${card(paid)}\n\n${V.revertAskHtml(5, 'INV-2026-0007')}`);
    expect(editedText()).toContain("<b>Buyurtma #5 uchun «to'landi» belgisi bekor qilinsinmi?</b>");
    expect(editedText()).toContain("hisob-faktura INV-2026-0007 shu belgi bilan yopilgan bo'lsa — avvalgi holiga ochiladi");
    expect(editedText()).toContain('mijozga tuzatish xabari boradi');
    expect(inlineOf(lastEdit())).toEqual(revertConfirmKeyboard(5));
    expect(datas(inlineOf(lastEdit()))).toEqual(['ouy_5', 'or_5']);
    // Savol — oyna emas: callback'ga matnsiz javob
    expect(alertText()).toBeUndefined();

    // Hisob-fakturasiz buyurtma (bank o'tkazmasi): hisob-faktura tilga olinmaydi; ro'yxatga qaytish tugmasi saqlanadi
    const plain = order({ paymentStatus: 'paid', paymentMethod: 'bank_transfer' });
    h.prisma.order.findFirst.mockResolvedValue(plain);
    await press('ou_5', [...staffOrderKeyboard(plain as never, true, true), ...V.backRow(V.listKeyboard({ key: 'active' }, [5], 0, 1))]);
    expect(editedText()).toBe(`${card(plain)}\n\n${V.revertAskHtml(5)}`);
    expect(editedText()).not.toContain('hisob-faktura');
    expect(grid(inlineOf(lastEdit()))).toEqual([['ouy_5', 'or_5'], ['sb_active_0']]);

    // Usuli yozilmagan eski buyurtma ham qo'lda belgilangan hisoblanadi; bekor qilingan buyurtmadagi xato belgi ham qaytariladi
    for (const over of [{ paymentMethod: null }, { status: 'cancelled' }, { status: 'delivered' }]) {
      h.prisma.order.findFirst.mockResolvedValue(order({ paymentStatus: 'paid', ...over }));
      await press('ou_5');
      expect(datas(inlineOf(lastEdit())), JSON.stringify(over)).toEqual(['ouy_5', 'or_5']);
      expect(alertText()).toBeUndefined();
    }
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("ou_ dan keyin «Yo'q»: karta o'z holiga qaytadi, belgi joyida qoladi", async () => {
    const paid = order({ paymentStatus: 'paid', corporateInvoices: INVOICE });
    h.prisma.order.findFirst.mockResolvedValue(paid);
    await press('ou_5', staffOrderKeyboard(paid as never, true, true));
    const confirm = inlineOf(lastEdit());
    await press('or_5', confirm);
    expect(editedText()).toBe(card(paid));
    expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['oc_5'], ['ou_5'], ['or_5']]);
    // «Yo'q» — yangilash tugmasi emas: "Yangilandi" javobi chiqmaydi
    expect(alertText()).toBeUndefined();
    expect(answers()[0].text).toBeUndefined();
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("ou_ / ouy_: eski xabardagi tugma — to'lanmagan, puli qaytarilgan, onlayn to'langan yoki o'chirilgan buyurtmada hech narsa yozilmaydi, karta yangilanadi", async () => {
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 1 });
    const stale: [Record<string, unknown>, string][] = [
      // Boshqa xodim allaqachon bekor qilgan yoki admin panelda holat o'zgargan
      [{ paymentStatus: 'pending' }, PAYMENT_MOVED],
      [{ paymentStatus: 'failed' }, PAYMENT_MOVED],
      [{ paymentStatus: 'refunded' }, PAYMENT_MOVED],
      [{ paymentStatus: 'pending', status: 'cancelled' }, PAYMENT_MOVED],
      // Payme / Click belgilagan to'lov: holati qanday bo'lmasin botdan o'zgartirilmaydi
      [{ paymentStatus: 'paid', paymentMethod: 'payme' }, ONLINE_REVERT],
      [{ paymentStatus: 'paid', paymentMethod: 'click' }, ONLINE_REVERT],
      [{ paymentStatus: 'pending', paymentMethod: 'click' }, ONLINE_REVERT],
    ];
    for (const [over, alert] of stale) {
      const o = order({ corporateInvoices: INVOICE, ...over });
      h.prisma.order.findFirst.mockResolvedValue(o);
      for (const data of ['ou_5', 'ouy_5']) {
        const label = `${data} ${JSON.stringify(over)}`;
        await press(data, data === 'ou_5' ? staffOrderKeyboard(order({ paymentStatus: 'paid' }) as never, true, true) : revertConfirmKeyboard(5));
        expect(alertText(), label).toBe(alert);
        expect(edits(), label).toHaveLength(1);
        expect(editedText(), label).toBe(card(o));
        expect(grid(inlineOf(lastEdit())), label).toEqual(keysFor(o, 'manager'));
        expect(datas(inlineOf(lastEdit())), label).not.toContain('ouy_5');
        expect(datas(inlineOf(lastEdit())), label).not.toContain('ou_5');
      }
    }
    // To'lanmagan (qo'lda) buyurtmaning yangilangan kartasida menejerga yana «To'landi» chiqadi
    h.prisma.order.findFirst.mockResolvedValue(order());
    await press('ouy_5', revertConfirmKeyboard(5));
    expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['op_5', 'oc_5'], ['or_5']]);

    // O'chirilgan buyurtma: "topilmadi" oynasi, xabar ham shunga almashadi (ro'yxatga qaytish tugmasi qoladi)
    h.prisma.order.findFirst.mockResolvedValue(null);
    for (const data of ['ou_5', 'ouy_5']) {
      await press(data, [...revertConfirmKeyboard(5), ...V.backRow(V.listKeyboard({ key: 'new' }, [5], 0, 1))]);
      expect(alertText(), data).toBe('Buyurtma topilmadi');
      expect(editedText(), data).toBe(V.orderGoneHtml(5));
      expect(grid(inlineOf(lastEdit())), data).toEqual([['sb_new_0']]);
    }
    expect(h.setManualPayment).not.toHaveBeenCalled();
  });

  it("ouy_: setManualPayment(id, 'pending', xodim, { expected: 'paid' }); kartada kim bekor qilgani, hisob-faktura qayta ochilgan bo'lsa — u ham", async () => {
    // Ismi HTML belgili menejer: yozuvda ism qochiriladi
    h.staffByTelegram.mockResolvedValue({ ...ali, role: 'manager' });
    const paid = order({ paymentStatus: 'paid', corporateInvoices: INVOICE });
    const reverted = order({ corporateInvoices: INVOICE });
    const plain = "↩️ <b>To'lov belgisi bekor qilindi</b> — Ali &lt;b&gt;";
    const results: [Record<string, unknown>, string][] = [
      [{ ok: true, changed: true, order: {}, reopened: 1 }, `${plain} · hisob-faktura qayta ochildi`],
      [{ ok: true, changed: true, order: {}, reopened: 2 }, `${plain} · hisob-faktura qayta ochildi`],
      // Hisob-faktura yo'q yoki uni bu belgi yopmagan (alohida to'langan): qayta ochilgani aytilmaydi
      [{ ok: true, changed: true, order: {}, reopened: 0 }, plain],
      [{ ok: true, changed: true, order: {} }, plain],
    ];
    for (const [res, note] of results) {
      h.setManualPayment.mockReset().mockResolvedValue(res);
      // Avval tekshiruv "to'langan"ni ko'radi, yozuvdan keyin karta bazadan qayta o'qiladi
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(paid).mockResolvedValue(reverted);
      await press('ouy_5', revertConfirmKeyboard(5));
      expect(h.setManualPayment).toHaveBeenCalledTimes(1);
      expect(h.setManualPayment).toHaveBeenCalledWith(5, 'pending', ACTOR, { expected: 'paid' });
      expect(h.prisma.order.findFirst).toHaveBeenCalledTimes(2);
      expect(edits()).toHaveLength(1);
      expect(sent()).toHaveLength(0);
      expect(editedText().split('\n')[0], JSON.stringify(res)).toBe(note);
      expect(editedText()).toBe(card(reverted, note));
      expect(editedText().includes('hisob-faktura qayta ochildi'), JSON.stringify(res)).toBe(Number(res.reopened ?? 0) > 0);
      // Karta yana "to'lanmagan": «To'landi» qaytdi, bekor qilish tugmasi yo'q
      expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['op_5', 'oc_5'], ['or_5']]);
      expect(alertText()).toBeUndefined();
    }
    // Belgini bekor qilish buyurtma holatiga tegmaydi
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
  });

  it("ouy_: setManualPayment qaytargan reopened VA stillPaid kartadagi yozuvga o'tadi — yopiq qolgan hisob-faktura haqida ogohlantirish", async () => {
    const paid = order({ paymentStatus: 'paid', corporateInvoices: INVOICE });
    const reverted = order({ corporateInvoices: INVOICE });
    const head = `${REVERTED} — Rahbar`;
    /** [setManualPayment natijasidagi qo'shimcha maydonlar, kartaning tepasida chiqishi kerak bo'lgan yozuv satrlari] */
    const results: [{ reopened?: number; stillPaid?: string[] }, string[]][] = [
      // Hech narsa ochilmadi, hisob-faktura yopiq qoldi (surati yo'q eski belgi yoki alohida to'langan): jim o'tilmaydi
      [{ reopened: 0, stillPaid: ['INV-1'] }, [head, stillPaidLine('INV-1')]],
      [{ stillPaid: ['INV-1'] }, [head, stillPaidLine('INV-1')]],
      // Ikkalasi: bittasi ochildi, boshqasi qoldi
      [{ reopened: 1, stillPaid: ['INV-2026-0008'] }, [`${head}${REOPENED}`, stillPaidLine('INV-2026-0008')]],
      [{ reopened: 2, stillPaid: ['INV-1', 'INV-2', 'INV-3', 'INV-4'] }, [`${head}${REOPENED}`, stillPaidLine('INV-1, INV-2, INV-3')]],
      // Hech biri / faqat ochilgani: ogohlantirish yo'q
      [{ reopened: 1, stillPaid: [] }, [`${head}${REOPENED}`]],
      [{ reopened: 0, stillPaid: [] }, [head]],
      [{}, [head]],
      // Raqam HTML sifatida emas, matn sifatida chiqadi (qochirilgan)
      [{ reopened: 0, stillPaid: ['<b>&1'] }, [head, stillPaidLine('&lt;b&gt;&amp;1')]],
    ];
    for (const [extra, lines] of results) {
      const label = JSON.stringify(extra);
      h.setManualPayment.mockReset().mockResolvedValue({ ok: true, changed: true, order: {}, ...extra });
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(paid).mockResolvedValue(reverted);
      await press('ouy_5', revertConfirmKeyboard(5));
      expect(h.setManualPayment, label).toHaveBeenCalledTimes(1);
      expect(h.setManualPayment, label).toHaveBeenCalledWith(5, 'pending', BOSS_ACTOR, { expected: 'paid' });
      // Yozuv tepada (satrma-satr), bo'sh satrdan keyin buyurtmaning hozirgi kartasi — bitta tahrir, yangi xabar yo'q
      expect(edits(), label).toHaveLength(1);
      expect(sent(), label).toHaveLength(0);
      expect(editedText(), label).toBe(`${lines.join('\n')}\n\n${card(reverted)}`);
      expect(editedText(), label).toBe(card(reverted, V.revertedNote('Rahbar', extra.reopened, extra.stillPaid)));
      expect(editedText().split('\n\n')[0].split('\n'), label).toHaveLength(lines.length);
      expect(editedText().includes('⚠️'), label).toBe((extra.stillPaid ?? []).length > 0);
      expect(editedText().includes("to'langan holida qoldi"), label).toBe((extra.stillPaid ?? []).length > 0);
      // Sabab izohi ogohlantirish bilan birga keladi (bir marta) — ogohlantirishsiz kartada umuman yo'q; eski izoh hech qayerda chiqmaydi
      expect(editedText().split(STILL_PAID_REASON), label).toHaveLength((extra.stillPaid ?? []).length > 0 ? 2 : 1);
      expect(editedText().includes('avtomatik ochilmadi'), label).toBe((extra.stillPaid ?? []).length > 0);
      expect(editedText(), label).not.toContain('yopmagan');
      expect(editedText().includes('hisob-faktura qayta ochildi'), label).toBe((extra.reopened ?? 0) > 0);
      // Ko'pi bilan 3 ta raqam sanaladi: to'rtinchisidan boshlab xabarga tushmaydi
      for (const dropped of (extra.stillPaid ?? []).slice(3)) expect(editedText(), label).not.toContain(dropped);
      expect((editedText().match(/<b>/g) ?? []).length, label).toBe((editedText().match(/<\/b>/g) ?? []).length);
      // Ogohlantirish — kartadagi yozuv, oyna emas; buyurtma baribir "to'lanmagan"ga qaytgan: «To'landi» tugmasi qaytdi
      expect(alertText(), label).toBeUndefined();
      expect(grid(inlineOf(lastEdit())), label).toEqual([['os_5_processing'], ['op_5', 'oc_5'], ['or_5']]);
    }
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
  });

  it("ouy_: stillPaid faqat belgi haqiqatan bekor qilinganda ko'rsatiladi; «To'landi» (opy_) yozuviga esa hech qachon qo'shilmaydi", async () => {
    // Hech narsa o'zgarmagan (boshqa xodim ulgurgan) natijada stillPaid bo'lsa ham karta yozuvsiz, ogohlantirishsiz
    for (const res of [{ ok: true, changed: false, order: {}, reopened: 1, stillPaid: ['INV-1'] }, { ok: false, reason: 'conflict', stillPaid: ['INV-1'] }]) {
      h.setManualPayment.mockReset().mockResolvedValue(res);
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(order({ paymentStatus: 'paid', corporateInvoices: INVOICE })).mockResolvedValue(order({ corporateInvoices: INVOICE }));
      await press('ouy_5', revertConfirmKeyboard(5));
      expect(alertText(), JSON.stringify(res)).toBe(PAYMENT_MOVED);
      expect(editedText(), JSON.stringify(res)).toBe(card(order({ corporateInvoices: INVOICE })));
      expect(editedText()).not.toContain('⚠️');
    }
    // «To'landi» yozuvi: natijada shu maydonlar bo'lsa ham (bo'lmaydi) faqat kim belgilagani
    h.setManualPayment.mockReset().mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 1, stillPaid: ['INV-1'] });
    h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(order()).mockResolvedValue(order({ paymentStatus: 'paid' }));
    await press('opy_5', payConfirmKeyboard(5));
    expect(editedText()).toBe(`${V.paidNote('Rahbar')}\n\n${card(order({ paymentStatus: 'paid' }))}`);
    expect(editedText()).not.toContain('⚠️');
    expect(editedText()).not.toContain('qayta ochildi');
  });

  it("ouy_: eng uzun karta va eng uzun yozuv (qayta ochildi + 3 ta yopiq qolgan hisob-faktura, sabab izohi bilan) Telegram'ga kesilmasdan ketadi", async () => {
    // Xodim ismi admin panelda 100 belgigacha
    const by = 'D'.repeat(100);
    h.staffByTelegram.mockResolvedValue({ ...boss, name: by });
    const back = V.backRow(V.listKeyboard({ key: 'active' }, [2147483646], 0, 1));
    // Odatdagi raqamlar (3 tadan ortig'i sanalmaydi) va zaxira bilan olingan eng uzunlari; kartadagi hisob-faktura — shularning birinchisi
    const sets = [
      ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003', 'INV-2026-0004', 'INV-2026-0005'],
      ['INV-2026-2147483645', 'INV-2026-2147483646', 'INV-2026-2147483647', 'INV-2026-2147483648'],
    ];
    for (const numbers of sets) for (const ch of ['&', '<', '>', 'A']) {
      const label = `${ch} ${numbers[0]}`;
      const big = (paymentStatus: PaymentStatus) => order({
        id: 2147483646, status: 'processing', paymentStatus, paymentMethod: 'bank_transfer', totalAmount: 999999999999,
        customerName: ch.repeat(253), companyInn: '12345678901234', deliveryMethod: 'courier', shippingAddress: ch.repeat(500), comment: ch.repeat(1000),
        items: Array.from({ length: 100 }, () => ({ quantity: 100000, product: { name: ch.repeat(300) } })), corporateInvoices: [{ invoiceNo: numbers[0] }],
      });
      h.setManualPayment.mockReset().mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 2, stillPaid: numbers });
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(big('paid')).mockResolvedValue(big('pending'));
      await press('ouy_2147483646', [...revertConfirmKeyboard(2147483646), ...back]);
      expect(h.setManualPayment, label).toHaveBeenCalledWith(2147483646, 'pending', { name: by, via: 'staff_bot' }, { expected: 'paid' });
      const text = editedText();
      const full = card(big('pending'), V.revertedNote(by, 2, numbers));
      expect(full.length, label).toBeLessThanOrEqual(4000);
      expect(full.length, label).toBeLessThanOrEqual(CLIP_AT);
      // api matnni 4000 belgida kesib yuboradi: Telegram'ga ketgani to'liq kartaning o'zi bo'lsa — hech narsa kesilmagan
      expect(text, label).toBe(full);
      // Yozuvning ikki satri (ikkinchisi — sabab izohi bilan, so'zma-so'z), bo'sh satr, keyin karta oxirgi satrigacha (izoh)
      expect(text, label).toBe(`${REVERTED} — ${by}${REOPENED}\n${stillPaidLine(numbers.slice(0, 3).join(', '))}\n\n${card(big('pending'))}`);
      expect(text.split(STILL_PAID_REASON), label).toHaveLength(2);
      for (const dropped of numbers.slice(3)) expect(text, label).not.toContain(dropped);
      expect(text.split('\n').at(-1)!.startsWith('💬 '), label).toBe(true);
      // Kartaning oxiri joyida: oddiy matnli izoh 300 belgisi bilan, qochirilgani — escCut qo'ygan «…» bilan tugaydi
      expect(text.endsWith(ch === 'A' ? `💬 ${'A'.repeat(300)}` : '…'), label).toBe(true);
      expect(text, label).not.toMatch(/&[a-z]*(?![a-z;])/); // yarim qolgan &amp; yo'q
      expect(text.isWellFormed(), label).toBe(true);
      expect((text.match(/<b>/g) ?? []).length, label).toBe((text.match(/<\/b>/g) ?? []).length);
      expect(grid(inlineOf(lastEdit())), label).toEqual([['os_2147483646_shipping'], ['op_2147483646', 'oc_2147483646'], ['or_2147483646'], ['sb_active_0']]);
      expect(alertText(), label).toBeUndefined();
    }
  });

  it('api: sendMessage va editMessageText matnni aynan 4000 belgida kesadi — karta va yozuv uzunligi shu chegara bilan solishtiriladi', async () => {
    // Chegaradagi matn o'zgarmaydi, bir belgi ortig'i kesiladi: testlardagi 4000 (CLIP_AT) api.ts dagi haqiqiy chegaraning o'zi
    for (const [length, sentLength] of [[CLIP_AT - 1, CLIP_AT - 1], [CLIP_AT, CLIP_AT], [CLIP_AT + 1, CLIP_AT], [CLIP_AT + 500, CLIP_AT]]) {
      calls.length = 0;
      await sendMessage('1:test', ME, 'x'.repeat(length));
      await editMessageText('1:test', ME, 20, 'y'.repeat(length));
      expect(calls.map((c) => c.method), String(length)).toEqual(['sendMessage', 'editMessageText']);
      expect(String(sent()[0].text), String(length)).toBe('x'.repeat(sentLength));
      expect(String(edits()[0].text), String(length)).toBe('y'.repeat(sentLength));
    }
  });

  it("uch tasdiq so'rovi botda: «Ha» tugmalari har xil yozuvli — belgini bekor qilish «Ha, belgi bekor qilinsin», buyurtmani bekor qilish «Ha, bekor qilinsin»", async () => {
    const yesOf = async (data: string, o: FakeOrder) => {
      h.prisma.order.findFirst.mockResolvedValue(o);
      await press(data, staffOrderKeyboard(o as never, true, true));
      expect(inlineOf(lastEdit())[0], data).toHaveLength(2);
      expect(inlineOf(lastEdit())[0][1], data).toEqual({ text: "Yo'q", callback_data: 'or_5' });
      return inlineOf(lastEdit())[0][0];
    };
    const pay = await yesOf('op_5', order());
    const revert = await yesOf('ou_5', order({ paymentStatus: 'paid' }));
    // To'langan (qo'lda) buyurtmaning bitta kartasida ikkala "bekor qilish" ham bor: buyurtmani (oc_) va belgini (ou_)
    const cancel = await yesOf('oc_5', order({ paymentStatus: 'paid' }));
    expect([pay, revert, cancel]).toEqual([
      { text: "Ha, to'landi", callback_data: 'opy_5' },
      { text: 'Ha, belgi bekor qilinsin', callback_data: 'ouy_5' },
      { text: 'Ha, bekor qilinsin', callback_data: 'ocy_5' },
    ]);
    expect(new Set([pay, revert, cancel].map((b) => b.text)).size).toBe(3);
    // So'rash bosqichida hech narsa yozilmagan
    expect(h.setManualPayment).not.toHaveBeenCalled();
    expect(h.changeOrderStatus).not.toHaveBeenCalled();
  });

  it('administrator ham belgilaydi va bekor qiladi; amal uning nomidan, "staff_bot" orqali yoziladi', async () => {
    h.staffByTelegram.mockResolvedValue(chief);
    h.setManualPayment.mockResolvedValue({ ok: true, changed: true, order: {}, reopened: 1 });
    h.prisma.order.findFirst.mockResolvedValueOnce(order()).mockResolvedValue(order({ paymentStatus: 'paid' }));
    await press('opy_5', payConfirmKeyboard(5));
    expect(h.setManualPayment).toHaveBeenLastCalledWith(5, 'paid', { name: 'Direktor', via: 'staff_bot' });
    expect(editedText().split('\n')[0]).toBe(V.paidNote('Direktor'));

    h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(order({ paymentStatus: 'paid' })).mockResolvedValue(order());
    await press('ouy_5', revertConfirmKeyboard(5));
    expect(h.setManualPayment).toHaveBeenLastCalledWith(5, 'pending', { name: 'Direktor', via: 'staff_bot' }, { expected: 'paid' });
    expect(editedText().split('\n')[0]).toBe(V.revertedNote('Direktor', 1));
    expect(h.setManualPayment).toHaveBeenCalledTimes(2);
  });

  it("ouy_: yozish paytida holat o'zgargan bo'lsa (conflict / o'zgarmadi / onlayn / o'chirilgan) — ogohlantirish, yozuvsiz hozirgi karta", async () => {
    const results: [Record<string, unknown>, FakeOrder | null, string][] = [
      // Tekshiruv va yozuv orasida boshqa xodim (yoki admin panel) holatni o'zgartirgan
      [{ ok: false, reason: 'conflict' }, order({ paymentStatus: 'refunded' }), PAYMENT_MOVED],
      [{ ok: false, reason: 'conflict' }, order({ paymentStatus: 'paid' }), PAYMENT_MOVED],
      [{ ok: true, changed: false, order: {} }, order(), PAYMENT_MOVED],
      [{ ok: false, reason: 'online' }, order({ paymentStatus: 'paid', paymentMethod: 'payme' }), ONLINE_REVERT],
      [{ ok: false, reason: 'not_found' }, null, 'Buyurtma topilmadi'],
    ];
    for (const [res, after, alert] of results) {
      const label = `${JSON.stringify(res)} -> ${after?.paymentStatus}`;
      h.setManualPayment.mockReset().mockResolvedValue(res);
      h.prisma.order.findFirst.mockReset().mockResolvedValueOnce(order({ paymentStatus: 'paid' })).mockResolvedValue(after);
      await press('ouy_5', revertConfirmKeyboard(5));
      expect(h.setManualPayment, label).toHaveBeenCalledTimes(1);
      expect(h.setManualPayment, label).toHaveBeenCalledWith(5, 'pending', BOSS_ACTOR, { expected: 'paid' });
      expect(alertText(), label).toBe(alert);
      expect(edits(), label).toHaveLength(1);
      // «Bekor qilindi» yozuvi chiqmaydi: hech narsa bekor qilinmadi
      expect(editedText(), label).not.toContain("To'lov belgisi bekor qilindi");
      expect(editedText(), label).toBe(after ? card(after) : V.orderGoneHtml(5));
      expect(grid(inlineOf(lastEdit())), label).toEqual(after ? keysFor(after, 'manager') : []);
    }
  });

  it("to'liq yo'l: «To'landi» → tasdiq → bekor qilish → tasdiq; har bosqichda bitta yozuv, takror bosish yozmaydi", async () => {
    // Soxta baza: buyurtmaning to'lov holati setManualPayment bilan o'zgaradi, karta har safar undan o'qiladi
    let paymentStatus: PaymentStatus = 'pending';
    h.prisma.order.findFirst.mockImplementation(async () => order({ paymentStatus, corporateInvoices: INVOICE }));
    h.setManualPayment.mockImplementation(async (_id: number, next: PaymentStatus) => {
      const reopened = paymentStatus === 'paid' && next === 'pending' ? 1 : 0;
      paymentStatus = next;
      return { ok: true, changed: true, order: {}, reopened };
    });
    await bot.handle(msg('/order 5'));
    let kb = inlineOf(sent().at(-1));
    expect(grid(kb)).toEqual([['os_5_processing'], ['op_5', 'oc_5'], ['or_5']]);

    await press('op_5', kb);
    kb = inlineOf(lastEdit());
    expect(datas(kb)).toEqual(['opy_5', 'or_5']);
    expect(h.setManualPayment).not.toHaveBeenCalled();

    await press('opy_5', kb);
    kb = inlineOf(lastEdit());
    expect(editedText().split('\n')[0]).toBe(V.paidNote('Rahbar'));
    expect(editedText()).toContain("To'langan");
    expect(grid(kb)).toEqual([['os_5_processing'], ['oc_5'], ['ou_5'], ['or_5']]);

    await press('ou_5', kb);
    kb = inlineOf(lastEdit());
    expect(datas(kb)).toEqual(['ouy_5', 'or_5']);
    expect(h.setManualPayment).toHaveBeenCalledTimes(1);

    await press('ouy_5', kb);
    expect(editedText().split('\n')[0]).toBe(V.revertedNote('Rahbar', 1));
    expect(editedText()).toContain("To'lanmagan");
    expect(grid(inlineOf(lastEdit()))).toEqual([['os_5_processing'], ['op_5', 'oc_5'], ['or_5']]);
    expect(h.setManualPayment.mock.calls).toEqual([[5, 'paid', BOSS_ACTOR], [5, 'pending', BOSS_ACTOR, { expected: 'paid' }]]);

    // Tasdiq tugmasi ikki marta bosilgan (yoki eski xabarda qolgan): ikkinchisi hech narsa yozmaydi
    await press('ouy_5', kb);
    expect(alertText()).toBe(PAYMENT_MOVED);
    expect(h.setManualPayment).toHaveBeenCalledTimes(2);
    expect(paymentStatus).toBe('pending');
  });
});
