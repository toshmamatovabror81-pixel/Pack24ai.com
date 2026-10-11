import { Prisma, type CorporateInvoice, type PaymentStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { displayPhone } from '@/lib/format';
import type { Actor, InvoiceSnapshot } from '@/lib/orderFlow';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, TEST_SETTINGS, waitForBlocked, type Fixture } from './helpers';

/**
 * Har bir xabarning navbat mavzusi (notifyCustomer / notifyStaff ning to'rtinchi dalili) — helpers'dagi soxta yuboruvchi uni saqlamaydi.
 * `topics` — mijozga ketganlari, `staffTopics` — xodimlarga ketgan kartalarniki
 */
const sent = vi.hoisted(() => ({ topics: [] as { to: string; topic: string | null }[], staffTopics: [] as { to: string; topic: string | null }[] }));

/** next/navigation redirect() xato tashlab chiqadi — hisob-faktura amali qayerga yo'naltirganini shu xatodan olamiz */
class Redirect extends Error {
  constructor(public url: string) { super(`REDIRECT ${url}`); }
}

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/notify', async () => {
  const real = (await import('./helpers')).notifyMock();
  return {
    ...real,
    notifyCustomer: async (to: string | null | undefined, html: string, inline?: Parameters<typeof real.notifyCustomer>[2], topic?: string) => {
      sent.topics.push({ to: String(to), topic: topic ?? null });
      return real.notifyCustomer(to, html, inline);
    },
    notifyStaff: async (to: string | null | undefined, html: string, inline?: Parameters<typeof real.notifyStaff>[2], topic?: string) => {
      sent.staffTopics.push({ to: String(to), topic: topic ?? null });
      return real.notifyStaff(to, html, inline);
    },
  };
});
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());
// Hisob-faktura sahifasining haqiqiy amallari (markPaid, registerPartial, reopenInvoice) shu bazada ishlaydi: nusxasi emas, o'zi tekshiriladi.
// Faqat Next qismi va kirish tekshiruvi almashtiriladi (ruxsat tekshiruvi admin-actions.test.ts da)
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
vi.mock('@/lib/auth', () => ({ requireStaff: async () => ({ id: 0, name: 'Test Moliya', role: 'manager' }) }));

const { afterPaymentChange, changeOrderStatus, setManualPayment, settleInvoicesOfPaidOrder } = await import('@/lib/orderFlow');
const { customerDebt } = await import('@/lib/customerAccount');
const { getDict } = await import('@/lib/i18n');
const { markPaid, registerPartial, reopenInvoice } = await import('@/app/admin/(panel)/invoices/actions');

const admin: Actor = { name: 'Test Admin', via: 'admin' };
const bot: Actor = { name: 'Test Xodim', via: 'staff_bot' };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Hisob-faktura sahifasidagi amalni bajaradi va u yo'naltirgan manzilni qaytaradi */
async function run(action: (fd: FormData) => Promise<unknown>, fields: Record<string, string>): Promise<string> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    await action(fd);
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  throw new Error('amal hech qayerga yo\'naltirmadi');
}

