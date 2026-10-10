import { Prisma, type CorporateInvoice, type User } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/notify', async () => (await import('./helpers')).notifyMock());
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());

const { runTick, tashkentClock } = await import('@/lib/cron');
const { overdueInvoiceWhere } = await import('@/lib/invoiceStatus');
const { sendDailyDigest } = await import('@/lib/orderNotify');

// Toshkent = UTC+5: 03:59Z — 08:59, 05:00Z — 10:00, 19:00Z — ertasi kuni 00:00
const at = (iso: string) => new Date(iso);
const OVERDUE = "Muddati o'tgan hisob-fakturalar";
const STALE = '24 soatdan beri qabul qilinmagan buyurtmalar';

// Sof hisob — bazasiz, oddiy `npm test` da ham tekshiriladi
describe('cron: Toshkent vaqti', () => {
  it('tashkentClock: sana va soat UTC+5 bo\'yicha', () => {
    expect(tashkentClock(at('2031-03-10T03:59:00Z'))).toEqual({ day: '2031-03-10', hour: 8 });
    expect(tashkentClock(at('2031-03-10T18:59:59Z'))).toEqual({ day: '2031-03-10', hour: 23 });
    expect(tashkentClock(at('2031-03-10T19:00:00Z'))).toEqual({ day: '2031-03-11', hour: 0 });
  });
});