describe.skipIf(!DB_TESTS)('orderFlow (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(1);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  /** Yig'ilgan xabarlar ham, ularning mavzulari ham tozalanadi (clearOutbox mavzularni bilmaydi) */
  const clearSent = () => {
    clearOutbox();
    sent.topics.length = 0;
    sent.staffTopics.length = 0;
  };
  beforeEach(clearSent);

  const row = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
  const events = (orderId: number) =>
    prisma.orderEvent.findMany({ where: { orderId }, orderBy: { id: 'asc' }, select: { kind: true, fromValue: true, toValue: true, actor: true, via: true } });
  const invoiceRow = (id: number) => prisma.corporateInvoice.findUniqueOrThrow({ where: { id } });
  const htmlTo = (telegramId: string) => outbox.customer.filter((m) => m.to === telegramId).map((m) => m.html);

  // ─── To'lov belgisini bekor qilish testlari uchun ──────────────────────────
  const soon = () => new Date(Date.now() + 5 * 86_400_000);
  const past = () => new Date(Date.now() - 3 * 86_400_000);
  /** To'lov tarixi surati (meta) bilan: belgi bekor qilinganda qaysi hisob-fakturalar qaytarilishi shu yozuvdan olinadi */
  const payments = (orderId: number) =>
    prisma.orderEvent.findMany({ where: { orderId, kind: 'payment' }, orderBy: { id: 'asc' }, select: { fromValue: true, toValue: true, actor: true, via: true, meta: true } });
  /** Suratlar id bo'yicha tartiblab olinadi: baza ochiq hisob-fakturalarni qaysi tartibda qaytarishi kafolatlanmagan */
  const byId = (list: InvoiceSnapshot[]) => [...list].sort((a, b) => a.id - b.id);
  const snapshots = (meta: unknown) => byId((meta as { invoices: InvoiceSnapshot[] }).invoices);
  /** Qayta ochilgan hisob-faktura: updatedAt dan boshqa HAMMA ustun (holat, summa, sana, muddat, shartnoma...) avvalgidek */
  const reopenedAs = (inv: CorporateInvoice) => ({ ...inv, updatedAt: expect.any(Date) });
  /** Mijozga ketgan to'lov xabarlari turi bo'yicha: "to'lov qabul qilindi" (✅) va uning tuzatishi (ℹ️) */
  const paymentMsgs = (telegramId: string) => htmlTo(telegramId).map((h) => (h.startsWith('✅') ? 'paid' : h.startsWith('ℹ️') ? 'reverted' : h));
  const callbacks = (m: { inline?: { callback_data?: string }[][] }) => (m.inline ?? []).flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));
  const setPaidAt = (id: number, paidAt: Date) => prisma.corporateInvoice.update({ where: { id }, data: { paidAt } });
  /** Buyurtma belgilanishidan oldin, mustaqil to'langan hisob-faktura */
  const paidInvoice = async (orderId: number, total: number) =>
    setPaidAt((await fx.invoice({ orderId, total, paid: total, status: 'paid', dueDate: past() })).id, new Date('2026-09-01T08:00:00.000Z'));
  /** Tarixga qo'lda yozuv: eski (suratsiz) yozuvlar va qo'lda tahrirlangan yoki buzilgan surat holatlari uchun */
  const forgeEvent = (orderId: number, toValue: PaymentStatus, meta?: unknown, extra: { fromValue?: PaymentStatus; createdAt?: Date } = {}) =>
    prisma.orderEvent.create({ data: { orderId, kind: 'payment', fromValue: 'pending', toValue, actor: 'Test', via: 'staff_bot', ...extra, ...(meta === undefined ? {} : { meta: meta as Prisma.InputJsonValue }) } });
  /** Bot tugmasi (ouy_) ham, admin formasi ham shunday chaqiradi: faqat buyurtma hozir "to'langan" bo'lsa */
  const undo = (orderId: number, actor: Actor = bot) => setManualPayment(orderId, 'pending', actor, { expected: 'paid' });
  /**
   * "To'lanmagan"ga qaytarish natijasi: nechta hisob-faktura qayta ochilgani va shundan keyin ham "to'langan" turganlarining raqamlari
   * (toMatchObject ro'yxatni aniq solishtiradi: `stillPaid` bo'sh deyilgan bo'lsa haqiqatan bo'sh bo'lishi shart)
   */
  const undone = (reopened: number, stillPaid: string[] = []) => ({ ok: true, changed: true, reopened, stillPaid, order: { paymentStatus: 'pending' } });
  /** Hisob-fakturaning pulga oid uch ustuni (summa son ko'rinishida) */
  const money = async (id: number) => {
    const r = await invoiceRow(id);
    return { status: r.status, paidAmount: Number(r.paidAmount), paidAt: r.paidAt };
  };
  /**
   * Mijozga boradigan tuzatish xabarining to'liq matni; `owed` — buyurtmadan to'lov kutilyaptimi (bekor qilingan buyurtmada yo'q).
   * `viaRefund` — buyurtma "qaytarilgan" orqali "to'lanmagan"ga o'tgan: belgi xato qo'yilganmi yoki pul haqiqatan qaytarilganmi —
   * tizim ajrata olmaydi, shuning uchun matnda sabab ("xato qo'yilgan edi") ham, uzr ham yo'q
   */
  const fixHtml = (lang: 'uz' | 'ru', orderId: number, owed = true, viaRefund = false) => {
    const tel = displayPhone(TEST_SETTINGS.phone);
    if (viaRefund) {
      return lang === 'uz'
        ? `ℹ️ <b>Buyurtma #${orderId}</b>\nBu buyurtma bo'yicha «to'lov qabul qilindi» belgisi olib tashlandi.${owed ? " Buyurtma hozircha <b>to'lanmagan</b> deb hisoblanadi." : ''}\nSavollar bo'lsa: ${tel}`
        : `ℹ️ <b>Заказ #${orderId}</b>\nОтметка «оплата получена» по этому заказу снята.${owed ? ' Заказ пока считается <b>неоплаченным</b>.' : ''}\nЕсли есть вопросы: ${tel}`;
    }
    return lang === 'uz'
      ? `ℹ️ <b>Buyurtma #${orderId}</b>\nTuzatish: bu buyurtma bo'yicha «to'lov qabul qilindi» belgisi xato qo'yilgan edi — u olib tashlandi.${owed ? " Buyurtma hozircha <b>to'lanmagan</b> deb hisoblanadi." : ''} Noqulaylik uchun uzr so'raymiz.\nSavollar bo'lsa: ${tel}`
      : `ℹ️ <b>Заказ #${orderId}</b>\nИсправление: отметка «оплата получена» по этому заказу была поставлена по ошибке и снята.${owed ? ' Заказ пока считается <b>неоплаченным</b>.' : ''} Приносим извинения за неудобство.\nЕсли есть вопросы: ${tel}`;
  };
  /** Xodimga ketgan kartalar va kartaning birinchi satri (izoh): bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin */
  const cardsTo = (u: { telegramId: string | null }) => outbox.staff.filter((m) => m.to === u.telegramId);
  const noteOf = (m: { html: string }) => m.html.split('\n')[0];
  /** Xodimga ketgan kartalarning navbat mavzulari: ikkala to'lov kartasi ("qabul qilindi" va tuzatishi) mijoz xabarlari bilan bitta mavzuda */
  const cardTopicsTo = (u: { telegramId: string | null }) => sent.staffTopics.filter((t) => t.to === u.telegramId).map((t) => t.topic);
  const paymentTopic = (orderId: number) => `order-payment:${orderId}`;
  /** Xodimlarga ketadigan ikki to'lov kartasining birinchi satri */
  const paidNote = (by: string) => `✅ <b>To'lov qabul qilindi</b> (${by})`;
  const revertedCardNote = (by: string) => `↩️ <b>To'lov belgisi bekor qilindi</b> (${by})`;

  describe('changeOrderStatus', () => {
    it('holat va o\'sha holatning vaqt belgisi yoziladi', async () => {
      const o = await fx.order();
      const started = Date.now();

      const r = await changeOrderStatus(o.id, 'processing', admin);
      expect(r).toMatchObject({ ok: true, changed: true, order: { id: o.id, status: 'processing' } });
      const confirmed = await row(o.id);
      expect(confirmed).toMatchObject({ status: 'processing', shippedAt: null, deliveredAt: null, cancelledAt: null });
      expect(confirmed.confirmedAt!.getTime()).toBeGreaterThanOrEqual(started);
      expect(confirmed.confirmedAt!.getTime()).toBeLessThanOrEqual(Date.now());

      await changeOrderStatus(o.id, 'shipping', admin);
      const shipped = await row(o.id);
      expect(shipped).toMatchObject({ status: 'shipping', deliveredAt: null, cancelledAt: null });
      expect(shipped.shippedAt).toBeInstanceOf(Date);

      await changeOrderStatus(o.id, 'delivered', admin);
      const delivered = await row(o.id);
      expect(delivered).toMatchObject({ status: 'delivered', cancelledAt: null });
      expect(delivered.deliveredAt).toBeInstanceOf(Date);

      const other = await fx.order();
      await changeOrderStatus(other.id, 'cancelled', admin);
      const cancelled = await row(other.id);
      expect(cancelled).toMatchObject({ status: 'cancelled', confirmedAt: null, shippedAt: null, deliveredAt: null });
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    });

    it('orqaga qaytarib yana o\'tkazilganda birinchi vaqt belgisi o\'zgarmaydi', async () => {
      const o = await fx.order();
      await changeOrderStatus(o.id, 'processing', admin);
      const first = (await row(o.id)).confirmedAt;
      expect(first).toBeInstanceOf(Date);

      await sleep(15); // qayta yozilsa vaqt albatta boshqa bo'lishi uchun
      expect(await changeOrderStatus(o.id, 'new_', admin)).toMatchObject({ ok: true, changed: true });
      expect((await row(o.id)).confirmedAt).toEqual(first);
      expect(await changeOrderStatus(o.id, 'processing', admin)).toMatchObject({ ok: true, changed: true });

      const again = await row(o.id);
      expect(again.status).toBe('processing');
      expect(again.confirmedAt).toEqual(first);
    });

    it('tarixga yoziladi: qaysi holatdan qaysiga, kim va qayerdan', async () => {
      const o = await fx.order();
      await changeOrderStatus(o.id, 'processing', bot);
      await changeOrderStatus(o.id, 'shipping', admin);
      expect(await events(o.id)).toEqual([
        { kind: 'status', fromValue: 'new_', toValue: 'processing', actor: 'Test Xodim', via: 'staff_bot' },
        { kind: 'status', fromValue: 'processing', toValue: 'shipping', actor: 'Test Admin', via: 'admin' },
      ]);
    });

    it('enforceFlow: "Yangi"dan to\'g\'ridan-to\'g\'ri "Yetkazildi" rad etiladi va qator o\'zgarmaydi; "Tayyorlanmoqda"ga o\'tadi', async () => {
      const o = await fx.order();

      const bad = await changeOrderStatus(o.id, 'delivered', bot, { enforceFlow: true });
      expect(bad).toMatchObject({ ok: false, reason: 'flow', order: { id: o.id, status: 'new_' } });
      expect(await row(o.id)).toEqual(o);
      expect(await events(o.id)).toEqual([]);

      // Qoralama hech qachon qo'lda qo'yilmaydi — enforceFlow bo'lmasa ham
      expect(await changeOrderStatus(o.id, 'draft', admin)).toEqual({ ok: false, reason: 'flow' });
      expect(await row(o.id)).toEqual(o);

      const good = await changeOrderStatus(o.id, 'processing', bot, { enforceFlow: true });
      expect(good).toMatchObject({ ok: true, changed: true });
      expect((await row(o.id)).status).toBe('processing');
      expect(await events(o.id)).toHaveLength(1);
    });

    it('yo\'q yoki o\'chirilgan buyurtma: not_found', async () => {
      const soft = await fx.order({ deletedAt: new Date() });
      expect(await changeOrderStatus(soft.id, 'processing', admin)).toEqual({ ok: false, reason: 'not_found' });
      expect(await row(soft.id)).toEqual(soft);
      expect(await events(soft.id)).toEqual([]);

      const gone = await fx.order();
      await prisma.order.delete({ where: { id: gone.id } });
      expect(await changeOrderStatus(gone.id, 'processing', admin)).toEqual({ ok: false, reason: 'not_found' });
    });

    it('holat o\'sha-o\'sha bo\'lsa: ok, changed=false, tarix ham xabar ham yo\'q', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone });

      const r = await changeOrderStatus(o.id, 'new_', admin);
      expect(r).toMatchObject({ ok: true, changed: false, order: { id: o.id, status: 'new_' } });
      expect(await row(o.id)).toEqual(o);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);
    });

    // Admin formasi ochiq turganda holatni bot o'zgartirgan: forma ko'rgan qiymat (expected) bazadagidan farq qilsa eski holat
    // ustidan yozilmaydi — aks holda buyurtma orqaga qaytib, mijozga teskari xabar ketardi
    it('expected: chaqiruvchi ko\'rgan holat eskirgan bo\'lsa "conflict" — qator, tarix va xabar o\'zgarmaydi; tanlangan holat joyida bo\'lsa ziddiyat emas', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone });
      await changeOrderStatus(o.id, 'processing', bot);
      await changeOrderStatus(o.id, 'shipping', bot);
      const moved = await row(o.id);
      clearOutbox();

      // Forma buyurtma "Yangi" paytida ochilgan
      for (const next of ['processing', 'cancelled', 'delivered'] as const) {
        expect(await changeOrderStatus(o.id, next, admin, { expected: 'new_' })).toMatchObject({ ok: false, reason: 'conflict', order: { id: o.id, status: 'shipping' } });
      }
      expect(await row(o.id)).toEqual(moved);
      expect(await events(o.id)).toHaveLength(2);
      expect(outbox.customer).toEqual([]);

      // Tanlangan holat allaqachon joyida: jim "o'zgarmadi"
      expect(await changeOrderStatus(o.id, 'shipping', admin, { expected: 'new_' })).toMatchObject({ ok: true, changed: false });
      expect(await row(o.id)).toEqual(moved);
      // Sahifa yangilangach (forma hozirgi holatni ko'rsatadi) admin istalgan holatni qo'ya oladi — orqaga ham
      expect(await changeOrderStatus(o.id, 'processing', admin, { expected: 'shipping' })).toMatchObject({ ok: true, changed: true, order: { status: 'processing' } });
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
    });

    // Xodim ismi odatda qisqa, lekin UTF-16 bo'yicha kesish emoji o'rtasidan bo'lsa yarim surrogatni Prisma rad etadi va tarix satri yo'qoladi
    it('tarixdagi ism 100 belgidan uzun va chegarasida emoji bo\'lsa ham yoziladi (holat va to\'lov satrlari)', async () => {
      const long: Actor = { name: `${'A'.repeat(99)}😀 Aliyev`, via: 'staff_bot' };
      expect(long.name.slice(0, 100).isWellFormed()).toBe(false);
      const o = await fx.order({ paymentMethod: 'cash' });

      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await changeOrderStatus(o.id, 'processing', long);
        await setManualPayment(o.id, 'paid', long);
        expect(logged).not.toHaveBeenCalled();
      } finally {
        logged.mockRestore();
      }
      expect(await events(o.id)).toEqual([
        { kind: 'status', fromValue: 'new_', toValue: 'processing', actor: 'A'.repeat(99), via: 'staff_bot' },
        { kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'A'.repeat(99), via: 'staff_bot' },
      ]);
    });

    it('ikki xodim bir vaqtda bosganda faqat bittasi o\'tadi, ikkinchisi "conflict" oladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone });

      // Ikkala chaqiruv ham "Yangi" holatini o'qib, yozishga yetib kelgandagina qo'yib yuboriladi: qatorni qulflab turamiz
      // va bazada ikkita so'rov shu qulfni kutayotganini ko'rgach bo'shatamiz. Shunda poyga har safar bir xil bo'ladi.
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const race = Promise.all([changeOrderStatus(o.id, 'processing', bot), changeOrderStatus(o.id, 'cancelled', admin)]);
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const results = await held.race;

      const won = results.flatMap((r) => (r.ok && r.changed ? [r.order] : []));
      const lost = results.flatMap((r) => (r.ok ? [] : [r]));
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(lost[0].reason).toBe('conflict');

      const final = await row(o.id);
      expect(['processing', 'cancelled']).toContain(final.status);
      expect(won[0].status).toBe(final.status);
      expect(lost[0].order?.status).toBe(final.status); // yutqazgan tomonga bazadagi yangi holat qaytadi
      expect([final.confirmedAt, final.cancelledAt].filter(Boolean)).toHaveLength(1);
      expect(await events(o.id)).toEqual([expect.objectContaining({ kind: 'status', fromValue: 'new_', toValue: final.status })]);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
    });

    it('"Yetkazildi" ombordan faqat bir marta chiqim qiladi — qaytarib yana yetkazildi qilinsa ham', async () => {
      const p = await fx.product();
      const main = await fx.stock(p.id, 100);
      const o = await fx.order({ items: { create: [{ productId: p.id, quantity: 3, price: 1000 }, { productId: p.id, quantity: 4, price: 1000 }] } });
      const left = async () => (await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: p.id, warehouseId: main.id } } })).quantity;
      const moves = () => prisma.stockMovement.findMany({ where: { productId: p.id }, select: { type: true, quantity: true, reason: true, fromWarehouseId: true, createdBy: true } });

      await changeOrderStatus(o.id, 'processing', admin);
      await changeOrderStatus(o.id, 'shipping', admin);
      expect(await left()).toBe(100);
      expect(await moves()).toEqual([]);

      await changeOrderStatus(o.id, 'delivered', bot);
      expect(await left()).toBe(93);
      expect(await moves()).toEqual([{ type: 'OUT', quantity: 7, reason: `Buyurtma #${o.id}`, fromWarehouseId: main.id, createdBy: 'Test Xodim' }]);
      const deliveredAt = (await row(o.id)).deliveredAt;

      await sleep(15);
      await changeOrderStatus(o.id, 'processing', admin);
      expect(await changeOrderStatus(o.id, 'delivered', admin)).toMatchObject({ ok: true, changed: true });
      expect(await left()).toBe(93);
      expect(await moves()).toHaveLength(1);
      expect((await row(o.id)).deliveredAt).toEqual(deliveredAt);
    });

    it('qoldiq yetmasa bori chiqariladi (0 gacha) va buyurtma baribir yetkazilgan bo\'ladi', async () => {
      const p = await fx.product();
      const main = await fx.stock(p.id, 5);
      const o = await fx.order({ status: 'shipping', items: { create: [{ productId: p.id, quantity: 8, price: 1000 }] } });

      expect(await changeOrderStatus(o.id, 'delivered', bot, { enforceFlow: true })).toMatchObject({ ok: true, changed: true });
      expect((await row(o.id)).status).toBe('delivered');
      expect(await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: p.id, warehouseId: main.id } }, select: { quantity: true } })).toEqual({ quantity: 0 });
      expect(await prisma.stockMovement.findMany({ where: { productId: p.id }, select: { type: true, quantity: true } })).toEqual([{ type: 'OUT', quantity: 5 }]);
    });

    it('botga ulangan mijozga har bir haqiqiy o\'zgarishda bitta xabar boradi; o\'zgarmasa yoki rad etilsa — yo\'q', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone });

      await changeOrderStatus(o.id, 'processing', bot);
      expect(outbox.customer).toHaveLength(1);
      const [first] = outbox.customer;
      expect(first.to).toBe(c.telegramId);
      expect(first.html).toContain(`Buyurtma #${o.id}`);
      expect(first.html).toContain(getDict('uz').order.statuses.processing);
      // "Batafsil" tugmasi: mijoz boti aynan shu prefiksni ushlaydi
      expect(first.inline?.[0][0].callback_data).toBe(`o_${o.id}`);
      expect(first.inline?.[0][1].url).toContain(`/uz/orders/${o.accessToken}`);

      await changeOrderStatus(o.id, 'processing', bot); // o'zgarmadi
      await changeOrderStatus(o.id, 'delivered', bot, { enforceFlow: true }); // rad etildi
      expect(outbox.customer).toHaveLength(1);

      await changeOrderStatus(o.id, 'shipping', bot);
      await changeOrderStatus(o.id, 'delivered', bot);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId, c.telegramId, c.telegramId]);
      expect(outbox.staff).toEqual([]);
    });

    it('xabarnomani o\'chirgan mijozga hech narsa yuborilmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone, notify: false });
      const o = await fx.order({ contactPhone: phone });

      expect(await changeOrderStatus(o.id, 'processing', bot)).toMatchObject({ ok: true, changed: true });
      expect(await changeOrderStatus(o.id, 'cancelled', bot)).toMatchObject({ ok: true, changed: true });
      expect(outbox.customer).toEqual([]);
    });

    it('xabar mijoz tilida yoziladi; bekor qilinganda aloqa telefoni qo\'shiladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone, lang: 'ru' });
      const o = await fx.order({ contactPhone: phone });

      await changeOrderStatus(o.id, 'cancelled', admin);
      expect(outbox.customer).toHaveLength(1);
      expect(outbox.customer[0].to).toBe(c.telegramId);
      expect(outbox.customer[0].html).toContain(`Заказ #${o.id}`);
      expect(outbox.customer[0].html).toContain(getDict('ru').order.statuses.cancelled);
      expect(outbox.customer[0].html).toContain(displayPhone(TEST_SETTINGS.phone));
    });

    it('olib ketiladigan buyurtma: "yo\'lga chiqdi" va "yetkazildi" o\'rniga "tayyor, olib ketishingiz mumkin" va "topshirildi" — ikki tilda', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, deliveryMethod: 'pickup', status: 'processing' });

      // Bot tugmalari olib ketiladigan buyurtmani ham "Jo'natildi" → "Yetkazildi" orqali o'tkazadi (enforceFlow)
      expect(await changeOrderStatus(o.id, 'shipping', bot, { enforceFlow: true })).toMatchObject({ ok: true, changed: true });
      expect(htmlTo(uz.telegramId)).toEqual([`📦 <b>Buyurtma #${o.id}</b>\nHolati: <b>Olib ketishga tayyor</b>\nBuyurtmangiz tayyor, olib ketishingiz mumkin.`]);
      expect(htmlTo(ru.telegramId)).toEqual([`📦 <b>Заказ #${o.id}</b>\nСтатус: <b>Готов к выдаче</b>\nВаш заказ готов, его можно забрать.`]);

      clearOutbox();
      expect(await changeOrderStatus(o.id, 'delivered', bot, { enforceFlow: true })).toMatchObject({ ok: true, changed: true });
      expect(htmlTo(uz.telegramId)).toEqual([`📦 <b>Buyurtma #${o.id}</b>\nHolati: <b>Topshirildi</b>\nBuyurtmangiz topshirildi. Xaridingiz uchun rahmat!`]);
      expect(htmlTo(ru.telegramId)).toEqual([`📦 <b>Заказ #${o.id}</b>\nСтатус: <b>Выдан</b>\nВаш заказ выдан. Спасибо за покупку!`]);

      // Kuryer bilan yetkaziladigan (va usuli yozilmagan eski) buyurtmada matn avvalgidek
      for (const deliveryMethod of ['courier', null] as const) {
        const other = await fx.order({ contactPhone: phone, deliveryMethod, status: 'processing' });
        clearOutbox();
        await changeOrderStatus(other.id, 'shipping', bot);
        await changeOrderStatus(other.id, 'delivered', bot);
        expect(htmlTo(uz.telegramId)).toEqual([
          `📦 <b>Buyurtma #${other.id}</b>\nHolati: <b>Yo'lda</b>\nBuyurtmangiz yo'lga chiqdi.`,
          `📦 <b>Buyurtma #${other.id}</b>\nHolati: <b>Yetkazildi</b>\nBuyurtmangiz yetkazildi. Xaridingiz uchun rahmat!`,
        ]);
      }
    });
  });

  describe('setManualPayment', () => {
    it('naqd buyurtma: "to\'lanmagan" → "to\'langan" — tarixga yoziladi va mijozga xabar boradi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'cash', totalAmount: 250000 });

      const r = await setManualPayment(o.id, 'paid', bot);
      expect(r).toMatchObject({ ok: true, changed: true, order: { id: o.id, paymentStatus: 'paid' } });
      expect(await row(o.id)).toMatchObject({ paymentStatus: 'paid', status: 'new_' });
      expect(await events(o.id)).toEqual([{ kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'Test Xodim', via: 'staff_bot' }]);

      expect(outbox.customer).toHaveLength(1);
      expect(outbox.customer[0].to).toBe(c.telegramId);
      expect(outbox.customer[0].html).toContain(`Buyurtma #${o.id}`);
      expect(outbox.customer[0].html).toMatch(/To'lov qabul qilindi: <b>250\s000 so'm<\/b>/);
      // Qo'lda belgilangan to'lov haqida xodimlarga xabar yuborilmaydi (o'zlari belgilagan)
      expect(outbox.staff).toEqual([]);
    });

    it('bank o\'tkazmasi ham qo\'lda belgilanadi; "qaytarilgan" tarixga yoziladi, lekin "to\'lov qabul qilindi" xabari ketmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', paymentStatus: 'paid' });

      expect(await setManualPayment(o.id, 'refunded', admin)).toMatchObject({ ok: true, changed: true });
      expect((await row(o.id)).paymentStatus).toBe('refunded');
      expect(await events(o.id)).toEqual([{ kind: 'payment', fromValue: 'paid', toValue: 'refunded', actor: 'Test Admin', via: 'admin' }]);
      expect(outbox.customer).toEqual([]);
    });

    it('onlayn to\'lov (Payme) qo\'lda o\'zgartirilmaydi: reason "online"', async () => {
      const o = await fx.order({ paymentMethod: 'payme' });
      expect(await setManualPayment(o.id, 'paid', bot)).toMatchObject({ ok: false, reason: 'online', order: { id: o.id, paymentStatus: 'pending' } });
      expect(await row(o.id)).toEqual(o);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);
    });

    it('qiymat o\'sha-o\'sha bo\'lsa: ok, changed=false, tarix ham xabar ham yo\'q', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'paid' });

      expect(await setManualPayment(o.id, 'paid', bot)).toMatchObject({ ok: true, changed: false });
      expect(await row(o.id)).toEqual(o);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);
    });

    it('"To\'landi" ikki marta bosilsa (bir vaqtda) ham bitta tarix yozuvi va mijozga bitta xabar', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'cash' });

      // Qaysi biri oldin yetib borishidan qat'i nazar: bittasi o'zgartiradi, ikkinchisi "conflict" yoki "o'zgarmadi" oladi
      const results = await Promise.all([setManualPayment(o.id, 'paid', bot), setManualPayment(o.id, 'paid', admin)]);
      expect(results.filter((r) => r.ok && r.changed)).toHaveLength(1);
      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(await events(o.id)).toHaveLength(1);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
    });

    it('o\'chirilgan buyurtma: not_found', async () => {
      const o = await fx.order({ deletedAt: new Date() });
      expect(await setManualPayment(o.id, 'paid', bot)).toEqual({ ok: false, reason: 'not_found' });
      expect(await row(o.id)).toEqual(o);
    });

    it('expected: forma ko\'rgan to\'lov holati eskirgan bo\'lsa "conflict" — hech narsa yozilmaydi, hisob-faktura ham yopilmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      // Forma "To'lanmagan" paytida ochilgan; shu orada to'lov "Qaytarilgan" bo'lgan — "To'langan" uning ustidan yozilmaydi
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', paymentStatus: 'refunded', totalAmount: 400000 });
      const open = await fx.invoice({ orderId: o.id, total: 400000, dueDate: new Date(Date.now() + 86_400_000) });

      expect(await setManualPayment(o.id, 'paid', admin, { expected: 'pending' })).toMatchObject({ ok: false, reason: 'conflict', order: { id: o.id, paymentStatus: 'refunded' } });
      expect(await row(o.id)).toEqual(o);
      expect(await invoiceRow(open.id)).toEqual(open);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);

      // Tanlangan qiymat allaqachon joyida — ziddiyat emas; forma hozirgi qiymatni ko'rsatsa odatdagidek saqlanadi
      expect(await setManualPayment(o.id, 'refunded', admin, { expected: 'pending' })).toMatchObject({ ok: true, changed: false });
      expect(await setManualPayment(o.id, 'paid', admin, { expected: 'refunded' })).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });
      expect((await invoiceRow(open.id)).status).toBe('paid');
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
    });

    it('"to\'langan" bo\'lganda buyurtmaning ochiq hisob-fakturalari ham yopiladi; bekor qilinganiga tegilmaydi; pul qaytarilsa ("qaytarilgan") hisob-faktura o\'zgarmaydi va mijozga hech narsa aytilmaydi, keyin "to\'lanmagan"ga o\'tkazilsa avvalgi holatiga ochiladi va mijozga tuzatish boradi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 1000000 });
      const due = new Date(Date.now() - 3 * 86_400_000);
      const partial = await fx.invoice({ orderId: o.id, total: 1000000, paid: 300000, status: 'partial', dueDate: due });
      const legacy = await fx.invoice({ orderId: o.id, total: 50000.5, status: 'overdue', dueDate: due });
      const cancelled = await fx.invoice({ orderId: o.id, total: 70000, status: 'cancelled', dueDate: due });
      const balance = async () => (await customerDebt({ telegramId: c.telegramId, phone, userId: null }))!;
      expect(await balance()).toMatchObject({ total: 750000.5, overdueTotal: 750000.5 });
      const started = Date.now();

      // Bot kartasidagi "To'landi" tugmasi: mijozga "to'lov qabul qilindi" ketadi — o'sha zahoti "Balans"da ham qarz qolmasligi kerak
      expect(await setManualPayment(o.id, 'paid', bot)).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
      expect(await balance()).toMatchObject({ invoices: [], total: 0, overdueTotal: 0 });
      for (const open of [partial, legacy]) {
        const settled = await invoiceRow(open.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(Number(open.totalAmount));
        expect(settled.paidAt!.getTime()).toBeGreaterThanOrEqual(started);
      }
      expect(await invoiceRow(cancelled.id)).toEqual(cancelled);

      // Pul qaytarildi ("qaytarilgan"): bu xato qo'yilgan belgi emas — hisob-fakturaga tegilmaydi, natijada "reopened" ham yo'q,
      // mijozga ham hech narsa aytilmaydi
      const settled = [await invoiceRow(partial.id), await invoiceRow(legacy.id)];
      const refunded = await setManualPayment(o.id, 'refunded', admin);
      expect(refunded).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'refunded' } });
      expect(refunded).not.toHaveProperty('reopened');
      expect(refunded).not.toHaveProperty('stillPaid');
      expect([await invoiceRow(partial.id), await invoiceRow(legacy.id)]).toEqual(settled);
      expect(await balance()).toMatchObject({ invoices: [], total: 0, overdueTotal: 0 });
      expect(paymentMsgs(c.telegramId)).toEqual(['paid']);

      // Keyin "to'lanmagan"ga o'tkazilsa buyurtmadan yana to'lov kutiladi: "to'landi" yopgan hisob-fakturalar avvalgi holatiga qaytadi —
      // aks holda buyurtma "to'lanmagan", hisob-fakturasi "to'langan" bo'lib qolib, qarz hech qayerda ko'rinmasdi. "Qaytarilgan" orqali
      // aylanib kelish ham belgini bekor qilish: oraliq qadamda mijozga hech narsa aytilmagan — tuzatish shu yerda, bir marta boradi
      // (batafsil — pastda, "to'lov belgisini bekor qilish"). Belgi botdan qo'yilgan (xodimlarga e'lon qilinmagan) — ularga karta yo'q
      expect(await setManualPayment(o.id, 'pending', admin)).toMatchObject(undone(2));
      expect(await invoiceRow(partial.id)).toEqual(reopenedAs(partial));
      expect(await invoiceRow(legacy.id)).toEqual(reopenedAs(legacy));
      expect(await invoiceRow(cancelled.id)).toEqual(cancelled);
      expect(await balance()).toMatchObject({ total: 750000.5, overdueTotal: 750000.5 });
      expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.meta !== null])).toEqual([['pending>paid', true], ['paid>refunded', false], ['refunded>pending', true]]);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId, c.telegramId]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
      expect(outbox.customer[1].html).toBe(fixHtml('uz', o.id, true, true));
      expect(outbox.staff).toEqual([]);
    });

    it('to\'lov yozuvi o\'tmasa (orada holat o\'zgargan) hisob-faktura ham yopilmaydi: ikkalasi bitta tranzaksiyada', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 400000 });
      const open = await fx.invoice({ orderId: o.id, total: 400000, dueDate: new Date(Date.now() + 86_400_000) });

      // "To'landi" eski holatni ("to'lanmagan") o'qib, yozishga yetib kelganda qator qulflangan; qulf egasi holatni o'zgartirib bo'shatadi
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const call = setManualPayment(o.id, 'paid', bot);
          await waitForBlocked(tx, 1);
          await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'refunded' } });
          return { call };
        },
        { timeout: 15_000 },
      );
      // Yutqazgan chaqiruvga o'zi boshida o'qigan ("to'lanmagan") emas, bazadagi yangi holat qaytadi
      expect(await held.call).toMatchObject({ ok: false, reason: 'conflict', order: { id: o.id, paymentStatus: 'refunded' } });

      expect((await row(o.id)).paymentStatus).toBe('refunded');
      expect(await invoiceRow(open.id)).toEqual(open);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);
    });
  });

  // Xato qo'yilgan "to'landi" belgisi: buyurtma, shu belgi yopgan hisob-fakturalar va tarix bitta tranzaksiyada qaytadi.
  // Qaysi hisob-faktura qanday holatga qaytishi oxirgi "to'lanmagan" yozuvidan keyingi "to'landi" yozuvlaridagi suratdan (OrderEvent.meta)
  // olinadi. Shundan keyin ham "to'langan" turgan hisob-fakturalar natijada `stillPaid` bo'lib qaytadi — chaqiruvchi xodimga aytadi
  describe('to\'lov belgisini bekor qilish ("to\'langan" → "to\'lanmagan")', () => {
    it('"to\'landi" yopgan hisob-fakturalarning avvalgi holati tarixga yoziladi; bekor qilinganda har biri aynan shu holatga qaytadi va mijozga bitta tuzatish boradi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      // Botga ulangan moliya xodimi bor: bot orqali qo'yilgan belgi ham, uning bekor qilinishi ham xodimlarga e'lon qilinmaydi
      await fx.user({ role: 'manager', telegramId: fx.tg() });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 1000000 });
      const issued = await fx.invoice({ orderId: o.id, total: 400000, dueDate: soon() });
      // Qisman to'langanida to'lov sanasi odatda bo'sh, lekin ustun bor: sana ham millisekundigacha qaytishi kerak
      const partial = await setPaidAt((await fx.invoice({ orderId: o.id, total: 1000000, paid: 300000.5, status: 'partial', dueDate: past() })).id, new Date('2026-09-30T10:20:30.456Z'));
      const overdue = await fx.invoice({ orderId: o.id, total: 50000.5, status: 'overdue', dueDate: past() });
      const cancelled = await fx.invoice({ orderId: o.id, total: 70000, status: 'cancelled', dueDate: past() });
      const balance = async () => (await customerDebt({ telegramId: c.telegramId, phone, userId: null }))!;
      const owed = await balance();
      expect(owed).toMatchObject({ total: 1150000, overdueTotal: 750000 });
      const started = Date.now();

      const paid = await setManualPayment(o.id, 'paid', bot);
      expect(paid).toMatchObject({ ok: true, changed: true, order: { id: o.id, paymentStatus: 'paid' } });
      // "reopened" / "stillPaid" faqat "to'lanmagan"ga qaytarish natijasida bo'ladi
      expect(paid).not.toHaveProperty('reopened');
      expect(paid).not.toHaveProperty('stillPaid');
      for (const inv of [issued, partial, overdue]) {
        const settled = await invoiceRow(inv.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(Number(inv.totalAmount));
        expect(settled.paidAt!.getTime()).toBeGreaterThanOrEqual(started);
      }
      expect(await balance()).toMatchObject({ invoices: [], total: 0, overdueTotal: 0 });
      const [marked, ...more] = await payments(o.id);
      expect(more).toEqual([]);
      expect(marked).toMatchObject({ fromValue: 'pending', toValue: 'paid', actor: 'Test Xodim', via: 'staff_bot' });
      expect(Object.keys(marked.meta as object)).toEqual(['invoices']);
      // Bekor qilingan hisob-faktura yopilmagan — suratga ham kirmaydi
      expect(snapshots(marked.meta)).toEqual([
        { id: issued.id, status: 'issued', paidAmount: '0', paidAt: null },
        { id: partial.id, status: 'partial', paidAmount: '300000.5', paidAt: '2026-09-30T10:20:30.456Z' },
        { id: overdue.id, status: 'overdue', paidAmount: '0', paidAt: null },
      ]);

      // Hammasi qaytdi: "to'langan" turib qolgan hisob-faktura yo'q (bekor qilingani bu ro'yxatga hech qachon kirmaydi)
      const r = await undo(o.id);
      expect(r).toMatchObject({ ...undone(3), order: { id: o.id, paymentStatus: 'pending' } });
      expect(await row(o.id)).toMatchObject({ paymentStatus: 'pending', status: 'new_' });
      for (const inv of [issued, partial, overdue]) expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect(await invoiceRow(cancelled.id)).toEqual(cancelled);
      // Mijozning "Balans"ida qarz yana avvalgidek ko'rinadi
      expect(await balance()).toEqual(owed);
      // Bekor qilish yozuvida qayta ochilgan hisob-fakturalar raqamlari (buyurtma sahifasidagi "Tarix" uchun), suratning o'zi emas;
      // "to'landi" yozuvi (surati bilan) tarixda o'zgarmay qoladi
      expect(await payments(o.id)).toEqual([marked, { fromValue: 'paid', toValue: 'pending', actor: 'Test Xodim', via: 'staff_bot', meta: { reopened: [issued.invoiceNo, partial.invoiceNo, overdue.invoiceNo] } }]);

      // Mijozga: avval "to'lov qabul qilindi", keyin bitta tuzatish — "qabul qilindi" takrorlanmaydi
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId, c.telegramId]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
      const fix = outbox.customer[1];
      expect(fix.html).toBe(fixHtml('uz', o.id));
      // "Buyurtma #N" sarlavhasi ostida "bekor qilindi" so'zi buyurtmaning o'zi bekor qilingandek o'qilardi — matnda u yo'q, uzr bor
      expect(fix.html).not.toContain('bekor qilindi');
      expect(fix.html).toContain("<b>to'lanmagan</b>");
      expect(fix.html).toContain("uzr so'raymiz");
      expect(fix.html).toContain(displayPhone(TEST_SETTINGS.phone));
      expect(fix.inline?.[0][0].callback_data).toBe(`o_${o.id}`);
      // Ikkalasi bitta navbat mavzusida: kechikkan "qabul qilindi" tuzatishdan keyin yetib bormaydi
      expect(sent.topics).toEqual([{ to: c.telegramId, topic: `order-payment:${o.id}` }, { to: c.telegramId, topic: `order-payment:${o.id}` }]);
      expect(outbox.staff).toEqual([]);
    });

    it('tuzatish mijoz tilida ketadi, xabarnomani o\'chirgan mijozga ketmaydi; admin formasidan bekor qilish ham xuddi shunday ishlaydi', async () => {
      const phone = fx.phone();
      const ru = await fx.customer({ phone, lang: 'ru' });
      const silent = await fx.customer({ notify: false });
      const o = await fx.order({ contactPhone: phone, telegramUserId: silent.telegramId, paymentMethod: 'cash', totalAmount: 250000 });
      const inv = await fx.invoice({ orderId: o.id, total: 250000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', admin, { expected: 'pending' });
      clearOutbox();

      // Admin formasi ko'rib turgan qiymatni (prevPaymentStatus) "kutilgan" qilib beradi
      expect(await setManualPayment(o.id, 'pending', admin, { expected: 'paid' })).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect((await payments(o.id)).at(-1)).toEqual({ fromValue: 'paid', toValue: 'pending', actor: 'Test Admin', via: 'admin', meta: { reopened: [inv.invoiceNo] } });
      expect(outbox.customer.map((m) => m.to)).toEqual([ru.telegramId]);
      expect(outbox.customer[0].html).toBe(fixHtml('ru', o.id));
      expect(outbox.customer[0].html).toContain('<b>неоплаченным</b>');
      expect(outbox.customer[0].html).toContain('Приносим извинения');
      expect(outbox.customer[0].html).toContain(displayPhone(TEST_SETTINGS.phone));
    });

    it('bekor qilingan buyurtmada tuzatish xabari to\'lov kutilishini aytmaydi ("hozircha to\'lanmagan" jumlasi yo\'q), uzr esa qoladi — ikki tilda', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      // Buyurtma "to'landi" deb belgilangan, keyin bekor qilingan: belgi xato bo'lgani baribir aytiladi, lekin to'lov endi kutilmaydi
      const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, paymentMethod: 'cash' });
      await setManualPayment(o.id, 'paid', bot);
      await changeOrderStatus(o.id, 'cancelled', admin);
      clearOutbox();

      expect(await undo(o.id)).toMatchObject(undone(0));
      expect(await row(o.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
      expect(htmlTo(uz.telegramId)).toEqual([fixHtml('uz', o.id, false)]);
      expect(htmlTo(ru.telegramId)).toEqual([fixHtml('ru', o.id, false)]);
      for (const m of outbox.customer) {
        expect(m.html).not.toMatch(/to'lanmagan|неоплаченным/);
        expect(m.html).toMatch(/Noqulaylik uchun uzr so'raymiz\.|Приносим извинения за неудобство\./);
        expect(m.inline?.[0][0].callback_data).toBe(`o_${o.id}`);
      }

      // Bekor qilinmagan buyurtmada (qaysi holatda bo'lmasin) jumla joyida
      for (const status of ['new_', 'processing', 'shipping', 'delivered'] as const) {
        const live = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, paymentMethod: 'cash', status, paymentStatus: 'paid' });
        clearOutbox();
        expect(await undo(live.id, admin)).toMatchObject(undone(0));
        expect(htmlTo(uz.telegramId)).toEqual([fixHtml('uz', live.id)]);
        expect(htmlTo(ru.telegramId)).toEqual([fixHtml('ru', live.id)]);
      }
    });

    it('buyurtma belgilanishidan oldin mustaqil to\'langan hisob-faktura (suratda yo\'q) belgi bekor qilingandan keyin ham to\'langan qoladi va natijada `stillPaid` bo\'lib qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 500000 });
      const early = await paidInvoice(o.id, 200000);
      const open = await fx.invoice({ orderId: o.id, total: 300000, paid: 100000, status: 'partial', dueDate: soon() });

      await setManualPayment(o.id, 'paid', admin);
      expect(snapshots((await payments(o.id))[0].meta)).toEqual([{ id: open.id, status: 'partial', paidAmount: '100000', paidAt: null }]);
      expect(await undo(o.id, admin)).toMatchObject(undone(1, [early.invoiceNo]));
      expect(await invoiceRow(early.id)).toEqual(early);
      expect(await invoiceRow(open.id)).toEqual(reopenedAs(open));
      // Tarixga faqat haqiqatan qayta ochilgani yoziladi
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [open.invoiceNo] });

      // Yagona hisob-fakturasi oldindan to'langan buyurtma: "to'landi" hech narsani yopmagan — yozuv suratsiz, qaytariladigan narsa yo'q;
      // bekor qilish yozuvi ham qo'shimchasiz (meta bo'sh)
      const solo = await fx.order({ paymentMethod: 'cash' });
      const settled = await paidInvoice(solo.id, 100000);
      await setManualPayment(solo.id, 'paid', bot);
      expect(await payments(solo.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Xodim', via: 'staff_bot', meta: null }]);
      expect(await undo(solo.id)).toMatchObject(undone(0, [settled.invoiceNo]));
      expect((await row(solo.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(settled.id)).toEqual(settled);
      expect((await payments(solo.id)).at(-1)).toEqual({ fromValue: 'paid', toValue: 'pending', actor: 'Test Xodim', via: 'staff_bot', meta: null });
    });

    it('`stillPaid`: belgi bekor qilingach ham "to\'langan" turgan shu buyurtmaning hisob-fakturalari (raqam tartibida); bekor qilingani ham, qayta ochilgani ham, boshqa buyurtmaniki ham kirmaydi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 900000 });
      const first = await paidInvoice(o.id, 100000);
      const open = await fx.invoice({ orderId: o.id, total: 300000, dueDate: soon() });
      const dropped = await fx.invoice({ orderId: o.id, total: 200000, paid: 200000, status: 'cancelled', dueDate: past() });
      const second = await paidInvoice(o.id, 150000);
      // Belgi yopgan, lekin keyin moliya bekor qilgan hisob-faktura: u endi "to'langan" emas — ro'yxatga kirmaydi
      const voided = await fx.invoice({ orderId: o.id, total: 50000, dueDate: soon() });
      const other = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const foreign = await paidInvoice(other.id, 100000);

      await setManualPayment(o.id, 'paid', bot);
      expect(snapshots((await payments(o.id))[0].meta).map((s) => s.id)).toEqual([open.id, voided.id]);
      const cancelled = await prisma.corporateInvoice.update({ where: { id: voided.id }, data: { status: 'cancelled' } });

      const r = await undo(o.id);
      expect(r).toMatchObject(undone(1, [first.invoiceNo, second.invoiceNo]));
      expect(await invoiceRow(open.id)).toEqual(reopenedAs(open));
      for (const kept of [first, second, dropped, cancelled, foreign]) expect(await invoiceRow(kept.id)).toEqual(kept);
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [open.invoiceNo] });

      // Qayta "to'landi" → bekor qilish: ochiq hisob-faktura yana yopilib-ochiladi, oldindan to'langanlari yana aytiladi
      await setManualPayment(o.id, 'paid', admin);
      expect(await undo(o.id, admin)).toMatchObject(undone(1, [first.invoiceNo, second.invoiceNo]));
      expect(await invoiceRow(open.id)).toEqual(reopenedAs(open));
    });

    it('belgi qo\'yilgandan keyin moliya o\'zgartirgan hisob-fakturaga tegilmaydi: bekor qilingani, qo\'lda qayta ochilgani va o\'chirilgani', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 400000 });
      const [a, b, kept, gone] = [
        await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() }),
        await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() }),
        await fx.invoice({ orderId: o.id, total: 100000, paid: 25000, status: 'partial', dueDate: soon() }),
        await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() }),
      ];
      await setManualPayment(o.id, 'paid', bot);
      expect(snapshots((await payments(o.id))[0].meta).map((s) => s.id)).toEqual([a.id, b.id, kept.id, gone.id]);

      const cancelled = await prisma.corporateInvoice.update({ where: { id: a.id }, data: { status: 'cancelled' } });
      const manual = await prisma.corporateInvoice.update({ where: { id: b.id }, data: { status: 'partial', paidAmount: 1000, paidAt: null } });
      await prisma.corporateInvoice.delete({ where: { id: gone.id } });

      // Faqat hozir ham "to'langan" turgani qaytariladi; qolganlari "to'langan" emas — `stillPaid`ga ham kirmaydi
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [kept.invoiceNo] });
      expect(await invoiceRow(a.id)).toEqual(cancelled);
      expect(await invoiceRow(b.id)).toEqual(manual);
      expect(await invoiceRow(kept.id)).toEqual(reopenedAs(kept));
      expect(await prisma.corporateInvoice.findUnique({ where: { id: gone.id } })).toBeNull();
    });

    it('suratga boshqa buyurtmaning hisob-fakturasi qo\'shib qo\'yilgan bo\'lsa ham unga tegilmaydi', async () => {
      const mine = await fx.order({ paymentMethod: 'bank_transfer' });
      const own = await fx.invoice({ orderId: mine.id, total: 100000, dueDate: soon() });
      const other = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const foreign = await paidInvoice(other.id, 100000);

      await setManualPayment(mine.id, 'paid', bot);
      const event = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: mine.id, kind: 'payment' } });
      const snap = (id: number) => ({ id, status: 'issued', paidAmount: '0', paidAt: null });
      await prisma.orderEvent.update({ where: { id: event.id }, data: { meta: { invoices: [snap(foreign.id), snap(own.id)] } } });

      // Boshqa buyurtmaning to'langan hisob-fakturasi qayta ochilmaydi ham, `stillPaid`da ko'rinmaydi ham
      expect(await undo(mine.id)).toMatchObject(undone(1));
      expect((await payments(mine.id)).at(-1)!.meta).toEqual({ reopened: [own.invoiceNo] });
      expect(await invoiceRow(foreign.id)).toEqual(foreign);
      expect(await row(other.id)).toEqual(other);
      expect(await invoiceRow(own.id)).toEqual(reopenedAs(own));
    });

    it('buzilgan surat (meta) hech narsani qayta ochmaydi va xato tashlamaydi — belgi baribir bekor bo\'ladi, hisob-faktura esa `stillPaid`da aytiladi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const inv = await paidInvoice(o.id, 100000);
      const ok = { id: inv.id, status: 'issued', paidAmount: '0', paidAt: null };
      const without = (key: keyof typeof ok) => Object.fromEntries(Object.entries(ok).filter(([k]) => k !== key));
      const metas: unknown[] = [
        undefined, // ustun bo'sh (shu o'zgarishdan oldingi yozuvlar)
        // meta'ning o'zi kutilgan shaklda emas
        Prisma.JsonNull, 'invoices', 7, true, [ok], {}, { invoice: [ok] }, { invoices: null }, { invoices: 'x' }, { invoices: ok }, { invoices: { 0: ok, length: 1 } },
        // ro'yxatdagi yozuv obyekt emas
        { invoices: [null, 'x', 5, true, [ok], {}] },
        // maydon yetishmaydi
        { invoices: [without('id')] }, { invoices: [without('status')] }, { invoices: [without('paidAmount')] },
        // id butun son emas
        ...[String(inv.id), inv.id + 0.5, null, [inv.id], { id: inv.id }].map((id) => ({ invoices: [{ ...ok, id }] })),
        // holat ochiq hisob-faktura holati emas ("to'langan" yoki "bekor qilingan"ga "qaytarib" bo'lmaydi)
        ...['paid', 'cancelled', 'ISSUED', ' issued', '', null, 1].map((status) => ({ invoices: [{ ...ok, status }] })),
        // summa manfiy, son emas yoki matn emas
        ...['-5', '-0.01', 'abc', '', ' 5', '5 ', '1e3', '1,5', '.5', '5.', '+5', '0x10', 'NaN', 'Infinity', 0, 100.5, null, ['5']].map((paidAmount) => ({ invoices: [{ ...ok, paidAmount }] })),
        // summa ustunga (Decimal(18, 2)) sig'maydi: butun qismi 16 xonadan uzun yoki kasri 2 xonadan ko'p — ilgari shu qiymat
        // bazaning "numeric field overflow" xatosi bilan butun bekor qilish amalini to'xtatardi
        ...['99999999999999999999', '10000000000000000', '12345678901234567.5', '0.001', '5.123'].map((paidAmount) => ({ invoices: [{ ...ok, paidAmount }] })),
      ];

      for (const meta of metas) {
        const label = JSON.stringify(meta) ?? 'meta yo\'q';
        await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } });
        await forgeEvent(o.id, 'paid', meta);
        expect(await undo(o.id, admin), label).toMatchObject(undone(0, [inv.invoiceNo]));
        expect(await invoiceRow(inv.id), label).toEqual(inv);
      }
      expect((await row(o.id)).paymentStatus).toBe('pending');
      // Har aylanishda: qo'lda yozilgan "to'landi" + haqiqiy bekor qilish yozuvi (hech narsa ochilmagan — qo'shimchasiz)
      expect((await payments(o.id)).map((e) => e.toValue)).toEqual(metas.flatMap(() => ['paid', 'pending']));
      expect((await payments(o.id)).filter((e) => e.toValue === 'pending').map((e) => e.meta)).toEqual(metas.map(() => null));
    });

    // Qo'lda tahrirlangan surat: shakli to'g'ri, lekin qiymati ustunga sig'maydi yoki ma'nosiz. Bitta shunday yozuv butun amalni
    // xato bilan to'xtatmasin — aks holda belgini na botdan, na admin paneldan bekor qilib bo'lmay qolardi
    // (`id` ning chegaralari — keyingi testda)
    it('suratdagi chegaralar: ustunga sig\'maydigan summa yozuvi tashlab ketiladi, eng katta sig\'adigani qaytadi; aqlga sig\'maydigan to\'lov sanasi bo\'sh qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const make = () => paidInvoice(o.id, 100000);
      const [huge, wide, fine, max, far, edge, last, epoch, before] = [await make(), await make(), await make(), await make(), await make(), await make(), await make(), await make(), await make()];
      await forgeEvent(o.id, 'paid', { invoices: [
        // Bunday raqamli hisob-faktura yo'q (eng katta mumkin bo'lgan raqam ham): jim tashlab ketiladi
        ...[2147483647, 0, -1].map((id) => ({ id, status: 'issued', paidAmount: '0', paidAt: null })),
        { id: huge.id, status: 'issued', paidAmount: '99999999999999999999', paidAt: null },
        { id: wide.id, status: 'partial', paidAmount: '10000000000000000.00', paidAt: null },
        { id: fine.id, status: 'partial', paidAmount: '0.05', paidAt: '2026-09-30T10:20:30.456Z' },
        { id: max.id, status: 'partial', paidAmount: '9999999999999999.99', paidAt: null },
        { id: far.id, status: 'partial', paidAmount: '40000', paidAt: '+275760-09-13T00:00:00.000Z' },
        { id: edge.id, status: 'issued', paidAmount: '0', paidAt: '2200-01-01T00:00:00.000Z' },
        { id: last.id, status: 'issued', paidAmount: '0', paidAt: '2199-12-31T23:59:59.999Z' },
        { id: epoch.id, status: 'issued', paidAmount: '0', paidAt: '1970-01-01T00:00:00.000Z' },
        { id: before.id, status: 'overdue', paidAmount: '0', paidAt: '1969-12-31T23:59:59.999Z' },
      ] });

      // Xato tashlanmaydi: belgi bekor bo'ladi, sig'maydigan ikki yozuvning hisob-fakturasi "to'langan"ligicha qolib, natijada aytiladi
      expect(await undo(o.id)).toMatchObject(undone(7, [huge.invoiceNo, wide.invoiceNo]));
      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(huge.id)).toEqual(huge);
      expect(await invoiceRow(wide.id)).toEqual(wide);
      expect(await money(fine.id)).toEqual({ status: 'partial', paidAmount: 0.05, paidAt: new Date('2026-09-30T10:20:30.456Z') });
      expect((await invoiceRow(max.id)).paidAmount.toString()).toBe('9999999999999999.99');
      expect(await money(far.id)).toEqual({ status: 'partial', paidAmount: 40000, paidAt: null });
      expect(await money(edge.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      expect(await money(last.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: new Date('2199-12-31T23:59:59.999Z') });
      expect(await money(epoch.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: new Date(0) });
      expect(await money(before.id)).toEqual({ status: 'overdue', paidAmount: 0, paidAt: null });
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [fine, max, far, edge, last, epoch, before].map((i) => i.invoiceNo) });
    });

    // `id` ham ustunga (INT4: 1..2147483647) sig'ishi shart. Kattaroq qiymat "xavfsiz butun son" bo'lsa ham Prisma so'rovni bazaga
    // yubormasdan rad etadi — ilgari bitta shunday yozuv butun amalni xato bilan to'xtatib, belgini umuman bekor qilib bo'lmay qolardi
    it('suratdagi id chegarasi: INT4 ga sig\'maydigan (2147483648, 9007199254740991), nol va manfiy id li yozuv xatosiz tashlab ketiladi — shu ro\'yxatdagi to\'g\'ri yozuv baribir qo\'llanadi; chegaraning o\'zi (2147483647) so\'rovga boradi va hech narsani topmaydi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const [valid, other] = [await paidInvoice(o.id, 100000), await paidInvoice(o.id, 100000)];
      const good = { id: valid.id, status: 'partial', paidAmount: '12345.67', paidAt: '2026-09-30T10:20:30.456Z' };
      const bad = (id: number) => ({ id, status: 'issued', paidAmount: '0', paidAt: null });
      const ids = [
        2147483648, 9007199254740991, 0, -1,
        // Manfiy chegaralar va 32 bitga "o'ralganda" shu buyurtmaning boshqa to'langan hisob-fakturasi raqamiga tushadigan qiymatlar:
        // kesib olinsa `other` noto'g'ri ochilib ketardi
        -2147483648, -2147483649, other.id + 2 ** 32, other.id - 2 ** 32,
        // Chegaraning o'zi ustunga sig'adi: so'rov yuboriladi, bunday raqamli hisob-faktura yo'q — jim
        2147483647,
      ];
      /** Har safar boshidan: buyurtma va hisob-faktura yana "to'langan" (oldingi aylanishning yozuvlari chegaradan oldin qoladi) */
      const again = async (invoices: unknown[]) => {
        await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } });
        await prisma.corporateInvoice.update({ where: { id: valid.id }, data: { status: 'paid', paidAmount: 100000, paidAt: valid.paidAt } });
        await forgeEvent(o.id, 'paid', { invoices });
        // Qiymat bazaga aynan shunday yozilgan va shunday o'qiladi (sinov bo'sh emas): "xavfsiz butun son", lekin ustunga sig'maydi
        expect((await payments(o.id)).at(-1)!.meta).toEqual({ invoices });
      };

      for (const id of ids) {
        const label = `id ${id}`;
        expect(Number.isSafeInteger(id), label).toBe(true);
        await again([bad(id), good, bad(id)]);
        // Xato tashlanmaydi: belgi bekor bo'ladi, to'g'ri yozuvning hisob-fakturasi o'z holatiga qaytadi, boshqasi "to'langan"ligicha aytiladi
        expect(await undo(o.id, admin), label).toMatchObject(undone(1, [other.invoiceNo]));
        expect(await money(valid.id), label).toEqual({ status: 'partial', paidAmount: 12345.67, paidAt: new Date('2026-09-30T10:20:30.456Z') });
        expect(await invoiceRow(other.id), label).toEqual(other);
        expect((await payments(o.id)).at(-1), label).toEqual({ fromValue: 'paid', toValue: 'pending', actor: 'Test Admin', via: 'admin', meta: { reopened: [valid.invoiceNo] } });
      }

      // Hammasi bitta ro'yxatda, to'g'ri yozuv o'rtada — bot tugmasi orqali ham xuddi shunday
      await again([...ids.slice(0, 4).map(bad), good, ...ids.slice(4).map(bad)]);
      expect(await undo(o.id)).toMatchObject(undone(1, [other.invoiceNo]));
      expect(await money(valid.id)).toEqual({ status: 'partial', paidAmount: 12345.67, paidAt: new Date('2026-09-30T10:20:30.456Z') });
      expect(await invoiceRow(other.id)).toEqual(other);

      // Ro'yxatda faqat yaroqsiz id lar: hech narsa ochilmaydi, ikkala hisob-faktura ham "to'langan"ligicha aytiladi
      await again(ids.map(bad));
      const settled = await invoiceRow(valid.id);
      expect(await undo(o.id)).toMatchObject(undone(0, [valid.invoiceNo, other.invoiceNo]));
      expect(await invoiceRow(valid.id)).toEqual(settled);
      expect(await invoiceRow(other.id)).toEqual(other);
      expect((await row(o.id)).paymentStatus).toBe('pending');
    });

    it('bitta buzuq yozuv qolganlariga xalaqit bermaydi; to\'lov sanasi o\'qilmasa hisob-faktura sanasiz qaytariladi; bitta hisob-faktura bir marta qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const [a, b, c, d] = [await paidInvoice(o.id, 100000), await paidInvoice(o.id, 100000), await paidInvoice(o.id, 100000), await paidInvoice(o.id, 100000)];
      await forgeEvent(o.id, 'paid', { invoices: [
        null,
        { id: a.id, status: 'paid', paidAmount: '0', paidAt: null },
        { id: b.id, status: 'partial', paidAmount: '12.5', paidAt: 'kecha' },
        { id: c.id, status: 'overdue', paidAmount: '0' },
        { id: d.id, status: 'issued', paidAmount: '0', paidAt: 1_700_000_000_000 },
        { id: b.id, status: 'issued', paidAmount: '0', paidAt: null },
      ] });

      // Yozuvi buzuq hisob-faktura (a) "to'langan"ligicha qoladi va natijada aytiladi; b ikki marta sanalmaydi
      expect(await undo(o.id)).toMatchObject(undone(3, [a.invoiceNo]));
      expect(await invoiceRow(a.id)).toEqual(a);
      expect(await money(b.id)).toEqual({ status: 'partial', paidAmount: 12.5, paidAt: null });
      expect(await money(c.id)).toEqual({ status: 'overdue', paidAmount: 0, paidAt: null });
      expect(await money(d.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [b.invoiceNo, c.invoiceNo, d.invoiceNo] });
    });

    // ─── Chegara qoidasi: oxirgi "to'lanmagan" yozuvidan keyingi HAMMA "to'landi" yozuvlari (yangisidan boshlab) ───────────

    it('chegara qoidasi: "to\'landi" (surat bilan) → "qaytarilgan" → … → yana "to\'landi" → bekor qilish — orada "qaytarilgan" bo\'lib o\'tgan bo\'lsa ham surat yo\'qolmaydi, hisob-faktura avvalgi holatiga ochiladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      // Ikki yo'l: "qaytarilgan"dan to'g'ridan-to'g'ri "to'landi"ga va oraliqda "to'lanmagan" orqali
      for (const viaPending of [false, true]) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 300000 });
        const inv = await fx.invoice({ orderId: o.id, total: 300000, paid: 120000, status: 'partial', dueDate: soon() });
        const snapshot = { invoices: [{ id: inv.id, status: 'partial', paidAmount: '120000', paidAt: null }] };
        const reopenedMeta = { reopened: [inv.invoiceNo] };
        clearOutbox();

        await setManualPayment(o.id, 'paid', bot);
        const settled = await invoiceRow(inv.id);
        // Pul qaytarildi: xato belgi emas — hisob-faktura yopiqligicha, tuzatish xabari ham yo'q
        const refunded = await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
        expect(refunded).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'refunded' } });
        expect(refunded).not.toHaveProperty('reopened');
        expect(await invoiceRow(inv.id)).toEqual(settled);
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
        if (viaPending) {
          // "Qaytarilgan" → "to'lanmagan": hisob-faktura shu yerning o'zida ochiladi, mijozga tuzatish ham shu yerda boradi
          // va bu yozuv yangi chegara bo'ladi
          expect(await setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(1));
          expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
          expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
        }

        // Yana "to'landi". To'g'ridan-to'g'ri yo'lda yopiladigan ochiq hisob-faktura yo'q — yozuv suratsiz (birinchi surat chegaradan
        // keyin turibdi); "to'lanmagan" orqali o'tgan yo'lda hisob-faktura yana yopiladi — yangi surat bilan
        expect(await setManualPayment(o.id, 'paid', bot)).toMatchObject({ ok: true, changed: true });
        expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 300000 });
        expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.meta])).toEqual(viaPending
          ? [['pending>paid', snapshot], ['paid>refunded', null], ['refunded>pending', reopenedMeta], ['pending>paid', snapshot]]
          : [['pending>paid', snapshot], ['paid>refunded', null], ['refunded>paid', null]]);

        // Bekor qilish: suratsiz oxirgi yozuv to'sib qo'ymaydi — chegaradan keyingi "to'landi" yozuvlarining hammasi ko'riladi
        expect(await undo(o.id)).toMatchObject(undone(1));
        expect((await row(o.id)).paymentStatus).toBe('pending');
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect((await payments(o.id)).at(-1)).toEqual({ fromValue: 'paid', toValue: 'pending', actor: 'Test Xodim', via: 'staff_bot', meta: reopenedMeta });
        // Har bir "qabul qilindi"dan keyin o'z tuzatishi: to'g'ridan-to'g'ri yo'lda ikki "qabul qilindi"ga bitta tuzatish (oraliq
        // "qaytarilgan" qadamida hech narsa aytilmagan), "to'lanmagan" orqali o'tgan yo'lda har biriga bittadan
        expect(paymentMsgs(c.telegramId)).toEqual(viaPending ? ['paid', 'reverted', 'paid', 'reverted'] : ['paid', 'paid', 'reverted']);
      }
    });

    // ─── "Qaytarilgan" orqali aylanib kelish ("to'langan" → "qaytarilgan" → "to'lanmagan") ham belgini bekor qilish ─────────────
    // Oraliq qadamda hisob-faktura ham ochilmagan, mijozga ham hech narsa aytilmagan: ikkalasi "to'lanmagan"ga o'tkazilganda bajariladi.
    // Belgi qilib oxirgi "to'lanmagan" yozuvidan keyin "to'landi" yozuvi borligi olinadi — bo'lmasa (to'lanmagan → qaytarilgan →
    // to'lanmagan) mijoz "to'lov qabul qilindi" xabarini olmagan yoki tuzatishi allaqachon borgan: hech narsa yuborilmaydi

    it('"to\'langan" → "qaytarilgan" → "to\'lanmagan": hisob-faktura qayta ochiladi va mijozga BITTA tuzatish boradi; xodimlarga tuzatish kartasi — faqat to\'lov hisob-faktura sahifasidan qabul qilingan (ularga e\'lon qilingan) bo\'lsa; keyingi "qaytarilgan" → "to\'lanmagan" aylanishi jim', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      const balance = async () => (await customerDebt({ telegramId: c.telegramId, phone, userId: null }))!;
      // Belgi botdan, admin formasidan va hisob-faktura sahifasidan (xodimlarga e'lon qilinadigan yo'l: "To'liq to'landi" va oxirgi
      // qisman to'lov) qo'yilgan; "to'lanmagan"ga qaytargan xodim — admin formasi yoki bot
      for (const [how, undoer] of [['bot', admin], ['admin', bot], ['markPaid', bot], ['registerPartial', admin]] as const) {
        const other = undoer === admin ? bot : admin;
        const announced = how === 'markPaid' || how === 'registerPartial';
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 700000 });
        const inv = await fx.invoice({ orderId: o.id, total: 700000, paid: 50000, status: 'partial', dueDate: soon() });
        clearSent();

        if (how === 'markPaid') expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
        else if (how === 'registerPartial') expect(await run(registerPartial, { id: String(inv.id), amount: '650000' })).toBe(`/admin/invoices/${inv.id}?saved=1`);
        else await setManualPayment(o.id, 'paid', how === 'bot' ? bot : admin);
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
        for (const u of [manager, worker]) expect(cardsTo(u).map(noteOf)).toEqual(announced ? [paidNote('Test Moliya')] : []);

        // Pul qaytarildi: hisob-faktura yopiqligicha, mijozga ham, xodimlarga ham yangi xabar yo'q
        await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
        expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 700000 });
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
        expect(cardsTo(manager)).toHaveLength(announced ? 1 : 0);
        clearSent();

        // "Qaytarilgan" → "to'lanmagan": hisob-faktura belgi qo'yilishidan oldingi holatiga ochiladi, mijozga bitta tuzatish boradi
        expect(await setManualPayment(o.id, 'pending', undoer, { expected: 'refunded' })).toMatchObject(undone(1));
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);
        expect(outbox.customer[0].html).toBe(fixHtml('uz', o.id, true, true));
        expect(outbox.customer[0].inline?.[0][0].callback_data).toBe(`o_${o.id}`);
        // "Qabul qilindi" bilan bitta navbat mavzusida: kechikkan "qabul qilindi" tuzatishdan keyin yetib bormaydi
        expect(sent.topics).toEqual([{ to: c.telegramId, topic: paymentTopic(o.id) }]);
        if (announced) {
          // Chatida "To'lov qabul qilindi" kartasi qolgan xodimlarga ham: kartada kim "to'lanmagan"ga qaytargani va buyurtmaning hozirgi holati
          for (const u of [manager, worker]) {
            expect(cardsTo(u).map(noteOf)).toEqual([revertedCardNote(undoer.name)]);
            expect(cardsTo(u)[0].html).toContain(`<b>Buyurtma #${o.id}</b>`);
            expect(cardsTo(u)[0].html).toContain("Bank o'tkazmasi · To'lanmagan");
            expect(cardsTo(u)[0].html).toContain(`🧾 ${inv.invoiceNo}`);
            expect(cardTopicsTo(u)).toEqual([paymentTopic(o.id)]);
          }
          // «To'landi» tugmasi moliya xodimida yana bor; belgini bekor qilish (ou_) tugmasi hech kimda yo'q
          expect(callbacks(cardsTo(manager)[0])).toEqual([`os_${o.id}_processing`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
          expect(callbacks(cardsTo(worker)[0])).toEqual([`os_${o.id}_processing`, `oc_${o.id}`, `or_${o.id}`]);
        } else {
          // Bot yoki admin formasidan qo'yilgan belgi xodimlarga e'lon qilinmagan — tuzatishi ham faqat mijozga
          expect(outbox.staff).toEqual([]);
        }

        // Ikkinchi aylanish ("to'lanmagan" → "qaytarilgan" → "to'lanmagan"): hisob-faktura ochiq turibdi, qaytariladigan narsa ham,
        // aytiladigan gap ham qolmagan — tuzatish takrorlanmaydi
        clearSent();
        await setManualPayment(o.id, 'refunded', admin, { expected: 'pending' });
        expect(await setManualPayment(o.id, 'pending', other, { expected: 'refunded' })).toMatchObject(undone(0));
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect(outbox.customer).toEqual([]);
        expect(outbox.staff).toEqual([]);

        expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
          ['pending>paid', how === 'bot' ? 'staff_bot' : how === 'admin' ? 'admin' : 'invoice', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '50000', paidAt: null }] }],
          ['paid>refunded', 'admin', null],
          ['refunded>pending', undoer.via, { reopened: [inv.invoiceNo] }],
          ['pending>refunded', 'admin', null],
          ['refunded>pending', other.via, null],
        ]);
        // Qarz mijozning "Balans"ida yana ko'rinadi
        expect((await balance()).invoices.filter((i) => i.orderId === o.id)).toMatchObject([{ invoiceNo: inv.invoiceNo, total: 700000, paid: 50000, remaining: 650000 }]);
      }
    });

    it('"qaytarilgan" → "to\'lanmagan": oraliqda yana "to\'landi" bo\'lgan bo\'lsa ham (to\'landi → qaytarilgan → to\'landi → qaytarilgan) bitta tuzatish; e\'lon qilingan to\'lov shu oraliqda bo\'lsa xodimlarga ham boradi; surati yo\'q eski belgida hisob-faktura `stillPaid`da qoladi, tuzatish esa baribir ketadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });

      // 1) Hisob-faktura sahifasidan to'langan (e'lon qilingan) → qaytarilgan → botdan yana "to'landi" → qaytarilgan → to'lanmagan:
      // oxirgi "to'lanmagan"dan beri ikkala "to'landi" ham hisobga kiradi — hisob-faktura birinchisining suratidan ochiladi
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 400000 });
      const inv = await fx.invoice({ orderId: o.id, total: 400000, paid: 150000, status: 'partial', dueDate: soon() });
      expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
      await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
      await setManualPayment(o.id, 'paid', bot, { expected: 'refunded' });
      await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
      // Shu paytgacha: ikki "qabul qilindi" (mijozga), bitta karta (xodimga — faqat hisob-faktura sahifasidagi to'lov); tuzatish yo'q
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'paid']);
      expect(cardsTo(manager).map(noteOf)).toEqual([paidNote('Test Moliya')]);
      clearSent();

      expect(await setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', o.id, true, true)]);
      expect(cardsTo(manager).map(noteOf)).toEqual([revertedCardNote('Test Admin')]);
      expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
        ['pending>paid', 'invoice', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '150000', paidAt: null }] }],
        ['paid>refunded', 'admin', null],
        ['refunded>paid', 'staff_bot', null],
        ['paid>refunded', 'admin', null],
        ['refunded>pending', 'admin', { reopened: [inv.invoiceNo] }],
      ]);

      // 2) Yangilanishdan oldin qo'yilgan belgi (tarix yozuvi suratsiz), keyin "qaytarilgan": hisob-faktura avtomatik ochilmaydi va
      // `stillPaid`da aytiladi, lekin mijoz "qabul qilindi" xabarini olgan — tuzatish baribir boradi; xodimlarga e'lon qilinmagan
      const legacy = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'refunded', totalAmount: 100000 });
      const settled = await paidInvoice(legacy.id, 100000);
      await forgeEvent(legacy.id, 'paid');
      await forgeEvent(legacy.id, 'refunded', undefined, { fromValue: 'paid' });
      clearSent();
      expect(await setManualPayment(legacy.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(0, [settled.invoiceNo]));
      expect(await invoiceRow(settled.id)).toEqual(settled);
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', legacy.id, true, true)]);
      expect(outbox.staff).toEqual([]);
      expect((await payments(legacy.id)).at(-1)).toEqual({ fromValue: 'refunded', toValue: 'pending', actor: 'Test Admin', via: 'admin', meta: null });
    });

    it('bekor qilingan buyurtma "qaytarilgan" orqali "to\'lanmagan"ga qaytarilganda ham tuzatish boradi, lekin to\'lov kutilishi aytilmaydi ("hozircha to\'lanmagan" jumlasi yo\'q), sabab va uzr ham yo\'q (pul haqiqatan qaytarilgan bo\'lishi mumkin) — ikki tilda; e\'lon qilingan to\'lovda xodimlarga karta ham', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const balance = async () => (await customerDebt({ telegramId: uz.telegramId, phone, userId: null }))!;

      // Belgi botdan va hisob-faktura sahifasidan qo'yilgan. Odatiy ketma-ketlik: to'landi → buyurtma bekor qilindi → pul qaytarildi
      // ("qaytarilgan") → to'lov "to'lanmagan"ga tuzatildi
      for (const how of ['bot', 'invoice'] as const) {
        const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, paymentMethod: 'bank_transfer', totalAmount: 300000 });
        const inv = await fx.invoice({ orderId: o.id, total: 300000, dueDate: soon() });
        if (how === 'invoice') expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
        else await setManualPayment(o.id, 'paid', bot);
        await changeOrderStatus(o.id, 'cancelled', admin);
        await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
        clearSent();

        expect(await setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(1));
        expect(await row(o.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect(htmlTo(uz.telegramId)).toEqual([fixHtml('uz', o.id, false, true)]);
        expect(htmlTo(ru.telegramId)).toEqual([fixHtml('ru', o.id, false, true)]);
        expect(outbox.customer).toHaveLength(2);
        for (const m of outbox.customer) {
          expect(m.html).not.toMatch(/to'lanmagan|неоплаченным/);
          expect(m.html).not.toMatch(/xato|uzr|ошибке|извинения/);
          expect(m.inline?.[0][0].callback_data).toBe(`o_${o.id}`);
        }
        expect(sent.topics.map((t) => t.topic)).toEqual([paymentTopic(o.id), paymentTopic(o.id)]);
        if (how === 'invoice') {
          expect(cardsTo(manager).map(noteOf)).toEqual([revertedCardNote('Test Admin')]);
          expect(cardsTo(manager)[0].html).toContain(`<b>Buyurtma #${o.id}</b> · Bekor qilingan`);
          // Bekor qilingan buyurtmada «To'landi» tugmasi ham, holat tugmalari ham yo'q
          expect(callbacks(cardsTo(manager)[0])).toEqual([`or_${o.id}`]);
        } else {
          expect(outbox.staff).toEqual([]);
        }
        // Bekor qilingan buyurtmaning ochilgan hisob-fakturasi mijozning "Balans"ida qarz bo'lib ko'rinmaydi (xabardagi gap bilan bir xil)
        expect((await balance()).invoices.filter((i) => i.orderId === o.id)).toEqual([]);
      }
    });

    it('"to\'lanmagan" → "qaytarilgan" → "to\'lanmagan" (oxirgi "to\'lanmagan"dan beri "to\'landi" bo\'lmagan): hech narsa ochilmaydi, mijozga ham, xodimlarga ham hech narsa ketmaydi — oldingi belgi (bot, hisob-faktura sahifasi yoki "qaytarilgan" orqali) allaqachon bekor qilinib, tuzatishi borib bo\'lgan bo\'lsa ham', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      for (const before of ['none', 'bot', 'invoice', 'refund'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 400000 });
        const open = await fx.invoice({ orderId: o.id, total: 300000, paid: 20000, status: 'partial', dueDate: soon() });
        const early = await paidInvoice(o.id, 100000);
        // Oldingi belgi qo'yilib, bekor qilingan: surati ham, "xodimlarga e'lon qilingan" belgisi ham chegaradan (o'sha bekor qilish
        // yozuvidan) oldin qoladi; mijoz tuzatishni o'shanda olgan
        if (before === 'bot') {
          await setManualPayment(o.id, 'paid', bot);
          expect(await undo(o.id)).toMatchObject(undone(1, [early.invoiceNo]));
        } else if (before === 'invoice') {
          expect(await run(markPaid, { id: String(open.id) })).toBe(`/admin/invoices/${open.id}?saved=1`);
          expect(await undo(o.id, admin)).toMatchObject(undone(1, [early.invoiceNo]));
          expect(cardsTo(manager).map(noteOf)).toEqual([paidNote('Test Moliya'), revertedCardNote('Test Admin')]);
        } else if (before === 'refund') {
          expect(await run(markPaid, { id: String(open.id) })).toBe(`/admin/invoices/${open.id}?saved=1`);
          await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
          expect(await setManualPayment(o.id, 'pending', bot, { expected: 'refunded' })).toMatchObject(undone(1, [early.invoiceNo]));
          expect(cardsTo(manager).map(noteOf)).toEqual([paidNote('Test Moliya'), revertedCardNote('Test Xodim')]);
        }
        expect(paymentMsgs(c.telegramId)).toEqual(before === 'none' ? [] : ['paid', 'reverted']);
        /** Buyurtmaning to'lov holati va ikkala hisob-fakturaning HAMMA ustuni (updatedAt ham: ularga umuman yozilmasligi kerak) */
        const snap = async () => ({ payment: (await row(o.id)).paymentStatus, open: await invoiceRow(open.id), early: await invoiceRow(early.id) });
        const state = await snap();
        expect(state).toMatchObject({ payment: 'pending', open: { status: 'partial' }, early: { status: 'paid' } });
        expect(Number(state.open.paidAmount)).toBe(20000);
        const base = (await payments(o.id)).length;

        for (const actor of [admin, bot]) {
          clearSent();
          const refunded = await setManualPayment(o.id, 'refunded', actor, { expected: 'pending' });
          expect(refunded).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'refunded' } });
          expect(refunded).not.toHaveProperty('reopened');
          // Ochiladigan narsa yo'q; alohida to'langan hisob-faktura har doimgidek `stillPaid`da aytiladi
          expect(await setManualPayment(o.id, 'pending', actor, { expected: 'refunded' })).toMatchObject(undone(0, [early.invoiceNo]));
          expect(await snap()).toEqual(state);
          expect(outbox.customer).toEqual([]);
          expect(outbox.staff).toEqual([]);
          expect(sent.topics).toEqual([]);
          expect(sent.staffTopics).toEqual([]);
        }
        expect((await payments(o.id)).slice(base).map((e) => [`${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
          ['pending>refunded', 'admin', null], ['refunded>pending', 'admin', null], ['pending>refunded', 'staff_bot', null], ['refunded>pending', 'staff_bot', null],
        ]);
      }
    });

    it('"qaytarilgan" buyurtmani ikki xodim bir vaqtda "to\'lanmagan"ga qaytarsa faqat bittasi o\'tadi: hisob-faktura bir marta ochiladi, mijozga bitta tuzatish, xodimlarga bitta karta', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 500000 });
      const inv = await fx.invoice({ orderId: o.id, total: 500000, paid: 120000, status: 'partial', dueDate: soon() });
      expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
      await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
      clearSent();

      // Ikkalasi ham "qaytarilgan"ni o'qib, yozishga yetib kelgandagina qo'yib yuboriladi
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const race = Promise.all([setManualPayment(o.id, 'pending', bot, { expected: 'refunded' }), setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })]);
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const results = await held.race;

      const won = results.flatMap((r) => (r.ok && r.changed ? [r] : []));
      const lost = results.flatMap((r) => (r.ok ? [] : [r]));
      expect(won).toHaveLength(1);
      expect(won[0]).toMatchObject(undone(1));
      expect(lost).toHaveLength(1);
      expect(lost[0]).toMatchObject({ reason: 'conflict', order: { id: o.id, paymentStatus: 'pending' } });
      expect(lost[0]).not.toHaveProperty('reopened');

      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      const winner = results[0].ok ? bot : admin;
      expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.via, e.meta !== null])).toEqual([['pending>paid', 'invoice', true], ['paid>refunded', 'admin', false], ['refunded>pending', winner.via, true]]);
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', o.id, true, true)]);
      expect(cardsTo(manager).map(noteOf)).toEqual([revertedCardNote(winner.name)]);
    });

    it('"qaytarilgan" buyurtma bir vaqtda "to\'lanmagan"ga va yana "to\'langan"ga o\'tkazilsa bittasi o\'tadi: tuzatish va hisob-fakturaning ochilishi — faqat "to\'lanmagan" yutganda, aks holda mijozga odatdagi "qabul qilindi"', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      // Qulf navbatiga qaysi biri oldin turgan bo'lsa o'sha yutadi — ikkala natija ham tekshiriladi
      for (const first of ['pending', 'paid'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 600000 });
        const inv = await fx.invoice({ orderId: o.id, total: 600000, paid: 90000, status: 'partial', dueDate: soon() });
        await setManualPayment(o.id, 'paid', bot);
        await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
        const settled = await invoiceRow(inv.id);
        clearSent();

        const calls = {
          pending: () => setManualPayment(o.id, 'pending', admin, { expected: 'refunded' }),
          paid: () => setManualPayment(o.id, 'paid', bot, { expected: 'refunded' }),
        };
        // Ikkalasi ham "qaytarilgan"ni o'qib, yozishga yetib kelgan; qator qulfini birinchi bo'lib `first` kutyapti
        const held = await prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
            const one = calls[first]();
            await waitForBlocked(tx, 1);
            const two = calls[first === 'pending' ? 'paid' : 'pending']();
            await waitForBlocked(tx, 2);
            return first === 'pending' ? { back: one, again: two } : { back: two, again: one };
          },
          { timeout: 15_000 },
        );
        const [back, again] = [await held.back, await held.again];

        expect(back.ok && back.changed).toBe(first === 'pending');
        expect(again.ok && again.changed).toBe(first === 'paid');
        const lost = [back, again].flatMap((r) => (!r.ok && r.reason === 'conflict' ? [r] : []));
        expect(lost).toHaveLength(1);
        const final = (await row(o.id)).paymentStatus;
        expect(final).toBe(first);
        // Yutqazganiga bazadagi yangi holat qaytadi (o'zi boshida o'qigan "qaytarilgan" emas), hisob-faktura natijasisiz
        expect(lost[0].order?.paymentStatus).toBe(final);
        expect(lost[0]).not.toHaveProperty('reopened');
        if (back.ok) expect(back).toMatchObject(undone(1));
        else expect(again).not.toHaveProperty('reopened');
        // "To'langan" yutsa hisob-faktura yopiqligicha (yopadigan narsa yo'q edi — yozuvi suratsiz), "to'lanmagan" yutsa suratdagi holatiga ochiladi
        expect(await invoiceRow(inv.id)).toEqual(first === 'pending' ? reopenedAs(inv) : settled);
        expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.meta])).toEqual([
          ['pending>paid', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '90000', paidAt: null }] }],
          ['paid>refunded', null],
          [`refunded>${final}`, first === 'pending' ? { reopened: [inv.invoiceNo] } : null],
        ]);
        expect(paymentMsgs(c.telegramId)).toEqual([first === 'pending' ? 'reverted' : 'paid']);
        expect(outbox.staff).toEqual([]);

        // "To'langan" yutgan bo'lsa, yutqazgan xodim yangilangan sahifadan belgini odatdagidek bekor qiladi: hisob-faktura birinchi
        // belgining suratidan ochiladi (oxirgi "to'lanmagan"dan beri ikkala "to'landi" ham hisobda), tuzatish bir marta boradi
        if (first === 'paid') {
          expect(await undo(o.id, admin)).toMatchObject(undone(1));
          expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
          expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
        }
      }
    });

    it('chegaradan oldingi surat qayta ishlatilmaydi: belgi bekor qilingach hisob-faktura alohida to\'langan, keyin qo\'yilgan suratsiz "to\'landi" bekor qilinsa u to\'langanligicha qoladi (`stillPaid`)', async () => {
      // Naqd buyurtma: hisob-faktura sahifasidagi "To'liq to'landi" buyurtmaga tegmaydi — hisob-faktura mustaqil yopiladi
      const o = await fx.order({ paymentMethod: 'cash', totalAmount: 200000 });
      const inv = await fx.invoice({ orderId: o.id, total: 200000, dueDate: soon() });
      const s1 = { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] };

      await setManualPayment(o.id, 'paid', bot);
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));

      expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
      const settled = await invoiceRow(inv.id);
      expect(settled.status).toBe('paid');
      expect((await row(o.id)).paymentStatus).toBe('pending');

      // Ikkinchi "to'landi" hech narsani yopmagan (yozuvi suratsiz). Uni bekor qilish birinchi belgining suratiga qaytmaydi:
      // o'sha surat chegaradan (birinchi bekor qilish yozuvidan) oldin qolgan — alohida qabul qilingan to'lov yo'qolib ketmaydi
      await setManualPayment(o.id, 'paid', admin);
      expect(await undo(o.id, admin)).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(settled);
      expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.meta])).toEqual([
        ['pending>paid', s1], ['paid>pending', { reopened: [inv.invoiceNo] }], ['pending>paid', null], ['paid>pending', null],
      ]);
    });

    // Sahifadagi «Qayta ochish» "qaytarilgan" buyurtmada endi rad etadi, shuning uchun bu holat (oxirgi "to'lanmagan"dan keyin ikki
    // "to'landi" yozuvi bitta hisob-fakturani ko'rsatadi) amallar ketma-ketligi bilan paydo bo'lmaydi — faqat bazada qo'lda tuzatilgan
    // hisob-faktura bilan. Qoida esa (yangi surat olinadi, eskisi tashlab ketiladi) himoya sifatida qoladi: pastdagi BITTA qadam
    // QO'LDA YASALGAN (to'g'ridan-to'g'ri bazada), ikkala "to'landi" yozuvi va ularning suratlari esa haqiqiy amallardan
    it('chegaradan keyingi ikki "to\'landi" yozuvi bitta hisob-fakturani ko\'rsatsa yangisi olinadi: orada (qo\'lda, bazada) qayta ochilib kiritilgan qisman to\'lov saqlanadi, eski surat ustidan yozilmaydi', async () => {
      for (const second of ['form', 'invoice'] as const) {
        const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 900000 });
        const inv = await fx.invoice({ orderId: o.id, total: 900000, dueDate: soon() });
        const id = String(inv.id);

        await setManualPayment(o.id, 'paid', bot); // surat: "berilgan", 0
        await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
        // Buyurtma "qaytarilgan" turganda sahifadagi «Qayta ochish» rad etadi: hisob-faktura ham, tarix ham o'zgarmaydi
        const settled = await invoiceRow(inv.id);
        expect(await run(reopenInvoice, { id })).toBe(`/admin/invoices/${inv.id}?error=state`);
        expect(await invoiceRow(inv.id)).toEqual(settled);
        // QO'LDA YASALGAN QADAM: hisob-faktura to'g'ridan-to'g'ri bazada ochilgan (amal emas — tarixga ham yozilmagan)
        await prisma.corporateInvoice.update({ where: { id: inv.id }, data: { status: 'issued', paidAmount: 0, paidAt: null } });
        // Shundan keyin moliya hisob-faktura sahifasida 250 000 qisman to'lov kiritdi (haqiqiy amal)
        expect(await run(registerPartial, { id, amount: '250000' })).toBe(`/admin/invoices/${inv.id}?saved=1`);
        const part = await invoiceRow(inv.id);
        expect(await money(inv.id)).toEqual({ status: 'partial', paidAmount: 250000, paidAt: null });
        // Yana "to'landi" ("qaytarilgan"dan — orada "to'lanmagan" yozuvi yo'q): surat — "qisman", 250 000. Admin formasidan ham,
        // hisob-faktura sahifasidagi "To'liq to'landi"dan ham
        if (second === 'form') await setManualPayment(o.id, 'paid', admin, { expected: 'refunded' });
        else expect(await run(markPaid, { id })).toBe(`/admin/invoices/${inv.id}?saved=1`);
        expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 900000 });
        expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
          ['pending>paid', 'staff_bot', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] }],
          ['paid>refunded', 'admin', null],
          ['refunded>paid', second === 'form' ? 'admin' : 'invoice', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '250000', paidAt: null }] }],
        ]);

        // Ikkala surat ham chegaradan keyin. Yangisidan boshlanadi: hisob-faktura "qisman, 250 000"ga qaytadi, shundan keyin u
        // "to'langan" emas — eski surat ("berilgan", 0) tashlab ketiladi. Bitta hisob-faktura bir marta sanaladi
        expect(await undo(o.id)).toMatchObject(undone(1));
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(part));
        expect((await payments(o.id)).at(-1)!.meta).toEqual({ reopened: [inv.invoiceNo] });
        // Rad etilgan «Qayta ochish» tarixga hech narsa yozmagan: faqat to'lov yozuvlari
        expect((await events(o.id)).map((e) => `${e.kind}:${e.fromValue}>${e.toValue}`)).toEqual(['payment:pending>paid', 'payment:paid>refunded', 'payment:refunded>paid', 'payment:paid>pending']);
      }
    });

    it('"to\'lanmagan" → "qaytarilgan" → "to\'lanmagan": chegaradan keyin "to\'landi" yozuvi yo\'q — hech bir hisob-fakturaga tegilmaydi, eski surat ham ishlatilmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      await fx.user({ role: 'manager', telegramId: fx.tg() });

      // 1) To'lov tarixi umuman yo'q buyurtma: alohida to'langan, ochiq va bekor qilingan hisob-fakturalar o'z holida
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 600000 });
      const settled = await paidInvoice(o.id, 100000);
      const open = await fx.invoice({ orderId: o.id, total: 300000, paid: 10000, status: 'partial', dueDate: soon() });
      const cancelled = await fx.invoice({ orderId: o.id, total: 200000, status: 'cancelled', dueDate: past() });
      const refunded = await setManualPayment(o.id, 'refunded', admin, { expected: 'pending' });
      expect(refunded).toMatchObject({ ok: true, changed: true });
      expect(refunded).not.toHaveProperty('reopened');
      expect(await setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(0, [settled.invoiceNo]));
      for (const inv of [settled, open, cancelled]) expect(await invoiceRow(inv.id)).toEqual(inv);
      expect(await payments(o.id)).toEqual([
        { fromValue: 'pending', toValue: 'refunded', actor: 'Test Admin', via: 'admin', meta: null },
        { fromValue: 'refunded', toValue: 'pending', actor: 'Test Admin', via: 'admin', meta: null },
      ]);

      // 2) Avval belgi qo'yilib bekor qilingan (surat chegaradan oldin qolgan), hisob-faktura keyin alohida to'langan
      const again = await fx.order({ contactPhone: phone, paymentMethod: 'cash', totalAmount: 100000 });
      const inv = await fx.invoice({ orderId: again.id, total: 100000, dueDate: soon() });
      await setManualPayment(again.id, 'paid', bot);
      expect(await undo(again.id)).toMatchObject(undone(1));
      expect(await run(markPaid, { id: String(inv.id) })).toBe(`/admin/invoices/${inv.id}?saved=1`);
      const paid = await invoiceRow(inv.id);
      clearOutbox();
      await setManualPayment(again.id, 'refunded', admin, { expected: 'pending' });
      expect(await setManualPayment(again.id, 'pending', bot, { expected: 'refunded' })).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(paid);
      expect((await payments(again.id)).at(-1)).toEqual({ fromValue: 'refunded', toValue: 'pending', actor: 'Test Xodim', via: 'staff_bot', meta: null });

      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);
    });

    it('tarixdan tashqari "to\'langan" bo\'lib qolgan buyurtmada ham chegaradan keyingi "to\'landi" surati ishlatiladi; "to\'landi" bo\'lmagan yozuvdagi surat esa hech qachon ishlatilmaydi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer' });
      const inv = await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      await setManualPayment(o.id, 'refunded', admin);
      // Buyurtma tarixga yozilmasdan yana "to'langan" bo'lib qolgan (bazada qo'lda tuzatilgan): oxirgi to'lov yozuvi — "qaytarilgan"
      await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } });

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect((await payments(o.id)).map((e) => `${e.fromValue}>${e.toValue}`)).toEqual(['pending>paid', 'paid>refunded', 'paid>pending']);

      // Hisob-faktura keyin alohida to'langan. "To'landi" bo'lmagan yozuvda surat turgan bo'lsa ham (qo'lda tahrirlangan) u ishlatilmaydi;
      // yuqoridagi bekor qilishdan (chegaradan) oldingi "to'landi" surati ham qayta ishlatilmaydi
      const settled = await prisma.corporateInvoice.update({ where: { id: inv.id }, data: { status: 'paid', paidAmount: 100000, paidAt: new Date('2026-10-01T09:00:00.000Z') } });
      await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } });
      await forgeEvent(o.id, 'refunded', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] }, { fromValue: 'paid' });
      expect(await undo(o.id)).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(settled);
    });

    it('shu o\'zgarishdan oldin "to\'langan" bo\'lgan buyurtma (tarix yozuvi suratsiz yoki umuman yo\'q): belgi bekor bo\'ladi, hisob-faktura yopiqligicha qoladi va `stillPaid`da aytiladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      for (const withEvent of [true, false]) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'paid' });
        const inv = await paidInvoice(o.id, 100000);
        if (withEvent) await forgeEvent(o.id, 'paid');
        clearOutbox();

        // Surat yo'q: qaysi hisob-fakturani shu belgi yopgani noma'lum — taxmin qilinmaydi, xodimga tekshirish uchun aytiladi
        expect(await undo(o.id)).toMatchObject(undone(0, [inv.invoiceNo]));
        expect((await row(o.id)).paymentStatus).toBe('pending');
        expect(await invoiceRow(inv.id)).toEqual(inv);
        expect((await payments(o.id)).at(-1)).toEqual({ fromValue: 'paid', toValue: 'pending', actor: 'Test Xodim', via: 'staff_bot', meta: null });
        expect(await payments(o.id)).toHaveLength(withEvent ? 2 : 1);
        expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
      }
    });

    it('holat o\'zgarishi yozuvlari to\'lov yozuvini to\'sib qo\'ymaydi; bir xil vaqtli ikki yozuvdan keyin yozilgani olinadi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer' });
      const inv = await fx.invoice({ orderId: o.id, total: 100000, paid: 40000, status: 'partial', dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      await changeOrderStatus(o.id, 'processing', admin);
      await changeOrderStatus(o.id, 'shipping', bot);
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));

      // Bir millisekundda yozilgan ikki "to'landi" yozuvi: vaqt teng bo'lsa id bo'yicha oxirgisi (tartib createdAt emas, id bo'yicha)
      const twin = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const twinInv = await paidInvoice(twin.id, 100000);
      const at = new Date();
      await forgeEvent(twin.id, 'paid', { invoices: [{ id: twinInv.id, status: 'issued', paidAmount: '0', paidAt: null }] }, { createdAt: at });
      await forgeEvent(twin.id, 'paid', { invoices: [{ id: twinInv.id, status: 'partial', paidAmount: '70000', paidAt: null }] }, { createdAt: at });
      expect(await undo(twin.id)).toMatchObject(undone(1));
      expect(await money(twinInv.id)).toEqual({ status: 'partial', paidAmount: 70000, paidAt: null });

      // Vaqti teskari yozilgan bo'lsa ham (createdAt — tranzaksiya boshlangan vaqt, ketma-ketlikni kafolatlamaydi) tartib id bo'yicha:
      // chegara — oxirgi YOZILGAN "to'lanmagan" (vaqti eng kech ko'ringani emas); undan keyin yozilgan "to'landi" vaqti eskiroq
      // ko'rinsa ham hisobga olinadi, undan oldin yozilgani esa vaqti kechroq ko'rinsa ham olinmaydi
      const skew = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      const [before, after] = [await paidInvoice(skew.id, 100000), await paidInvoice(skew.id, 100000)];
      const snap = (id: number, paidAmount: string) => ({ invoices: [{ id, status: 'partial', paidAmount, paidAt: null }] });
      await forgeEvent(skew.id, 'pending', undefined, { fromValue: 'paid', createdAt: new Date(at.getTime() + 120_000) });
      await forgeEvent(skew.id, 'paid', snap(before.id, '11111'), { createdAt: new Date(at.getTime() + 60_000) });
      await forgeEvent(skew.id, 'pending', undefined, { fromValue: 'paid', createdAt: new Date(at.getTime() - 60_000) });
      await forgeEvent(skew.id, 'paid', snap(after.id, '22222'), { createdAt: new Date(at.getTime() - 120_000) });
      expect(await undo(skew.id)).toMatchObject(undone(1, [before.invoiceNo]));
      expect(await invoiceRow(before.id)).toEqual(before);
      expect(await money(after.id)).toEqual({ status: 'partial', paidAmount: 22222, paidAt: null });
    });

    it('belgi ikki marta qo\'yilib ikki marta bekor qilinsa har safar o\'sha paytdagi holat qaytadi — orada kiritilgan qisman to\'lov yo\'qolmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 900000 });
      const inv = await fx.invoice({ orderId: o.id, total: 900000, dueDate: soon() });

      await setManualPayment(o.id, 'paid', bot);
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));

      // Orada moliya hisob-faktura sahifasida 250 000 qisman to'lov kiritdi
      expect(await run(registerPartial, { id: String(inv.id), amount: '250000' })).toBe(`/admin/invoices/${inv.id}?saved=1`);
      const part = await invoiceRow(inv.id);
      expect(part).toMatchObject({ status: 'partial', paidAt: null });
      expect(Number(part.paidAmount)).toBe(250000);

      // Ikkinchi bekor qilish faqat ikkinchi belgining suratini ko'radi: birinchisi chegaradan (birinchi bekor qilishdan) oldin qolgan
      await setManualPayment(o.id, 'paid', admin);
      expect(Number((await invoiceRow(inv.id)).paidAmount)).toBe(900000);
      expect(await undo(o.id, admin)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(part));

      expect((await payments(o.id)).map((e) => [e.fromValue, e.toValue, e.via, e.meta])).toEqual([
        ['pending', 'paid', 'staff_bot', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] }],
        ['paid', 'pending', 'staff_bot', { reopened: [inv.invoiceNo] }],
        ['pending', 'paid', 'admin', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '250000', paidAt: null }] }],
        ['paid', 'pending', 'admin', { reopened: [inv.invoiceNo] }],
      ]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted', 'paid', 'reverted']);
    });

    it('expected "paid": buyurtma endi "to\'langan" emas — "conflict", hech narsa yozilmaydi; allaqachon "to\'lanmagan" bo\'lsa jim "o\'zgarmadi"', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      // Tasdiqlash so'rovi ochiq turganda boshqa xodim pulni "qaytarilgan" qilgan
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer' });
      const inv = await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      await setManualPayment(o.id, 'refunded', admin);
      const before = { order: await row(o.id), invoice: await invoiceRow(inv.id), history: await payments(o.id) };
      clearOutbox();

      for (const actor of [bot, admin]) expect(await undo(o.id, actor)).toMatchObject({ ok: false, reason: 'conflict', order: { id: o.id, paymentStatus: 'refunded' } });
      expect({ order: await row(o.id), invoice: await invoiceRow(inv.id), history: await payments(o.id) }).toEqual(before);
      expect(outbox.customer).toEqual([]);

      // Eski xabardagi tugma ikkinchi marta bosildi: belgi allaqachon bekor qilingan — ziddiyat emas, lekin hech narsa takrorlanmaydi
      const twice = await fx.order({ contactPhone: phone, paymentMethod: 'cash' });
      const open = await fx.invoice({ orderId: twice.id, total: 100000, dueDate: soon() });
      await setManualPayment(twice.id, 'paid', bot);
      expect(await undo(twice.id)).toMatchObject(undone(1));
      const after = { order: await row(twice.id), invoice: await invoiceRow(open.id), history: await payments(twice.id) };
      clearOutbox();
      const again = await undo(twice.id);
      expect(again).toMatchObject({ ok: true, changed: false, order: { paymentStatus: 'pending' } });
      expect(again).not.toHaveProperty('reopened');
      expect(again).not.toHaveProperty('stillPaid');
      expect({ order: await row(twice.id), invoice: await invoiceRow(open.id), history: await payments(twice.id) }).toEqual(after);
      expect(outbox.customer).toEqual([]);
    });

    it('onlayn to\'lov (Payme / Click) belgisi bekor qilinmaydi: reason "online" — tarixida surat bo\'lsa ham hisob-fakturaga tegilmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      for (const paymentMethod of ['payme', 'click'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod, paymentStatus: 'paid' });
        const inv = await paidInvoice(o.id, 100000);
        await forgeEvent(o.id, 'paid', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] });

        for (const actor of [bot, admin]) expect(await undo(o.id, actor)).toMatchObject({ ok: false, reason: 'online', order: { id: o.id, paymentStatus: 'paid' } });
        expect(await setManualPayment(o.id, 'pending', admin)).toMatchObject({ ok: false, reason: 'online' });
        expect(await row(o.id)).toEqual(o);
        expect(await invoiceRow(inv.id)).toEqual(inv);
        expect(await payments(o.id)).toHaveLength(1);
      }
      expect(outbox.customer).toEqual([]);
    });

    it('o\'chirilgan buyurtma: not_found — buyurtma, hisob-faktura va tarix o\'zgarmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const soft = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'paid', deletedAt: new Date() });
      const inv = await paidInvoice(soft.id, 100000);
      await forgeEvent(soft.id, 'paid', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] });

      expect(await undo(soft.id)).toEqual({ ok: false, reason: 'not_found' });
      expect(await row(soft.id)).toEqual(soft);
      expect(await invoiceRow(inv.id)).toEqual(inv);
      expect(await payments(soft.id)).toHaveLength(1);
      expect(outbox.customer).toEqual([]);

      const gone = await fx.order({ paymentMethod: 'cash', paymentStatus: 'paid' });
      await prisma.order.delete({ where: { id: gone.id } });
      expect(await undo(gone.id, admin)).toEqual({ ok: false, reason: 'not_found' });
    });

    // ─── Bir vaqtda bosilganda (haqiqiy qator qulflari bilan) ──────────────────

    it('ikki xodim bir vaqtda bekor qilsa faqat bittasi o\'tadi: bitta tarix yozuvi, hisob-faktura bir marta qaytadi, mijozga bitta tuzatish; yutqazganiga bazadagi yangi holat ("to\'lanmagan") qaytadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 600000 });
      const inv = await fx.invoice({ orderId: o.id, total: 600000, paid: 150000, status: 'partial', dueDate: soon() });
      const early = await paidInvoice(o.id, 50000);
      await setManualPayment(o.id, 'paid', bot);
      clearOutbox();

      // Ikkalasi ham "to'langan"ni o'qib, yozishga yetib kelgandagina qo'yib yuboriladi (yuqoridagi poyga testlari kabi)
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const race = Promise.all([undo(o.id, bot), undo(o.id, admin)]);
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const results = await held.race;

      const won = results.flatMap((r) => (r.ok && r.changed ? [r] : []));
      const lost = results.flatMap((r) => (r.ok ? [] : [r]));
      expect(won).toHaveLength(1);
      expect(won[0]).toMatchObject(undone(1, [early.invoiceNo]));
      expect(lost).toHaveLength(1);
      expect(lost[0].reason).toBe('conflict');
      // Yutqazgan chaqiruv boshida "to'langan"ni o'qigan edi — unga o'sha eskirgan qator emas, qayta o'qilgan qator qaytadi:
      // chaqiruvchi (bot kartasi, admin sahifasi) buyurtmani hozirgi holatida ko'rsatadi
      expect(lost[0].order).toEqual(await row(o.id));
      expect(lost[0].order?.paymentStatus).toBe('pending');
      expect(lost[0]).not.toHaveProperty('reopened');
      expect(lost[0]).not.toHaveProperty('stillPaid');

      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect(await invoiceRow(early.id)).toEqual(early);
      const history = await payments(o.id);
      expect(history.map((e) => `${e.fromValue}>${e.toValue}`)).toEqual(['pending>paid', 'paid>pending']);
      expect(history[1].via).toBe(results[0].ok ? 'staff_bot' : 'admin');
      expect(history[1].meta).toEqual({ reopened: [inv.invoiceNo] });
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
      expect(outbox.staff).toEqual([]);
    });

    it('bekor qilish va "qaytarilgan" bir vaqtda: bittasi o\'tadi — hisob-faktura faqat bekor qilish yutgandagina qayta ochiladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 600000 });
      const inv = await fx.invoice({ orderId: o.id, total: 600000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      const settled = await invoiceRow(inv.id);
      clearOutbox();

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const race = Promise.all([undo(o.id, bot), setManualPayment(o.id, 'refunded', admin, { expected: 'paid' })]);
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const [reverted, refunded] = await held.race;

      expect([reverted, refunded].filter((r) => r.ok && r.changed)).toHaveLength(1);
      const lost = [reverted, refunded].flatMap((r) => (!r.ok && r.reason === 'conflict' ? [r] : []));
      expect(lost).toHaveLength(1);
      const final = (await row(o.id)).paymentStatus;
      expect(final).toBe(reverted.ok ? 'pending' : 'refunded');
      // Yutqazganiga bazadagi yangi holat qaytadi (o'zi boshida o'qigan "to'langan" emas)
      expect(lost[0].order?.paymentStatus).toBe(final);
      if (reverted.ok) expect(reverted).toMatchObject(undone(1));
      else expect(refunded).not.toHaveProperty('reopened');
      expect(await invoiceRow(inv.id)).toEqual(reverted.ok ? reopenedAs(inv) : settled);
      expect((await payments(o.id)).map((e) => [`${e.fromValue}>${e.toValue}`, e.meta !== null])).toEqual([['pending>paid', true], [`paid>${final}`, reverted.ok]]);
      expect(paymentMsgs(c.telegramId)).toEqual(reverted.ok ? ['reverted'] : []);
    });

    it('bekor qilish yozuvi o\'tmasa (orada to\'lov holati o\'zgargan) hisob-faktura ham ochilmaydi, tarix va xabar ham yo\'q', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer' });
      const inv = await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      const before = { invoice: await invoiceRow(inv.id), history: await payments(o.id) };
      clearOutbox();

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const call = undo(o.id);
          await waitForBlocked(tx, 1);
          await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'refunded' } });
          return { call };
        },
        { timeout: 15_000 },
      );
      const lost = await held.call;
      expect(lost).toMatchObject({ ok: false, reason: 'conflict', order: { id: o.id, paymentStatus: 'refunded' } });
      expect(lost).not.toHaveProperty('reopened');

      expect((await row(o.id)).paymentStatus).toBe('refunded');
      expect({ invoice: await invoiceRow(inv.id), history: await payments(o.id) }).toEqual(before);
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);
    });

    it('bekor qilish tugamaguncha oraliq holat bazada ko\'rinmaydi (bitta tranzaksiya); shu orada moliya bekor qilgan hisob-fakturaga tegilmaydi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 300000 });
      const a = await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() });
      const b = await fx.invoice({ orderId: o.id, total: 200000, paid: 50000, status: 'partial', dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);

      // Hisob-faktura qatori qulflangan: bekor qilish buyurtmani yangilab bo'lgan, lekin shu hisob-fakturada kutib turibdi
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${b.id} FOR UPDATE`;
          const call = undo(o.id);
          await waitForBlocked(tx, 1);
          // Boshqa ulanishdan qaralganda hali hech narsa o'zgarmagan: yarim bajarilgan holat yo'q
          const seen = { order: (await row(o.id)).paymentStatus, a: (await invoiceRow(a.id)).status, history: (await payments(o.id)).length };
          const cancelled = await tx.corporateInvoice.update({ where: { id: b.id }, data: { status: 'cancelled' } });
          return { call, seen, cancelled };
        },
        { timeout: 15_000 },
      );
      expect(held.seen).toEqual({ order: 'paid', a: 'paid', history: 1 });
      // Bekor qilingan hisob-faktura qayta ochilmagan, "to'langan" ham emas — ikkala ro'yxatga ham kirmaydi
      expect(await held.call).toMatchObject(undone(1));

      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(a.id)).toEqual(reopenedAs(a));
      expect(await invoiceRow(b.id)).toEqual(held.cancelled);
      expect(await payments(o.id)).toHaveLength(2);
      expect((await payments(o.id))[1].meta).toEqual({ reopened: [a.invoiceNo] });
    });

    it('"to\'landi" kutib turganda moliya bekor qilgan hisob-faktura yopilmaydi va suratga ham kirmaydi — keyin faqat yopilgani qaytariladi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 300000 });
      const a = await fx.invoice({ orderId: o.id, total: 100000, dueDate: soon() });
      const b = await fx.invoice({ orderId: o.id, total: 200000, dueDate: soon() });

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${b.id} FOR UPDATE`;
          const call = setManualPayment(o.id, 'paid', bot);
          await waitForBlocked(tx, 1);
          const seen = (await row(o.id)).paymentStatus;
          const cancelled = await tx.corporateInvoice.update({ where: { id: b.id }, data: { status: 'cancelled' } });
          return { call, seen, cancelled };
        },
        { timeout: 15_000 },
      );
      expect(held.seen).toBe('pending');
      expect(await held.call).toMatchObject({ ok: true, changed: true });

      expect((await invoiceRow(a.id)).status).toBe('paid');
      expect(await invoiceRow(b.id)).toEqual(held.cancelled);
      expect((await payments(o.id)).map((e) => e.meta)).toEqual([{ invoices: [{ id: a.id, status: 'issued', paidAmount: '0', paidAt: null }] }]);

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(a.id)).toEqual(reopenedAs(a));
      expect(await invoiceRow(b.id)).toEqual(held.cancelled);
    });

    // settleInvoicesOfPaidOrder qatorlarni qulflab (SELECT ... FOR UPDATE) o'qiydi. Qulfsiz o'qiganda yakunlanmagan qisman to'lov
    // ko'rinmasdi: suratga "berilgan, 0" tushib, belgi bekor qilinganda o'sha to'lov yo'qolardi
    it('"to\'landi" hali yakunlanmagan qisman to\'lovni kutadi: suratga yakunlangan holat ("qisman", summa) tushadi va belgi bekor qilinsa aynan shu holat qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 900000 });
      const inv = await fx.invoice({ orderId: o.id, total: 900000, dueDate: soon() });

      const held = await prisma.$transaction(
        async (tx) => {
          // Boshqa xodimning 250 000 qisman to'lovi yozilgan, lekin tranzaksiyasi hali yakunlanmagan
          const part = await tx.corporateInvoice.update({ where: { id: inv.id }, data: { paidAmount: 250000, status: 'partial' } });
          const call = setManualPayment(o.id, 'paid', bot);
          await waitForBlocked(tx, 1);
          // "To'landi" hisob-faktura qatorida kutib turibdi: tashqaridan qaralganda hali hech narsa o'zgarmagan
          const seen = { order: (await row(o.id)).paymentStatus, invoice: await money(inv.id), history: (await payments(o.id)).length };
          return { call, part, seen };
        },
        { timeout: 15_000 },
      );
      expect(held.seen).toEqual({ order: 'pending', invoice: { status: 'issued', paidAmount: 0, paidAt: null }, history: 0 });
      expect(await held.call).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });

      expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 900000 });
      expect((await payments(o.id)).map((e) => e.meta)).toEqual([{ invoices: [{ id: inv.id, status: 'partial', paidAmount: '250000', paidAt: null }] }]);

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(held.part));
    });

    it('settleInvoicesOfPaidOrder (Payme / Click yo\'li) ham qulfni kutadi: qaytargan surati — kutib olingan, yakunlangan holat; bekor bo\'lgan (rollback) qisman to\'lov esa suratga tushmaydi', async () => {
      for (const commit of [true, false]) {
        const o = await fx.order({ paymentMethod: 'click', paymentStatus: 'paid', totalAmount: 500000 });
        const inv = await fx.invoice({ orderId: o.id, total: 500000, dueDate: soon() });
        const other = await fx.invoice({ orderId: o.id, total: 100000, paid: 30000, status: 'partial', dueDate: soon() });

        // Chaqiruv tranzaksiya ichida boshlanadi, natijasi esa tranzaksiya bekor bo'lganda ham kerak — shuning uchun tashqarida saqlanadi
        const box: { call?: Promise<InvoiceSnapshot[]> } = {};
        const held = prisma.$transaction(
          async (tx) => {
            await tx.corporateInvoice.update({ where: { id: inv.id }, data: { paidAmount: 200000, status: 'partial' } });
            box.call = settleInvoicesOfPaidOrder(o.id);
            await waitForBlocked(tx, 1);
            // Kutayotgan chaqiruv hali hech narsani yopmagan — qulflanmagan ikkinchi hisob-faktura ham ochiq turibdi
            const seen = [(await invoiceRow(inv.id)).status, (await invoiceRow(other.id)).status];
            if (!commit) throw new Error('qisman to\'lov bekor bo\'ldi');
            return seen;
          },
          { timeout: 15_000 },
        );
        if (commit) expect(await held).toEqual(['issued', 'partial']);
        else await expect(held).rejects.toThrow('qisman to\'lov bekor bo\'ldi');

        expect(byId(await box.call!)).toEqual([
          commit ? { id: inv.id, status: 'partial', paidAmount: '200000', paidAt: null } : { id: inv.id, status: 'issued', paidAmount: '0', paidAt: null },
          { id: other.id, status: 'partial', paidAmount: '30000', paidAt: null },
        ]);
        for (const i of [inv, other]) expect(await money(i.id)).toMatchObject({ status: 'paid', paidAmount: Number(i.totalAmount) });
      }
    });

    it('bekor qilish kutib turganda belgi boshqa xodim tomonidan bekor qilinib qayta qo\'yilgan bo\'lsa, surat qulfdan KEYIN o\'qiladi: chegaradan keyingi (eng oxirgi) "to\'landi" yozuvidagi holat qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 500000 });
      const inv = await fx.invoice({ orderId: o.id, total: 500000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const call = undo(o.id, admin);
          await waitForBlocked(tx, 1);
          // Qulf egasi boshqa xodimlarning shu orada tugagan ishini yozadi: belgi bekor qilingan, 200 000 qisman to'lov kiritilgan va
          // buyurtma yana "to'landi" qilingan. Buyurtma yana "to'langan" — kutayotgan chaqiruvning sharti bajariladi
          await tx.orderEvent.create({ data: { orderId: o.id, kind: 'payment', fromValue: 'paid', toValue: 'pending', actor: 'Boshqa', via: 'staff_bot' } });
          await tx.orderEvent.create({ data: { orderId: o.id, kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'Boshqa', via: 'staff_bot', meta: { invoices: [{ id: inv.id, status: 'partial', paidAmount: '200000', paidAt: null }] } } });
          return { call };
        },
        { timeout: 15_000 },
      );
      expect(await held.call).toMatchObject(undone(1));

      // Birinchi "to'landi" surati ("berilgan", 0) chegaradan oldin qolgan — u ishlatilmaydi
      expect(await money(inv.id)).toEqual({ status: 'partial', paidAmount: 200000, paidAt: null });
      expect((await payments(o.id)).map((e) => `${e.fromValue}>${e.toValue}`)).toEqual(['pending>paid', 'paid>pending', 'pending>paid', 'paid>pending']);
    });

    it('"to\'landi" va bekor qilish bir vaqtda bosilsa, qaysi biri oldin yetib borsa ham buyurtma, hisob-faktura, tarix va xabarlar bir-biriga mos qoladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      for (const start of ['pending', 'paid', 'pending', 'paid'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 700000 });
        const inv = await fx.invoice({ orderId: o.id, total: 700000, paid: 100000, status: 'partial', dueDate: soon() });
        if (start === 'paid') await setManualPayment(o.id, 'paid', admin);
        const base = (await payments(o.id)).length;
        clearOutbox();

        const [marked, reverted] = await Promise.all([setManualPayment(o.id, 'paid', bot), undo(o.id, admin)]);
        // Hech biri rad etilmaydi: kech o'qigani o'zgarishni ko'radi, erta o'qigani "o'zgarmadi" oladi
        expect(marked.ok && reverted.ok).toBe(true);
        // "To'lanmagan"dan boshlansa belgi albatta qo'yiladi, "to'langan"dan boshlansa albatta bekor qilinadi
        expect(start === 'pending' ? marked : reverted).toMatchObject({ ok: true, changed: true });
        // Bekor qilish o'tgan bo'lsa hisob-fakturani albatta ochgan: "to'langan" turib qolgani yo'q
        if (reverted.ok && reverted.changed) expect(reverted).toMatchObject(undone(1));

        const history = (await payments(o.id)).slice(base);
        expect(history).toHaveLength([marked, reverted].filter((r) => r.ok && r.changed).length);
        history.forEach((e, i) => expect(e.fromValue).toBe(i === 0 ? start : history[i - 1].toValue));
        const final = (await row(o.id)).paymentStatus;
        expect(history.at(-1)!.toValue).toBe(final);

        const now = await invoiceRow(inv.id);
        if (final === 'paid') {
          expect(now.status).toBe('paid');
          expect(Number(now.paidAmount)).toBe(700000);
        } else {
          expect(now).toEqual(reopenedAs(inv));
        }
        // Har bir o'zgarishga bitta xabar (yetib kelish tartibi emas, soni tekshiriladi)
        expect(paymentMsgs(c.telegramId).sort()).toEqual(history.map((e) => (e.toValue === 'paid' ? 'paid' : 'reverted')).sort());
      }
    });
  });

  // Hisob-faktura sahifasida to'liq to'lov bank o'tkazmali buyurtmani ham "to'langan" qiladi: tarix yozuvi amalning o'z tranzaksiyasida,
  // hisob-fakturaning to'lovdan oldingi holati bilan yoziladi — buyurtmadagi belgi bekor qilinsa hisob-faktura shu holatga qaytadi.
  // Avvalgi holat sahifa ochilganda o'qilgan qiymatdan emas, tranzaksiya ichida qulflangan qatordan olinadi. Bunday to'lov xodimlarga
  // e'lon qilinadi ("To'lov qabul qilindi" kartasi), shuning uchun belgi bekor qilinsa tuzatish kartasi ham ularga boradi
  describe('hisob-faktura sahifasidan to\'langan buyurtma (markPaid / registerPartial amallarining o\'zi)', () => {
    const saved = (id: number) => `/admin/invoices/${id}?saved=1`;

    it('"To\'liq to\'landi": tarix yozuvi bitta va unda hisob-fakturaning avvalgi holati; belgi bekor qilinsa hisob-faktura qayta ochiladi va xodimlarga tuzatish kartasi boradi — qayta to\'lansa yana bekor qilsa bo\'ladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      // "overdue" bazaga endi yozilmaydi, lekin eski yozuvlarda bor — u ham o'z holatiga qaytishi kerak
      for (const status of ['issued', 'overdue'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 800000 });
        const inv = await fx.invoice({ orderId: o.id, total: 800000, status, dueDate: status === 'overdue' ? past() : soon() });
        const snapshot = { invoices: [{ id: inv.id, status, paidAmount: '0', paidAt: null }] };
        clearSent();

        expect(await run(markPaid, { id: String(inv.id) })).toBe(saved(inv.id));
        expect((await row(o.id)).paymentStatus).toBe('paid');
        const settled = await invoiceRow(inv.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(800000);
        expect(settled.paidAt).toBeInstanceOf(Date);
        // Yozuv amalning tranzaksiyasida yozilgan — afterPaymentChange ikkinchisini qo'shmaydi
        expect(await payments(o.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: snapshot }]);
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
        expect(cardsTo(manager)).toHaveLength(1);
        expect(cardsTo(manager)[0].html).toContain("<b>To'lov qabul qilindi</b> (Test Moliya)");
        // Belgini bekor qilish tugmasi faqat moliya ruxsati bor xodimning kartasida
        expect(callbacks(cardsTo(manager)[0])).toContain(`ou_${o.id}`);
        expect(cardsTo(worker)).toHaveLength(1);
        expect(callbacks(cardsTo(worker)[0]).filter((cb) => cb.startsWith('ou_') || cb.startsWith('op_'))).toEqual([]);
        // Karta mijoz xabari bilan bitta navbat mavzusida (buyurtma bo'yicha): tuzatish kartasi chiqsa navbatdagi bu karta bekor bo'ladi
        for (const u of [manager, worker]) expect(cardTopicsTo(u)).toEqual([paymentTopic(o.id)]);
        expect(sent.topics).toEqual([{ to: c.telegramId, topic: paymentTopic(o.id) }]);

        clearSent();
        expect(await undo(o.id, admin)).toMatchObject(undone(1));
        expect((await row(o.id)).paymentStatus).toBe('pending');
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect((await payments(o.id)).slice(1)).toEqual([{ fromValue: 'paid', toValue: 'pending', actor: 'Test Admin', via: 'admin', meta: { reopened: [inv.invoiceNo] } }]);
        expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
        // Chatida "To'lov qabul qilindi" kartasi qolgan xodimlar to'lanmagan buyurtmani jo'natib yubormasin: tuzatish ularga ham boradi.
        // Kartada buyurtma hozirgi holatida: «To'landi» tugmasi moliya xodimida yana bor, bekor qilish (ou_) tugmasi hech kimda yo'q
        for (const u of [manager, worker]) {
          expect(cardsTo(u).map(noteOf)).toEqual(["↩️ <b>To'lov belgisi bekor qilindi</b> (Test Admin)"]);
          expect(cardsTo(u)[0].html).toContain(`<b>Buyurtma #${o.id}</b>`);
          expect(cardsTo(u)[0].html).toContain("Bank o'tkazmasi · To'lanmagan");
          // Tuzatish kartasi ham o'sha mavzuda: navbatda kechikkan "To'lov qabul qilindi" kartasi undan keyin yetib bormaydi
          expect(cardTopicsTo(u)).toEqual([paymentTopic(o.id)]);
        }
        expect(callbacks(cardsTo(manager)[0])).toEqual([`os_${o.id}_processing`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
        expect(callbacks(cardsTo(worker)[0])).toEqual([`os_${o.id}_processing`, `oc_${o.id}`, `or_${o.id}`]);

        // Pul haqiqatan kelgach moliya yana "To'liq to'landi" bosadi: yangi yozuv yangi surat bilan
        expect(await run(markPaid, { id: String(inv.id) })).toBe(saved(inv.id));
        expect((await payments(o.id)).at(-1)).toEqual({ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: snapshot });
        clearSent();
        expect(await undo(o.id)).toMatchObject(undone(1));
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect(await payments(o.id)).toHaveLength(4);
        // Bu safar botdan bekor qilindi: kartada bekor qilgan xodimning ismi
        expect(cardsTo(manager).map(noteOf)).toEqual(["↩️ <b>To'lov belgisi bekor qilindi</b> (Test Xodim)"]);
      }
    });

    it('tuzatish kartasi faqat xodimlarga e\'lon qilingan to\'lovda (hisob-faktura sahifasi) boradi — "orders" ruxsati bor, xabarnomasi yoqilgan har bir xodimga; bot yoki admin formasidan qo\'yilgan belgida xodimlarga hech narsa ketmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const boss = await fx.user({ role: 'admin', telegramId: fx.tg() });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      const muted = await fx.user({ role: 'manager', telegramId: fx.tg(), telegramNotify: false });
      const fired = await fx.user({ role: 'manager', telegramId: fx.tg(), isActive: false });
      const client = await fx.user({ role: 'user', telegramId: fx.tg() });

      // Qisman to'lovdan keyin qolgani to'landi (registerPartial ham xuddi shu yo'l): buyurtma "to'langan", xodimlarga e'lon qilindi
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 800000, status: 'processing' });
      const inv = await fx.invoice({ orderId: o.id, total: 800000, paid: 300000, status: 'partial', dueDate: soon() });
      expect(await run(registerPartial, { id: String(inv.id), amount: '500000' })).toBe(saved(inv.id));
      for (const u of [boss, manager, worker]) expect(cardsTo(u).map(noteOf)).toEqual(["✅ <b>To'lov qabul qilindi</b> (Test Moliya)"]);
      clearOutbox();

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      for (const u of [boss, manager, worker]) {
        expect(cardsTo(u).map(noteOf)).toEqual(["↩️ <b>To'lov belgisi bekor qilindi</b> (Test Xodim)"]);
        expect(cardsTo(u)[0].html).toContain(`<b>Buyurtma #${o.id}</b> · Tayyorlanmoqda`);
        expect(cardsTo(u)[0].html).toContain("Bank o'tkazmasi · To'lanmagan");
        expect(cardsTo(u)[0].html).toContain(`🧾 ${inv.invoiceNo}`);
      }
      // Tugmalar har bir oluvchining o'z ruxsatiga qarab: «To'landi» faqat moliya ruxsati bor xodimda (administrator, menejer)
      for (const u of [boss, manager]) expect(callbacks(cardsTo(u)[0])).toEqual([`os_${o.id}_shipping`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
      expect(callbacks(cardsTo(worker)[0])).toEqual([`os_${o.id}_shipping`, `oc_${o.id}`, `or_${o.id}`]);
      // Xabarnomani o'chirgan, ishdan bo'shatilgan xodim va oddiy mijoz akkaunti hech narsa olmaydi
      for (const u of [muted, fired, client]) expect(cardsTo(u)).toEqual([]);
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);

      // Shu buyurtma endi botdan "to'landi" qilinib bekor qilindi: e'lon qilingan eski to'lov chegaradan oldin qolgan — xodimlarga jim
      await setManualPayment(o.id, 'paid', bot);
      clearOutbox();
      expect(await undo(o.id, admin)).toMatchObject(undone(1));
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
      expect(outbox.staff).toEqual([]);

      // Bot yoki admin formasidan qo'yilgan belgi xodimlarga e'lon qilinmagan (o'zlari qo'ygan) — tuzatishi ham faqat mijozga boradi
      for (const [marker, undoer] of [[bot, admin], [admin, bot], [bot, bot], [admin, admin]] as const) {
        const own = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer' });
        await fx.invoice({ orderId: own.id, total: 100000, dueDate: soon() });
        await setManualPayment(own.id, 'paid', marker);
        expect(outbox.staff).toEqual([]);
        clearOutbox();
        expect(await undo(own.id, undoer)).toMatchObject(undone(1));
        expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
        expect(outbox.staff).toEqual([]);
      }
    });

    // "To'liq to'landi" hisob-fakturani sahifa uchun o'qib bo'lgan, yozishga esa keyinroq yetib keladi. Surat o'sha eskirgan o'qishdan
    // olinganda ("berilgan", 0) belgi bekor qilinsa orada kiritilgan qisman to'lov yo'qolardi
    it('"To\'liq to\'landi" eskirgan sahifadan bosilgan, shu orada boshqa xodim qisman to\'lov kiritgan: suratga qulflangan qatordagi haqiqiy holat tushadi — belgi bekor qilinsa qisman to\'lov joyida qoladi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 900000 });
      const inv = await fx.invoice({ orderId: o.id, total: 900000, dueDate: soon() });
      const id = String(inv.id);

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          // Amal hisob-fakturani "berilgan, 0" deb o'qib bo'lgan va buyurtma qatorida kutib turibdi
          const full = run(markPaid, { id });
          await waitForBlocked(tx, 1);
          // Shu payt boshqa xodimning 250 000 qisman to'lovi yozilib, yakunlanadi (u buyurtma qatoriga tegmaydi — kutmaydi)
          const part = await run(registerPartial, { id, amount: '250000' });
          return { full, part, between: await invoiceRow(inv.id) };
        },
        { timeout: 15_000 },
      );
      expect(held.part).toBe(saved(inv.id));
      expect(held.between).toMatchObject({ status: 'partial', paidAt: null });
      expect(Number(held.between.paidAmount)).toBe(250000);
      expect(await held.full).toBe(saved(inv.id));

      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 900000 });
      expect(await payments(o.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: { invoices: [{ id: inv.id, status: 'partial', paidAmount: '250000', paidAt: null }] } }]);

      expect(await undo(o.id, admin)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(held.between));
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
    });

    it('oxirgi qisman to\'lov ("to\'liq"qa yetkazgan) hisob-faktura qatorida kutib turganda yozilgan boshqa o\'zgarish ham suratga tushadi: surat — qulfdan keyin o\'qilgan holat', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 500000 });
      const inv = await fx.invoice({ orderId: o.id, total: 500000, paid: 100000, status: 'partial', dueDate: soon() });

      // Qolgan 400 000 kiritilmoqda: amal buyurtmani "to'langan" qilib bo'lgan va hisob-faktura qatorida kutib turibdi. Qulf egasi shu
      // orada hisob-fakturaga to'lov sanasini yozadi (boshqa xodimning shu paytda yakunlangan ishi) — suratda aynan shu sana bo'lishi kerak
      const at = new Date('2026-10-02T11:12:13.141Z');
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${inv.id} FOR UPDATE`;
          const rest = run(registerPartial, { id: String(inv.id), amount: '400000' });
          await waitForBlocked(tx, 1);
          const seen = (await row(o.id)).paymentStatus;
          const dated = await tx.corporateInvoice.update({ where: { id: inv.id }, data: { paidAt: at } });
          return { rest, seen, dated };
        },
        { timeout: 15_000 },
      );
      expect(held.seen).toBe('pending');
      expect(await held.rest).toBe(saved(inv.id));
      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect((await payments(o.id)).map((e) => e.meta)).toEqual([{ invoices: [{ id: inv.id, status: 'partial', paidAmount: '100000', paidAt: at.toISOString() }] }]);

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(held.dated));
    });

    it('qisman to\'lovdan keyin to\'liq to\'langan hisob-faktura: belgi bekor qilinsa "qisman to\'langan" holatiga, o\'sha summa bilan qaytadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 1000000 });
      const inv = await fx.invoice({ orderId: o.id, total: 1000000, dueDate: soon() });

      // Qisman to'lov buyurtmaga tegmaydi: tarix ham, xabar ham yo'q
      expect(await run(registerPartial, { id: String(inv.id), amount: '300000.5' })).toBe(saved(inv.id));
      const part = await invoiceRow(inv.id);
      expect(part).toMatchObject({ status: 'partial', paidAt: null });
      expect(Number(part.paidAmount)).toBe(300000.5);
      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await payments(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);

      // Qolgani to'landi: buyurtma "to'langan" bo'ladi, suratda — oxirgi to'lovdan OLDINGI holat
      expect(await run(registerPartial, { id: String(inv.id), amount: '699999.5' })).toBe(saved(inv.id));
      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(await invoiceRow(inv.id)).toMatchObject({ status: 'paid' });
      expect(Number((await invoiceRow(inv.id)).paidAmount)).toBe(1000000);
      expect(await payments(o.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: { invoices: [{ id: inv.id, status: 'partial', paidAmount: '300000.5', paidAt: null }] } }]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid']);

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(part));
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
    });

    it('naqd buyurtmaning hisob-fakturasi sahifadan yopilsa buyurtmaga tegilmaydi — keyin qo\'yilgan "to\'landi" belgisi bekor qilinganda ham hisob-faktura yopiqligicha qoladi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', totalAmount: 150000 });
      const inv = await fx.invoice({ orderId: o.id, total: 150000, dueDate: soon() });

      expect(await run(markPaid, { id: String(inv.id) })).toBe(saved(inv.id));
      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await payments(o.id)).toEqual([]);
      const settled = await invoiceRow(inv.id);
      expect(settled.status).toBe('paid');

      // Belgi hech narsani yopmagan (yozuvi suratsiz): hisob-faktura to'langanligicha qoladi va bu natijada aytiladi
      await setManualPayment(o.id, 'paid', bot);
      expect(await undo(o.id)).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(settled);
    });

    it('allaqachon to\'langan hisob-fakturada "To\'liq to\'landi" (eski sahifa) buyurtmani "to\'langan" qilsa yozuv suratsiz: belgi bekor qilinganda hisob-faktura to\'langanligicha qoladi', async () => {
      // Pul qaytarilgan buyurtma, hisob-fakturasi esa yopiq: sahifa amali hisob-fakturani yopmagan — qaytariladigan holat ham yo'q
      const o = await fx.order({ paymentMethod: 'bank_transfer', paymentStatus: 'refunded', totalAmount: 100000 });
      const inv = await paidInvoice(o.id, 100000);

      expect(await run(markPaid, { id: String(inv.id) })).toBe(saved(inv.id));
      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(await payments(o.id)).toEqual([{ fromValue: 'refunded', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: null }]);
      const settled = await invoiceRow(inv.id);
      expect(settled.status).toBe('paid');

      expect(await undo(o.id)).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(settled);
    });

    it('"To\'liq to\'landi" ikki marta bosilsa (ketma-ket ham, bir vaqtda ham) tarix yozuvi va xabar bitta, surat — to\'lovdan oldingi holat', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      for (const together of [false, true]) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 200000 });
        const inv = await fx.invoice({ orderId: o.id, total: 200000, paid: 80000, status: 'partial', dueDate: soon() });
        const id = String(inv.id);
        clearOutbox();

        if (together) {
          // Ikkala bosish ham hisob-fakturani "qisman to'langan" deb o'qib, buyurtma qatorida kutib qolgach qo'yib yuboriladi
          const held = await prisma.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
              const race = Promise.all([run(markPaid, { id }), run(markPaid, { id })]);
              await waitForBlocked(tx, 2);
              return { race };
            },
            { timeout: 15_000 },
          );
          expect(await held.race).toEqual([saved(inv.id), saved(inv.id)]);
        } else {
          expect(await run(markPaid, { id })).toBe(saved(inv.id));
          expect(await run(markPaid, { id })).toBe(saved(inv.id));
        }

        expect((await row(o.id)).paymentStatus).toBe('paid');
        expect(await payments(o.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: { invoices: [{ id: inv.id, status: 'partial', paidAmount: '80000', paidAt: null }] } }]);
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
        expect(await undo(o.id)).toMatchObject(undone(1));
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      }
    });

    it('bot "To\'landi" va sahifadagi "To\'liq to\'landi" bir vaqtda: buyurtma bir marta to\'lanadi, surat bitta — kim yutsa ham belgi bekor qilinganda hisob-faktura qaytadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 450000 });
      const inv = await fx.invoice({ orderId: o.id, total: 450000, dueDate: soon() });

      // Ikkalasi ham buyurtma qatorini birinchi qulflaydi (tartib bir xil) — o'zaro qulflanish (deadlock) bo'lmaydi
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const race = Promise.all([setManualPayment(o.id, 'paid', bot), run(markPaid, { id: String(inv.id) })]);
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const [viaBot, url] = await held.race;
      expect(url).toBe(saved(inv.id));
      if (!viaBot.ok) expect(viaBot.reason).toBe('conflict');

      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(Number((await invoiceRow(inv.id)).paidAmount)).toBe(450000);
      expect((await invoiceRow(inv.id)).status).toBe('paid');
      const history = await payments(o.id);
      expect(history).toEqual([expect.objectContaining({ fromValue: 'pending', toValue: 'paid', via: viaBot.ok ? 'staff_bot' : 'invoice', meta: { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] } })]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid']);

      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect(paymentMsgs(c.telegramId)).toEqual(['paid', 'reverted']);
    });

    it('bekor qilish kutib turganda eski sahifadan "To\'liq to\'landi" bosilsa ham ikkalasi tugaydi: belgi bekor bo\'ladi, hisob-faktura qayta ochiladi, sahifa amali tarixga yozmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 350000 });
      const inv = await fx.invoice({ orderId: o.id, total: 350000, dueDate: soon() });
      await setManualPayment(o.id, 'paid', bot);
      clearOutbox();

      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const call = undo(o.id, admin);
          await waitForBlocked(tx, 1);
          // Buyurtma hali "to'langan": sahifa amali buyurtmaga tegmaydi (qulfni ham kutmaydi), hisob-fakturani esa qayta "to'langan" deb yozadi
          const url = await run(markPaid, { id: String(inv.id) });
          return { call, url };
        },
        { timeout: 15_000 },
      );
      expect(held.url).toBe(saved(inv.id));
      expect(await held.call).toMatchObject(undone(1));

      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      expect((await payments(o.id)).map((e) => [e.fromValue, e.toValue, e.via])).toEqual([['pending', 'paid', 'staff_bot'], ['paid', 'pending', 'admin']]);
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted']);
      expect(outbox.staff).toEqual([]);
    });
  });

  // Buyurtmadan to'lov kutilyapti ("to'langan" ham, "qaytarilgan" ham emas), hisob-fakturasi esa "to'langan" bo'lib qolgan holat (surati
  // yo'q eski belgi bekor qilingan yoki to'lov hisob-faktura sahifasida xato kiritilgan) qo'lda tuzatiladi: hisob-faktura sahifasidagi
  // «Qayta ochish» — haqiqiy amalning o'zi. "To'langan" va "qaytarilgan" buyurtmada amal rad etadi: avval buyurtma «To'lanmagan»ga
  // qaytariladi (u belgi yopgan hisob-fakturani suratdagi holatiga o'zi ochadi)
  describe('to\'langan hisob-fakturani qo\'lda qayta ochish (reopenInvoice amalining o\'zi)', () => {
    const saved = (id: number) => `/admin/invoices/${id}?saved=1`;
    const refused = (id: number) => `/admin/invoices/${id}?error=state`;
    const history = (orderId: number) =>
      prisma.orderEvent.findMany({ where: { orderId }, orderBy: { id: 'asc' }, select: { kind: true, fromValue: true, toValue: true, actor: true, via: true, meta: true } });

    it('buyurtmadan to\'lov kutilayotganda ("to\'langan" ham, "qaytarilgan" ham emas): hisob-faktura "berilgan", 0 so\'m, sanasiz holatga qaytadi va tarixga bitta yozuv tushadi; ikkinchi bosish — error=state, yozuv takrorlanmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      await fx.user({ role: 'manager', telegramId: fx.tg() });
      // Qo'lda to'lanadigan buyurtma "to'lanmagan"; onlayn to'lovda "to'lanmagan", "jarayonda" va "o'tmadi" ham shu qatorda
      for (const [paymentMethod, paymentStatus] of [['bank_transfer', 'pending'], ['cash', 'pending'], ['click', 'pending'], ['payme', 'processing'], ['click', 'failed']] as const) {
        const contract = await fx.contract();
        const o = await fx.order({ contactPhone: phone, paymentMethod, paymentStatus, totalAmount: 450000 });
        const inv = await prisma.corporateInvoice.update({ where: { id: (await paidInvoice(o.id, 400000.5)).id }, data: { contractId: contract.id } });
        const other = await paidInvoice(o.id, 50000);
        const id = String(inv.id);

        expect(await run(reopenInvoice, { id })).toBe(saved(inv.id));
        const open = await invoiceRow(inv.id);
        // Faqat pulga oid uch ustun o'zgaradi: jami summa, muddat, shartnoma va raqam joyida
        expect(open).toEqual({ ...inv, status: 'issued', paidAmount: expect.anything(), paidAt: null, updatedAt: expect.any(Date) });
        expect(await money(inv.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
        // Buyurtmaning o'zi va boshqa hisob-fakturasi o'zgarmaydi
        expect(await row(o.id)).toEqual(o);
        expect(await invoiceRow(other.id)).toEqual(other);
        const logged = [{ kind: 'invoice', fromValue: 'paid', toValue: 'issued', actor: 'Test Moliya', via: 'invoice', meta: { invoiceNo: inv.invoiceNo } }];
        expect(await history(o.id)).toEqual(logged);

        // Tugma ikkinchi marta bosildi (yoki eski sahifadan): hisob-faktura endi "to'langan" emas — hech narsa yozilmaydi
        expect(await run(reopenInvoice, { id })).toBe(refused(inv.id));
        expect(await invoiceRow(inv.id)).toEqual(open);
        expect(await history(o.id)).toEqual(logged);
      }
      // Bu hujjatni tuzatish — to'lov holati o'zgarmagan: mijozga ham, xodimlarga ham xabar yo'q
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);
    });

    it('buyurtma "to\'langan" yoki "qaytarilgan" turganda qayta ochilmaydi (avval buyurtma «To\'lanmagan»ga qaytariladi; puli qaytarilgan buyurtmaning to\'langan hisob-fakturasi — odatiy yakuniy holat); "to\'langan" bo\'lmagan hisob-faktura ham ochilmaydi — error=state, hech narsa yozilmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      await fx.user({ role: 'manager', telegramId: fx.tg() });
      // Qo'lda va onlayn to'langan buyurtma: hammasida rad etiladi
      for (const paymentStatus of ['paid', 'refunded'] as const) {
        for (const paymentMethod of ['bank_transfer', 'cash', 'click', 'payme'] as const) {
          const o = await fx.order({ contactPhone: phone, paymentMethod, paymentStatus });
          const inv = await paidInvoice(o.id, 100000);
          const label = `${paymentMethod} / ${paymentStatus}`;
          expect(await run(reopenInvoice, { id: String(inv.id) }), label).toBe(refused(inv.id));
          expect(await invoiceRow(inv.id), label).toEqual(inv);
          expect(await row(o.id), label).toEqual(o);
          expect(await history(o.id), label).toEqual([]);
        }
      }
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);

      // Hisob-faktura "to'langan" emas: ochiq (uch holatda) yoki bekor qilingan — qisman to'lov summasi ham nolga tushib ketmaydi
      const unpaid = await fx.order({ paymentMethod: 'bank_transfer' });
      for (const status of ['issued', 'partial', 'overdue', 'cancelled'] as const) {
        const inv = await fx.invoice({ orderId: unpaid.id, total: 100000, paid: status === 'issued' ? 0 : 40000, status, dueDate: status === 'overdue' ? past() : soon() });
        expect(await run(reopenInvoice, { id: String(inv.id) })).toBe(refused(inv.id));
        expect(await invoiceRow(inv.id)).toEqual(inv);
      }
      expect(await history(unpaid.id)).toEqual([]);

      // Yo'q hisob-faktura: ro'yxatga qaytaradi
      const gone = await fx.invoice({ orderId: unpaid.id, total: 100000, paid: 100000, status: 'paid', dueDate: soon() });
      await prisma.corporateInvoice.delete({ where: { id: gone.id } });
      expect(await run(reopenInvoice, { id: String(gone.id) })).toBe('/admin/invoices');
      expect(await history(unpaid.id)).toEqual([]);
    });

    it('surati yo\'q eski "to\'landi" belgisi bekor qilingach hisob-faktura shu amal bilan ochiladi: mijoz qarzi yana ko\'rinadi; keyingi "to\'landi" uni suratga oladi va bekor qilinsa "berilgan, 0" ga qaytadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const balance = async () => (await customerDebt({ telegramId: c.telegramId, phone, userId: null }))!;
      // Migratsiyadan oldin "to'landi" qilingan buyurtma: tarix yozuvi suratsiz, hisob-fakturasini o'sha belgi yopgan
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', paymentStatus: 'paid', totalAmount: 600000 });
      const inv = await paidInvoice(o.id, 600000);
      await forgeEvent(o.id, 'paid');
      const id = String(inv.id);

      // Buyurtma hali "to'langan": hisob-faktura sahifasidan ochib bo'lmaydi
      expect(await run(reopenInvoice, { id })).toBe(refused(inv.id));
      // Belgi bekor qilindi: surat yo'q — hisob-faktura to'langanligicha qoladi va bu natijada aytiladi
      expect(await undo(o.id, admin)).toMatchObject(undone(0, [inv.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(inv);
      expect((await balance()).invoices).toEqual([]);

      // Moliya xodimi hisob-faktura sahifasida «Qayta ochish»ni bosadi: qarz mijozning "Balans"ida yana ko'rinadi
      expect(await run(reopenInvoice, { id })).toBe(saved(inv.id));
      const open = await invoiceRow(inv.id);
      expect(await money(inv.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      expect(await balance()).toMatchObject({
        invoices: [{ invoiceNo: inv.invoiceNo, orderId: o.id, total: 600000, paid: 0, remaining: 600000, overdue: true }],
        invoiceTotal: 600000, overdueTotal: 600000, unpaidOrders: [], total: 600000,
      });

      // Pul haqiqatan kelgach belgi yana qo'yiladi: endi surat bor ("berilgan", 0) — xato bo'lsa bekor qilish hisob-fakturani o'zi ochadi
      await setManualPayment(o.id, 'paid', bot);
      expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 600000 });
      expect((await payments(o.id)).at(-1)!.meta).toEqual({ invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] });
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(open));
      expect((await balance()).total).toBe(600000);

      expect((await history(o.id)).map((e) => [e.kind, `${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
        ['payment', 'pending>paid', 'staff_bot', null],
        ['payment', 'paid>pending', 'admin', null],
        ['invoice', 'paid>issued', 'invoice', { invoiceNo: inv.invoiceNo }],
        ['payment', 'pending>paid', 'staff_bot', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] }],
        ['payment', 'paid>pending', 'staff_bot', { reopened: [inv.invoiceNo] }],
      ]);
    });

    it('hisob-faktura sahifasida xato kiritilgan to\'liq to\'lov (naqd buyurtma — buyurtmaga tegmagan) shu amal bilan qaytariladi; qayta ochilgan hisob-fakturaga yana to\'lov kiritsa bo\'ladi', async () => {
      const o = await fx.order({ paymentMethod: 'cash', totalAmount: 300000 });
      const inv = await fx.invoice({ orderId: o.id, total: 300000, paid: 120000, status: 'partial', dueDate: soon() });
      const id = String(inv.id);
      expect(await run(markPaid, { id })).toBe(saved(inv.id));
      expect((await row(o.id)).paymentStatus).toBe('pending');
      expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 300000 });

      // Oldingi qisman to'lov summasi saqlanmagan: to'langan summa 0 ga qaytadi (sahifada shu aytiladi) — xodim uni qayta kiritadi
      expect(await run(reopenInvoice, { id })).toBe(saved(inv.id));
      expect(await money(inv.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      expect(await run(registerPartial, { id, amount: '120000' })).toBe(saved(inv.id));
      expect(await money(inv.id)).toEqual({ status: 'partial', paidAmount: 120000, paidAt: null });
      expect((await history(o.id)).map((e) => e.kind)).toEqual(['invoice']);
    });

    it('"qaytarilgan" buyurtmada rad etilgani uchun suratdagi qisman to\'lov yo\'qolmaydi: buyurtma «To\'lanmagan»ga qaytarilganda hisob-faktura o\'sha holatiga ("qisman", summa) o\'zi ochiladi; ochilmay qolgani (alohida to\'langan) uchun tugma shundan keyin ishlaydi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 500000 });
      const inv = await fx.invoice({ orderId: o.id, total: 400000, paid: 120000, status: 'partial', dueDate: soon() });
      const early = await paidInvoice(o.id, 100000);
      await setManualPayment(o.id, 'paid', bot);
      await setManualPayment(o.id, 'refunded', admin, { expected: 'paid' });
      const settled = await invoiceRow(inv.id);

      // Bu yerdan ochilganda to'langan summa 0 ga tushib, suratdagi 120 000 qo'llanmay qolardi
      for (const i of [inv, early]) expect(await run(reopenInvoice, { id: String(i.id) })).toBe(refused(i.id));
      expect(await invoiceRow(inv.id)).toEqual(settled);
      expect(await invoiceRow(early.id)).toEqual(early);
      expect((await history(o.id)).map((e) => `${e.kind}:${e.fromValue}>${e.toValue}`)).toEqual(['payment:pending>paid', 'payment:paid>refunded']);

      expect(await setManualPayment(o.id, 'pending', admin, { expected: 'refunded' })).toMatchObject(undone(1, [early.invoiceNo]));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
      // Alohida to'langan hisob-faktura o'z holida qolgan (`stillPaid`): to'lov haqiqatan kelmagan bo'lsa endi shu tugma bilan ochiladi.
      // Suratdan ochilgani esa "to'langan" emas — unga tugma tegmaydi
      expect(await run(reopenInvoice, { id: String(early.id) })).toBe(saved(early.id));
      expect(await money(early.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      expect(await run(reopenInvoice, { id: String(inv.id) })).toBe(refused(inv.id));
      expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
    });

    // ─── Bir vaqtda bosilganda: amal birinchi bo'lib BUYURTMA qatorini qulflaydi (boshqa to'lov amallari bilan bir xil tartib) ─────

    it('qayta ochish hali yakunlanmay turib buyurtma "to\'landi" qilinsa: "to\'landi" kutadi va qayta ochilgan hisob-fakturani o\'zi yopadi — suratda "berilgan, 0", belgi bekor qilinsa shu holatga qaytadi', async () => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 300000 });
      const inv = await paidInvoice(o.id, 300000);

      // Buyurtma qatori qulflangan: qayta ochish shu qulfda kutib turibdi (hisob-fakturaga hali tegmagan); "to'landi" ham shu qulfda,
      // navbatda undan keyin — qulf bo'shagach avval qayta ochish o'tadi
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
          const reopen = run(reopenInvoice, { id: String(inv.id) });
          await waitForBlocked(tx, 1);
          const mark = setManualPayment(o.id, 'paid', bot);
          await waitForBlocked(tx, 2);
          return { reopen, mark };
        },
        { timeout: 15_000 },
      );
      expect(await held.reopen).toBe(saved(inv.id));
      expect(await held.mark).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });

      // Buyurtma "to'langan" va hisob-fakturasi ochiq qolmagan: qayta ochilganini "to'landi" o'zi yopgan
      expect((await row(o.id)).paymentStatus).toBe('paid');
      expect(await money(inv.id)).toMatchObject({ status: 'paid', paidAmount: 300000 });
      expect((await history(o.id)).map((e) => [e.kind, `${e.fromValue}>${e.toValue}`, e.meta])).toEqual([
        ['invoice', 'paid>issued', { invoiceNo: inv.invoiceNo }],
        ['payment', 'pending>paid', { invoices: [{ id: inv.id, status: 'issued', paidAmount: '0', paidAt: null }] }],
      ]);
      expect(await undo(o.id)).toMatchObject(undone(1));
      expect(await money(inv.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
    });

    // Teskari tartib — ilgari xato shu yerda edi: "to'landi" buyurtmani yangilab bo'lgan, lekin hali yakunlanmagan paytda «Qayta ochish»
    // bosilsa, amal buyurtmani hali "to'lanmagan" deb ko'rib hisob-fakturani ochib yuborardi (buyurtma "to'langan", hisob-fakturasi
    // "berilgan, 0" bo'lib qolardi). Endi u buyurtma qatoridagi qulfni kutadi va yakunlangan holatni ko'radi
    it('"to\'landi" hali yakunlanmay turib «Qayta ochish» bosilsa: amal BUYURTMA qatoridagi qulfni kutadi va "to\'landi" yakunlangach rad etadi (error=state) — hisob-faktura to\'langanligicha, buyurtma "to\'langan" qoladi, tarixga qayta ochish yozilmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      // "To'landi" botdan (setManualPayment) va hisob-faktura sahifasidagi "To'liq to'landi"dan (boshqa hisob-fakturada)
      for (const how of ['bot', 'invoice'] as const) {
        const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 500000 });
        // Surati yo'q eski belgi bekor qilingach "to'langan" qolgan hisob-faktura (xodimga «Qayta ochish» tavsiya qilingan) va yana bitta ochiq
        const stuck = await paidInvoice(o.id, 300000);
        const open = await fx.invoice({ orderId: o.id, total: 200000, dueDate: soon() });
        clearSent();

        const held = await prisma.$transaction(
          async (tx) => {
            // Ochiq hisob-faktura qatori qulflangan: "to'landi" buyurtmani yangilab bo'lgan (buyurtma qatori — uning qulfida) va shu
            // hisob-fakturada kutib turibdi — tranzaksiyasi hali yakunlanmagan
            await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${open.id} FOR UPDATE`;
            const mark = how === 'bot' ? setManualPayment(o.id, 'paid', bot) : run(markPaid, { id: String(open.id) });
            await waitForBlocked(tx, 1);
            const reopen = run(reopenInvoice, { id: String(stuck.id) });
            await waitForBlocked(tx, 2);
            // Kim qaysi jadval qatorida navbatda turibdi (bazaning o'zidan, shu baza bo'yicha): "to'landi" — hisob-faktura qatorida
            // (bizning qulfimizni kutyapti, to'g'ridan-to'g'ri), «Qayta ochish» — buyurtma qatorida ("to'landi"ning qulfini, bizni faqat u orqali)
            const waiting = await tx.$queryRaw<{ table: string; direct: boolean }[]>`
              SELECT c.relname AS "table", pg_backend_pid() = ANY(pg_blocking_pids(l.pid)) AS direct
              FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
              WHERE l.locktype = 'tuple' AND l.granted AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
              ORDER BY c.relname`;
            // Tashqaridan qaralganda hali hech narsa o'zgarmagan (bu tranzaksiya faqat qulf ushlab turibdi — o'zi ham shuni ko'radi)
            const seen = {
              order: (await tx.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus,
              stuck: (await tx.corporateInvoice.findUniqueOrThrow({ where: { id: stuck.id } })).status,
              history: await tx.orderEvent.count({ where: { orderId: o.id } }),
            };
            return { mark, reopen, waiting, seen };
          },
          { timeout: 15_000 },
        );
        expect(held.waiting).toEqual([{ table: 'CorporateInvoice', direct: true }, { table: 'Order', direct: false }]);
        expect(held.seen).toEqual({ order: 'pending', stuck: 'paid', history: 0 });

        if (how === 'bot') expect(await held.mark).toMatchObject({ ok: true, changed: true, order: { paymentStatus: 'paid' } });
        else expect(await held.mark).toBe(saved(open.id));
        // «Qayta ochish» yakunlangan holatni ko'rdi: buyurtma "to'langan" — rad etadi, hech narsa yozmaydi
        expect(await held.reopen).toBe(refused(stuck.id));
        expect((await row(o.id)).paymentStatus).toBe('paid');
        expect(await invoiceRow(stuck.id)).toEqual(stuck);
        expect(await money(open.id)).toMatchObject({ status: 'paid', paidAmount: 200000 });
        expect((await history(o.id)).map((e) => [e.kind, `${e.fromValue}>${e.toValue}`, e.via, e.meta])).toEqual([
          ['payment', 'pending>paid', how === 'bot' ? 'staff_bot' : 'invoice', { invoices: [{ id: open.id, status: 'issued', paidAmount: '0', paidAt: null }] }],
        ]);
        expect(paymentMsgs(c.telegramId)).toEqual(['paid']);

        // Belgi bekor qilingach (buyurtma yana "to'lanmagan") o'sha tugma ishlaydi
        expect(await undo(o.id, admin)).toMatchObject(undone(1, [stuck.invoiceNo]));
        expect(await invoiceRow(open.id)).toEqual(reopenedAs(open));
        expect(await run(reopenInvoice, { id: String(stuck.id) })).toBe(saved(stuck.id));
        expect(await money(stuck.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
      }
    });

    it('buyurtma "to\'lanmagan"ga qaytarilayotgan (hali yakunlanmagan) paytda «Qayta ochish» bosilsa ham kutadi: yakunlangach belgi qaytarmagan hisob-fakturani ochadi, belgi o\'zi qaytargani esa endi "to\'langan" emas — rad', async () => {
      // Tugma alohida to'langan hisob-fakturada va belgi yopgan (surati bor) hisob-fakturada bosilgan
      for (const pressed of ['early', 'inv'] as const) {
        const o = await fx.order({ paymentMethod: 'bank_transfer', totalAmount: 500000 });
        const early = await paidInvoice(o.id, 300000);
        const inv = await fx.invoice({ orderId: o.id, total: 200000, paid: 80000, status: 'partial', dueDate: soon() });
        await setManualPayment(o.id, 'paid', bot);
        const target = pressed === 'early' ? early : inv;

        const held = await prisma.$transaction(
          async (tx) => {
            // Belgi bekor qilinmoqda: buyurtma yangilangan (qatori — uning qulfida), suratdagi hisob-fakturada kutib turibdi
            await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${inv.id} FOR UPDATE`;
            const revert = undo(o.id, admin);
            await waitForBlocked(tx, 1);
            // Tugma bosildi: hisob-faktura ham, buyurtma ham hozircha "to'langan" ko'rinadi — amal buyurtma qatorini kutadi
            const reopen = run(reopenInvoice, { id: String(target.id) });
            await waitForBlocked(tx, 2);
            return { revert, reopen };
          },
          { timeout: 15_000 },
        );
        expect(await held.revert).toMatchObject(undone(1, [early.invoiceNo]));
        // Eskirgan o'qishga qaraganda (buyurtma "to'langan" edi) ikkalasi ham rad etilardi — amal qulfdan keyingi holatga qaraydi
        expect(await held.reopen).toBe(pressed === 'early' ? saved(early.id) : refused(inv.id));

        expect((await row(o.id)).paymentStatus).toBe('pending');
        if (pressed === 'early') expect(await money(early.id)).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
        else expect(await invoiceRow(early.id)).toEqual(early);
        // Suratdan qaytgan hisob-faktura 0 ga tushib ketmagan
        expect(await invoiceRow(inv.id)).toEqual(reopenedAs(inv));
        expect((await history(o.id)).map((e) => [e.kind, `${e.fromValue}>${e.toValue}`, e.meta])).toEqual([
          ['payment', 'pending>paid', { invoices: [{ id: inv.id, status: 'partial', paidAmount: '80000', paidAt: null }] }],
          ['payment', 'paid>pending', { reopened: [inv.invoiceNo] }],
          ...(pressed === 'early' ? [['invoice', 'paid>issued', { invoiceNo: early.invoiceNo }]] : []),
        ]);
      }
    });

    it('tugma bir vaqtda ikki marta bosilsa (ikkalasi ham "to\'langan"ni o\'qib bo\'lgan) hisob-faktura bir marta ochiladi va tarixga bitta yozuv tushadi — qulf buyurtma qatorida bo\'lsa ham, hisob-faktura qatorida bo\'lsa ham', async () => {
      for (const locked of ['order', 'invoice'] as const) {
        const o = await fx.order({ paymentMethod: 'bank_transfer' });
        const inv = await paidInvoice(o.id, 100000);
        const id = String(inv.id);

        const held = await prisma.$transaction(
          async (tx) => {
            // Buyurtma qatori qulflansa ikkalasi ham shu qulfni kutadi; hisob-faktura qatori qulflansa birinchisi buyurtma qatorini
            // olib hisob-fakturada, ikkinchisi esa birinchisi ushlab turgan buyurtma qatorida kutadi
            if (locked === 'order') await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
            else await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${inv.id} FOR UPDATE`;
            const race = Promise.all([run(reopenInvoice, { id }), run(reopenInvoice, { id })]);
            await waitForBlocked(tx, 2);
            return { race };
          },
          { timeout: 15_000 },
        );
        expect((await held.race).sort(), locked).toEqual([refused(inv.id), saved(inv.id)]);
        expect(await money(inv.id), locked).toEqual({ status: 'issued', paidAmount: 0, paidAt: null });
        expect(await history(o.id), locked).toEqual([{ kind: 'invoice', fromValue: 'paid', toValue: 'issued', actor: 'Test Moliya', via: 'invoice', meta: { invoiceNo: inv.invoiceNo } }]);
        expect(await row(o.id), locked).toEqual(o);
      }
    });

    // Buyurtma qatori FOR NO KEY UPDATE bilan qulflanadi: boshqa tranzaksiyaning shu buyurtmaga tarix yozishi (tashqi kalit tekshiruvi
    // qatorga FOR KEY SHARE qo'yadi) u bilan to'qnashmaydi — to'lov tizimining tarix yozuvi qayta ochish tugashini kutib qolmaydi
    it('«Qayta ochish» buyurtma qatorini ushlab turganda ham shu buyurtmaga tarix yozuvi kutmasdan yoziladi', async () => {
      const o = await fx.order({ paymentMethod: 'click', paymentStatus: 'failed' });
      const inv = await paidInvoice(o.id, 100000);

      const held = await prisma.$transaction(
        async (tx) => {
          // Qayta ochish buyurtma qatorini qulflab bo'lgan va hisob-faktura qatorida kutib turibdi
          await tx.$queryRaw`SELECT id FROM "CorporateInvoice" WHERE id = ${inv.id} FOR UPDATE`;
          const reopen = run(reopenInvoice, { id: String(inv.id) });
          await waitForBlocked(tx, 1);
          // Click to'lov o'tmaganini xabar qildi: afterPaymentChange tarixga yozadi (boshqa ulanishdan). Kutib qolsa sinov osilib
          // turmasin — 4 soniyadan keyin "kutib qoldi" deb yakunlanadi
          let timer: ReturnType<typeof setTimeout> | undefined;
          const written = await Promise.race([
            afterPaymentChange(o, 'processing', { name: 'Click', via: 'click' }).then(() => 'yozildi'),
            new Promise<string>((resolve) => { timer = setTimeout(() => resolve('kutib qoldi'), 4000); }),
          ]);
          clearTimeout(timer);
          return { reopen, written, blocked: await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))` };
        },
        { timeout: 15_000 },
      );
      expect(held.written).toBe('yozildi');
      // Qayta ochish hali ham kutib turgan edi (tarix yozuvi uni chetlab o'tdi, navbatiga turmadi)
      expect(held.blocked).toEqual([{ n: 1 }]);
      expect(await held.reopen).toBe(saved(inv.id));
      expect((await history(o.id)).map((e) => [e.kind, `${e.fromValue}>${e.toValue}`, e.via])).toEqual([['payment', 'processing>failed', 'click'], ['invoice', 'paid>issued', 'invoice']]);
    });
  });

  describe('afterPaymentChange (Payme / Click / hisob-faktura yo\'li)', () => {
    it('onlayn to\'lov keldi: tarixga yoziladi, mijozga va "orders" ruxsati bor xodimlarga karta boradi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      const muted = await fx.user({ role: 'manager', telegramId: fx.tg(), telegramNotify: false });
      const p = await fx.product({ name: 'Paket <A&B>' });
      const o = await fx.order({ contactPhone: phone, customerName: 'Ali <b>Valiyev</b>', paymentMethod: 'payme', paymentStatus: 'paid', totalAmount: 480000, items: { create: [{ productId: p.id, quantity: 2, price: 240000 }] } });

      await afterPaymentChange(o, 'processing', { name: 'Payme', via: 'payme' });
      expect(await events(o.id)).toEqual([{ kind: 'payment', fromValue: 'processing', toValue: 'paid', actor: 'Payme', via: 'payme' }]);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId]);

      // Bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin — o'zimiznikiga qaraymiz
      const toWorker = outbox.staff.filter((m) => m.to === worker.telegramId);
      expect(toWorker).toHaveLength(1);
      expect(toWorker[0].html).toContain("To'lov qabul qilindi");
      expect(toWorker[0].html).toContain(`Buyurtma #${o.id}`);
      // Mijoz yozgan matn HTML sifatida o'tib ketmaydi
      expect(toWorker[0].html).toContain('Ali &lt;b&gt;Valiyev&lt;/b&gt;');
      expect(toWorker[0].html).toContain('Paket &lt;A&amp;B&gt; × 2');
      // Tugmalar staffCards.ts dagi kelishuv bo'yicha; onlayn to'lovda "To'landi" (op_) tugmasi bo'lmaydi
      expect(toWorker[0].inline?.flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []))).toEqual([`os_${o.id}_processing`, `oc_${o.id}`, `or_${o.id}`]);
      expect(outbox.staff.some((m) => m.to === muted.telegramId)).toBe(false);
      // Mijoz xabari ham, xodim kartasi ham shu buyurtmaning to'lov mavzusida (har biri o'z botining navbatida)
      expect(sent.topics).toEqual([{ to: c.telegramId, topic: paymentTopic(o.id) }]);
      expect(cardTopicsTo(worker)).toEqual([paymentTopic(o.id)]);
    });

    it('to\'lov o\'tmadi: faqat tarixga yoziladi, hech kimga xabar ketmaydi', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      await fx.user({ role: 'staff', telegramId: fx.tg() });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'click', paymentStatus: 'failed' });

      await afterPaymentChange(o, 'processing', { name: 'Click', via: 'click' });
      expect(await events(o.id)).toEqual([{ kind: 'payment', fromValue: 'processing', toValue: 'failed', actor: 'Click', via: 'click' }]);
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);
    });

    it('Payme/Click to\'lovi kelganda buyurtmaning ochiq hisob-fakturasi ham yopiladi; takror chaqirilsa hech narsa o\'zgarmaydi', async () => {
      for (const actor of [{ name: 'Payme', via: 'payme' }, { name: 'Click', via: 'click' }] satisfies Actor[]) {
        const o = await fx.order({ paymentMethod: actor.via, paymentStatus: 'paid', totalAmount: 345000.5 });
        const open = await fx.invoice({ orderId: o.id, total: 345000.5, dueDate: new Date(Date.now() - 86_400_000) });

        await afterPaymentChange(o, 'processing', actor, { notifyStaff: false });
        const settled = await invoiceRow(open.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(345000.5);
        expect(settled.paidAt).toBeInstanceOf(Date);
        // Onlayn to'lov belgisi qo'lda bekor qilinmaydi — tarix yozuvida hisob-faktura surati ham yo'q
        expect(await payments(o.id)).toEqual([{ fromValue: 'processing', toValue: 'paid', actor: actor.name, via: actor.via, meta: null }]);

        // To'lov tizimi so'rovni qayta yuborgan: yopilgan hisob-faktura qayta yozilmaydi
        expect(await settleInvoicesOfPaidOrder(o.id)).toEqual([]);
        expect(await invoiceRow(open.id)).toEqual(settled);
      }
    });

    it('settleInvoicesOfPaidOrder yopgan hisob-fakturalarining yopilishdan OLDINGI holatini qaytaradi; yopilmaganlari ro\'yxatga kirmaydi', async () => {
      const o = await fx.order({ paymentMethod: 'click', paymentStatus: 'paid' });
      const issued = await fx.invoice({ orderId: o.id, total: 400000, dueDate: soon() });
      const partial = await setPaidAt((await fx.invoice({ orderId: o.id, total: 1000000, paid: 300000.5, status: 'partial', dueDate: past() })).id, new Date('2026-09-30T10:20:30.456Z'));
      const overdue = await fx.invoice({ orderId: o.id, total: 50000.5, status: 'overdue', dueDate: past() });
      const cancelled = await fx.invoice({ orderId: o.id, total: 70000, status: 'cancelled', dueDate: past() });
      const already = await paidInvoice(o.id, 90000);

      expect(byId(await settleInvoicesOfPaidOrder(o.id))).toEqual([
        { id: issued.id, status: 'issued', paidAmount: '0', paidAt: null },
        { id: partial.id, status: 'partial', paidAmount: '300000.5', paidAt: '2026-09-30T10:20:30.456Z' },
        { id: overdue.id, status: 'overdue', paidAmount: '0', paidAt: null },
      ]);
      for (const inv of [issued, partial, overdue]) {
        const settled = await invoiceRow(inv.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(Number(inv.totalAmount));
      }
      expect(await invoiceRow(cancelled.id)).toEqual(cancelled);
      expect(await invoiceRow(already.id)).toEqual(already);
      expect(await settleInvoicesOfPaidOrder(o.id)).toEqual([]);

      // Buyurtma "to'langan" emas: hech narsa yopilmaydi, ro'yxat ham bo'sh
      const unpaid = await fx.order({ paymentMethod: 'bank_transfer' });
      const open = await fx.invoice({ orderId: unpaid.id, total: 100000, dueDate: soon() });
      expect(await settleInvoicesOfPaidOrder(unpaid.id)).toEqual([]);
      expect(await invoiceRow(open.id)).toEqual(open);
    });

    it('hisob-faktura faqat buyurtma bazada hozir ham "to\'langan" bo\'lsa yopiladi; hisob-faktura sahifasidan kelgan to\'lovda bu yerda tegilmaydi', async () => {
      const due = new Date(Date.now() + 86_400_000);
      // Webhook ishi fonda kechikkan, to'lov esa orada qaytarilgan: bazadagi holat "to'langan" emas
      const refunded = await fx.order({ paymentMethod: 'click', paymentStatus: 'refunded' });
      const stillOpen = await fx.invoice({ orderId: refunded.id, total: 100000, dueDate: due });
      await afterPaymentChange({ ...refunded, paymentStatus: 'paid' }, 'processing', { name: 'Click', via: 'click' }, { notifyStaff: false });
      expect(await settleInvoicesOfPaidOrder(refunded.id)).toEqual([]);
      expect(await invoiceRow(stillOpen.id)).toEqual(stillOpen);

      // Qisman to'langan hisob-faktura sahifasidan (via: invoice) chaqirilganda summani hisob-faktura amali o'zi yozgan
      const viaInvoice = await fx.order({ paymentMethod: 'bank_transfer', paymentStatus: 'paid' });
      const second = await fx.invoice({ orderId: viaInvoice.id, total: 100000, paid: 40000, status: 'partial', dueDate: due });
      await afterPaymentChange(viaInvoice, 'pending', { name: 'Test Admin', via: 'invoice' }, { notifyStaff: false });
      expect(await invoiceRow(second.id)).toEqual(second);
    });

    it('event: false — tarixga yozilmaydi (chaqiruvchi o\'z tranzaksiyasida yozib bo\'lgan), xabarlar esa odatdagidek ketadi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', paymentStatus: 'paid' });
      const moliya: Actor = { name: 'Test Moliya', via: 'invoice' };

      await afterPaymentChange(o, 'pending', moliya, { event: false });
      expect(await events(o.id)).toEqual([]);
      expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
      expect(outbox.staff.filter((m) => m.to === worker.telegramId)).toHaveLength(1);

      // Belgilanmasa (Payme / Click yo'li) yozuv shu yerda yoziladi — suratsiz
      await afterPaymentChange(o, 'pending', moliya);
      expect(await payments(o.id)).toEqual([{ fromValue: 'pending', toValue: 'paid', actor: 'Test Moliya', via: 'invoice', meta: null }]);
    });

    it('Payme/Click to\'lovida hisob-faktura tarix yozilmasa ham (event: false) yopiladi', async () => {
      for (const actor of [{ name: 'Payme', via: 'payme' }, { name: 'Click', via: 'click' }] satisfies Actor[]) {
        const o = await fx.order({ paymentMethod: actor.via, paymentStatus: 'paid', totalAmount: 120000 });
        const open = await fx.invoice({ orderId: o.id, total: 120000, dueDate: soon() });

        await afterPaymentChange(o, 'processing', actor, { notifyStaff: false, event: false });
        expect(await events(o.id)).toEqual([]);
        const settled = await invoiceRow(open.id);
        expect(settled.status).toBe('paid');
        expect(Number(settled.paidAmount)).toBe(120000);
      }
    });

    it('tuzatish xabari faqat qo\'lda bekor qilishda ("to\'langan" → "to\'lanmagan", admin yoki bot) ketadi: onlayn to\'lovda, hisob-faktura yo\'lida va "qaytarilgan"da yo\'q; xodimlarga tuzatish kartasi — faqat notifyStaff bo\'lsa', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      // Payme to'lovni bekor qildi: buyurtma "to'langan"dan "to'lanmagan"ga tushgan
      const online = await fx.order({ contactPhone: phone, paymentMethod: 'payme', paymentStatus: 'pending' });
      const inv = await paidInvoice(online.id, 100000);

      for (const actor of [{ name: 'Payme', via: 'payme' }, { name: 'Click', via: 'click' }, { name: 'Test Moliya', via: 'invoice' }, { name: 'Tizim', via: 'system' }] satisfies Actor[]) {
        await afterPaymentChange(online, 'paid', actor);
      }
      expect((await payments(online.id)).map((e) => [e.fromValue, e.toValue, e.via])).toEqual([['paid', 'pending', 'payme'], ['paid', 'pending', 'click'], ['paid', 'pending', 'invoice'], ['paid', 'pending', 'system']]);
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);

      const manual = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'pending' });
      for (const actor of [admin, bot]) {
        // "Qaytarilgan": belgi xato emas, pul qaytarilgan — tuzatish yuborilmaydi
        await afterPaymentChange({ ...manual, paymentStatus: 'refunded' }, 'paid', actor);
        // Boshqa holatdan "to'lanmagan"ga: mijoz "to'lov qabul qilindi" xabarini olmagan ("qaytarilgan"dan — faqat `reverted` belgisi
        // bilan tuzatish hisoblanadi, keyingi testda)
        for (const from of ['refunded', 'failed', 'processing', null] as const) await afterPaymentChange(manual, from, actor);
      }
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);

      // Qo'lda bekor qilish: har safar mijozga bitta tuzatish, "qabul qilindi" ketmaydi. O'sha to'lov xodimlarga e'lon qilinmagan
      // bo'lsa (setManualPayment shuni `notifyStaff: false` bilan aytadi) ularga karta ham ketmaydi
      for (const actor of [admin, bot]) await afterPaymentChange(manual, 'paid', actor, { event: false, notifyStaff: false });
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId, c.telegramId]);
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted', 'reverted']);
      expect(outbox.customer[0].html).toBe(fixHtml('uz', manual.id));
      expect(outbox.staff).toEqual([]);

      // E'lon qilingan to'lovning tuzatishi xodimlarga ham boradi (belgilanmasa ham — odatiy holat shu), kim bekor qilgani bilan
      clearOutbox();
      await afterPaymentChange(manual, 'paid', bot, { event: false, notifyStaff: true });
      await afterPaymentChange(manual, 'paid', admin, { event: false });
      expect(paymentMsgs(c.telegramId)).toEqual(['reverted', 'reverted']);
      expect(cardsTo(manager).map(noteOf)).toEqual(["↩️ <b>To'lov belgisi bekor qilindi</b> (Test Xodim)", "↩️ <b>To'lov belgisi bekor qilindi</b> (Test Admin)"]);
      expect(cardsTo(manager)[0].html).toContain(`<b>Buyurtma #${manual.id}</b>`);
      // Ism HTML sifatida o'tib ketmaydi
      clearOutbox();
      await afterPaymentChange(manual, 'paid', { name: 'Ali <b>&</b>', via: 'staff_bot' }, { event: false });
      expect(cardsTo(manager).map(noteOf)).toEqual(["↩️ <b>To'lov belgisi bekor qilindi</b> (Ali &lt;b&gt;&amp;&lt;/b&gt;)"]);
      // `event: false` bilan tarixga yozilmaydi (yuqoridagi 10 ta yozuv — tuzatishsiz chaqiruvlardan); hisob-fakturani qayta ochish ham
      // afterPaymentChange ishi emas (u setManualPayment tranzaksiyasida bajariladi)
      expect(await payments(manual.id)).toHaveLength(10);
      expect(await invoiceRow(inv.id)).toEqual(inv);
    });

    // setManualPayment `reverted`ni oxirgi "to'lanmagan"dan beri "to'landi" yozuvi bo'lgandagina beradi (to'langan → qaytarilgan → to'lanmagan)
    it('reverted: "qaytarilgan" → "to\'lanmagan" faqat shu belgi bilan tuzatish hisoblanadi (admin yoki bot); belgisiz, boshqa holatdan, boshqa yo\'ldan yoki boshqa holatga o\'tganda tuzatish ketmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const o = await fx.order({ contactPhone: phone, paymentMethod: 'cash', paymentStatus: 'pending' });
      // Xodimlarga yuborish yoqilgan: tuzatish noto'g'ri ketsa ularning kartasida ham ko'rinadi
      const base = { event: false, notifyStaff: true };

      for (const actor of [admin, bot]) {
        // Belgisiz yoki `reverted: false`: to'lanmagan → qaytarilgan → to'lanmagan (mijoz "qabul qilindi" xabarini olmagan)
        for (const opts of [{}, { reverted: false }]) await afterPaymentChange(o, 'refunded', actor, { ...base, ...opts });
        // Belgi faqat "qaytarilgan"dan kelganda ma'noga ega
        for (const from of ['failed', 'processing', 'pending', null] as const) await afterPaymentChange(o, from, actor, { ...base, reverted: true });
        // Yangi holat "to'lanmagan" emas: bu tuzatish emas
        for (const paymentStatus of ['refunded', 'failed', 'processing'] as const) await afterPaymentChange({ ...o, paymentStatus }, 'refunded', actor, { ...base, reverted: true });
      }
      // Qo'lda emas (onlayn to'lov, hisob-faktura sahifasi, tizim): belgi bo'lsa ham jim
      for (const actor of [{ name: 'Payme', via: 'payme' }, { name: 'Click', via: 'click' }, { name: 'Test Moliya', via: 'invoice' }, { name: 'Tizim', via: 'system' }] satisfies Actor[]) {
        await afterPaymentChange(o, 'refunded', actor, { ...base, reverted: true });
      }
      expect(outbox.customer).toEqual([]);
      expect(outbox.staff).toEqual([]);

      // "Qaytarilgan" → "to'langan" (belgi bilan ham) — odatdagi "qabul qilindi", tuzatish emas
      await afterPaymentChange({ ...o, paymentStatus: 'paid' }, 'refunded', admin, { event: false, notifyStaff: false, reverted: true });
      expect(paymentMsgs(c.telegramId)).toEqual(['paid']);
      expect(outbox.staff).toEqual([]);

      // Belgi bilan: mijozga bitta tuzatish; xodimlarga — faqat o'sha to'lov ularga e'lon qilingan bo'lsa (`notifyStaff`; belgilanmasa ham)
      clearSent();
      await afterPaymentChange(o, 'refunded', admin, { event: false, notifyStaff: false, reverted: true });
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', o.id, true, true)]);
      expect(sent.topics).toEqual([{ to: c.telegramId, topic: paymentTopic(o.id) }]);
      expect(outbox.staff).toEqual([]);

      clearSent();
      await afterPaymentChange(o, 'refunded', bot, { event: false, notifyStaff: true, reverted: true });
      await afterPaymentChange(o, 'refunded', admin, { event: false, reverted: true });
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', o.id, true, true), fixHtml('uz', o.id, true, true)]);
      expect(cardsTo(manager).map(noteOf)).toEqual([revertedCardNote('Test Xodim'), revertedCardNote('Test Admin')]);
      // Tuzatish kartasi ham to'lov mavzusida: navbatda kechikkan "To'lov qabul qilindi" kartasi undan keyin yetib bormaydi
      expect(cardTopicsTo(manager)).toEqual([paymentTopic(o.id), paymentTopic(o.id)]);
      // `event: false` — tarixga hech narsa yozilmagan
      expect(await payments(o.id)).toEqual([]);

      // Bekor qilingan buyurtmada jumla qisqaradi (to'lov kutilmaydi)
      clearSent();
      await afterPaymentChange({ ...o, status: 'cancelled' }, 'refunded', admin, { event: false, notifyStaff: false, reverted: true });
      expect(htmlTo(c.telegramId)).toEqual([fixHtml('uz', o.id, false, true)]);
    });
  });
});