describe.skipIf(!DB_TESTS)('cron: kunlik eslatma (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let saved: { value: Prisma.JsonValue; updatedAt: Date } | null | undefined; // undefined — hali o'qilmagan
  let manager: User;
  let worker: User;
  let invoice: CorporateInvoice;

  const state = async () => (await prisma.siteSetting.findUnique({ where: { key: 'cron' } }))?.value ?? null;
  const sentTo = (u: User) => outbox.staff.filter((m) => m.to === u.telegramId).map((m) => m.html);

  beforeAll(async () => {
    fx = await fixture(5);
    // "cron" yozuvi butun bazaga bitta: oldingi qiymatni saqlab, oxirida joyiga qaytaramiz
    saved = await prisma.siteSetting.findUnique({ where: { key: 'cron' }, select: { value: true, updatedAt: true } });
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });

    manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
    // Muddati eng eski sana: bazadagi boshqa hisob-fakturalar orasida ham ro'yxatning boshida (dastlabki 15 talikda) turadi
    const invoiced = await fx.order({ customerName: 'Test <MChJ>', status: 'processing', paymentMethod: 'bank_transfer' });
    invoice = await fx.invoice({ orderId: invoiced.id, total: 1200000, paid: 200000, status: 'partial', dueDate: new Date(0) });
    // Birinchi tick (2031-03-10 05:00Z) dan 25 soat oldin yaratilgan — 24 soatdan beri "Yangi" turgani haqiqiy sanaga bog'liq emas
    await fx.order({ status: 'new_', createdAt: at('2031-03-09T04:00:00Z') });
  });
  afterAll(async () => {
    if (saved !== undefined) {
      await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
      if (saved) await prisma.siteSetting.create({ data: { key: 'cron', value: saved.value ?? Prisma.JsonNull, updatedAt: saved.updatedAt } });
    }
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(clearOutbox);

  it('Toshkent vaqti bilan 09:00 gacha hech narsa yuborilmaydi va belgi qo\'yilmaydi', async () => {
    expect(await runTick(at('2031-03-10T03:59:00Z'))).toEqual({ digest: null });
    expect(outbox.staff).toEqual([]);
    expect(await state()).toBeNull();
  });

  it('10:00 da bir marta yuboriladi, shu kuni takrorlanmaydi, ertasi kuni yana yuboriladi', async () => {
    const first = await runTick(at('2031-03-10T05:00:00Z'));
    expect(first.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(first.digest?.orders).toBeGreaterThanOrEqual(1);
    expect(await state()).toEqual({ digestDay: '2031-03-10' });

    // Menejer: moliya va buyurtmalar eslatmasi; oddiy xodimda moliya ruxsati yo'q — faqat buyurtmalar
    const toManager = sentTo(manager);
    expect(toManager).toHaveLength(2);
    expect(toManager[0]).toContain(OVERDUE);
    expect(toManager[0]).toContain(`<b>${invoice.invoiceNo}</b>`);
    expect(toManager[0]).toMatch(/1\s000\s000 so'm/);
    expect(toManager[0]).toContain('Test &lt;MChJ&gt;');
    expect(toManager[1]).toContain(STALE);
    const toWorker = sentTo(worker);
    expect(toWorker).toHaveLength(1);
    expect(toWorker[0]).toContain(STALE);

    clearOutbox();
    expect(await runTick(at('2031-03-10T05:05:00Z'))).toEqual({ digest: null });
    expect(await runTick(at('2031-03-10T18:59:00Z'))).toEqual({ digest: null });
    expect(await runTick(at('2031-03-10T19:00:00Z'))).toEqual({ digest: null }); // ertasi kun boshlandi, lekin hali 09:00 emas
    expect(outbox.staff).toEqual([]);
    expect(await state()).toEqual({ digestDay: '2031-03-10' });

    const next = await runTick(at('2031-03-11T05:00:00Z'));
    expect(next.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(await state()).toEqual({ digestDay: '2031-03-11' });
    expect(sentTo(manager)).toHaveLength(2);
    expect(sentTo(worker)).toHaveLength(1);

    clearOutbox();
    expect(await runTick(at('2031-03-11T05:05:00Z'))).toEqual({ digest: null });
    expect(outbox.staff).toEqual([]);
  });

  // Eski bazadan qolgan, holati bazada 'overdue' deb yozilgan hisob-fakturalar ham ochiq qarz (OPEN_INVOICE_STATUSES,
  // effectiveInvoiceStatus va admin paneldagi "Muddati o'tgan" filtri ularni hisobga oladi) — eslatmada ham chiqishi kerak.
  it('eski yozuv: holati bazada "overdue" bo\'lgan hisob-faktura ham eslatmada chiqadi', async () => {
    const o = await fx.order({ status: 'delivered', paymentMethod: 'bank_transfer' });
    const legacy = await fx.invoice({ orderId: o.id, total: 300000, status: 'overdue', dueDate: new Date(0) });

    await sendDailyDigest(at('2031-03-12T05:00:00Z'));
    const finance = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance).toHaveLength(1);
    expect(finance[0].includes(`<b>${legacy.invoiceNo}</b>`)).toBe(true);
  });

  // Mijoz botidagi "Balans" bilan bir xil qoida (invoiceStatus.OWED_ORDER): aks holda xodimlar to'langan buyurtma uchun pul so'raydi
  it('to\'langan, puli qaytarilgan yoki bekor qilingan buyurtmaning ochiq hisob-fakturasi eslatmaga kirmaydi', async () => {
    const invoiceOf = async (order: Parameters<Fixture['order']>[0]) => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', ...order });
      return fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date(0) });
    };
    const owed = await invoiceOf({ status: 'delivered' });
    const paid = await invoiceOf({ status: 'delivered', paymentStatus: 'paid' });
    const refunded = await invoiceOf({ paymentStatus: 'refunded' });
    const cancelled = await invoiceOf({ status: 'cancelled' });
    const now = at('2031-03-13T05:00:00Z');

    const mine = { id: { in: [owed, paid, refunded, cancelled].map((i) => i.id) } };
    expect(await prisma.corporateInvoice.findMany({ where: { AND: [overdueInvoiceWhere(now), mine] }, select: { id: true } })).toEqual([{ id: owed.id }]);

    await sendDailyDigest(now);
    const [finance] = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance).toContain(`<b>${owed.invoiceNo}</b>`);
    for (const hidden of [paid, refunded, cancelled]) expect(finance).not.toContain(`<b>${hidden.invoiceNo}</b>`);
  });

  it('muddat kunining o\'zida hisob-faktura eslatmaga kirmaydi: keyingi kun (Toshkent vaqti) boshlangachgina muddati o\'tgan sanaladi', async () => {
    const o = await fx.order({ status: 'processing', paymentMethod: 'bank_transfer' });
    // Muddat — Toshkentda 15.03.2031, 08:00 (hisob-faktura 7 kun oldin shu soatda berilgan); mijozga faqat sana ko'rsatilgan
    const due = await fx.invoice({ orderId: o.id, total: 100000, dueDate: at('2031-03-15T03:00:00Z') });
    const overdueAt = async (now: Date) => (await prisma.corporateInvoice.count({ where: { AND: [overdueInvoiceWhere(now), { id: due.id }] } })) === 1;

    expect(await overdueAt(at('2031-03-15T05:00:00Z'))).toBe(false); // o'sha kuni 10:00 — kunlik eslatma vaqti
    expect(await overdueAt(at('2031-03-15T18:59:59Z'))).toBe(false); // o'sha kuni 23:59:59
    expect(await overdueAt(at('2031-03-15T19:00:00Z'))).toBe(true); // ertasi kuni 00:00
  });

  // 40-belgisi emojining birinchi yarmiga to'g'ri keladigan nom: oddiy slice(0, 40) juftsiz surrogat qoldiradi va Telegram
  // bunday xabarni butunlay rad etadi (eslatma hech kimga yetib bormaydi)
  const EMOJI_NAME = `${'K'.repeat(39)}😀 MChJ`;

  it('moliya eslatmasi: mijoz nomi kesilganda yarim emoji qolmaydi', async () => {
    const o = await fx.order({ customerName: EMOJI_NAME, status: 'delivered', paymentMethod: 'bank_transfer' });
    const inv = await fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date(0) });

    await sendDailyDigest(at('2031-03-14T05:00:00Z'));
    const [finance] = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance.split('\n').find((line) => line.includes(`<b>${inv.invoiceNo}</b>`))).toMatch(new RegExp(` · ${'K'.repeat(39)}$`));
    expect(finance.isWellFormed()).toBe(true);
  });

  it('"Yangi" turgan buyurtmalar: sarlavhada haqiqiy son; 15 tadan ko\'p bo\'lsa ro\'yxatda 15 ta va "… yana N ta"', async () => {
    // Soat 1970-yilga qo'yiladi: bazadagi boshqa buyurtmalar (shu faylniki ham, boshqa test fayllariniki ham) bu "hozir"dan keyin
    // yaratilgan, shuning uchun ro'yxatga faqat shu testning buyurtmalari tushadi va sonlar aniq
    const created = at('1970-01-01T00:00:00Z');
    const now = at('1970-01-02T00:00:01Z');
    const first = await fx.order({ status: 'new_', createdAt: created, customerName: EMOJI_NAME, totalAmount: 250000 });
    for (let i = 0; i < 14; i += 1) await fx.order({ status: 'new_', createdAt: created });
    // Ro'yxatga kirmaydiganlar: qabul qilingan, o'chirilgan va yaratilganiga hali 24 soat to'lmagan (aynan 24 soat)
    await fx.order({ status: 'processing', createdAt: created });
    await fx.order({ status: 'new_', createdAt: created, deletedAt: new Date() });
    await fx.order({ status: 'new_', createdAt: at('1970-01-01T00:00:01Z') });

    await sendDailyDigest(now);
    const exact = sentTo(worker).filter((h) => h.includes(STALE));
    expect(exact).toHaveLength(1);
    const lines = exact[0].split('\n');
    expect(lines[0]).toBe(`⏳ <b>${STALE}: 15 ta</b>`);
    expect(lines).toHaveLength(17); // sarlavha, 15 ta buyurtma, havola — "… yana" satri yo'q
    expect(lines[1]).toMatch(new RegExp(`^• <b>#${first.id}</b> · 01\\.01\\.1970 · 250\\s000 so'm · ${'K'.repeat(39)}$`));
    expect(exact[0].isWellFormed()).toBe(true);
    expect(lines.at(-1)).toMatch(/\/admin\/orders$/);

    // 16-buyurtma: ro'yxat 15 ta bo'lib qoladi (eng eskilari), sarlavha esa haqiqiy sonni aytadi
    const last = await fx.order({ status: 'new_', createdAt: created });
    clearOutbox();
    await sendDailyDigest(now);
    const more = sentTo(worker).filter((h) => h.includes(STALE))[0].split('\n');
    expect(more[0]).toBe(`⏳ <b>${STALE}: 16 ta</b>`);
    expect(more.filter((l) => l.startsWith('• <b>#'))).toHaveLength(15);
    expect(more.some((l) => l.startsWith(`• <b>#${last.id}</b>`))).toBe(false);
    expect(more.at(-2)).toBe('… yana 1 ta');
    expect(more.at(-1)).toMatch(/\/admin\/orders$/);
  });
});
