import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { displayPhone } from '@/lib/format';
import type { Actor } from '@/lib/orderFlow';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, TEST_SETTINGS, waitForBlocked, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/notify', async () => (await import('./helpers')).notifyMock());
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());

const { afterPaymentChange, changeOrderStatus, setManualPayment, settleInvoicesOfPaidOrder } = await import('@/lib/orderFlow');
const { customerDebt } = await import('@/lib/customerAccount');
const { getDict } = await import('@/lib/i18n');

const admin: Actor = { name: 'Test Admin', via: 'admin' };
const bot: Actor = { name: 'Test Xodim', via: 'staff_bot' };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe.skipIf(!DB_TESTS)('orderFlow (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(1);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(clearOutbox);

  const row = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
  const events = (orderId: number) =>
    prisma.orderEvent.findMany({ where: { orderId }, orderBy: { id: 'asc' }, select: { kind: true, fromValue: true, toValue: true, actor: true, via: true } });
  const invoiceRow = (id: number) => prisma.corporateInvoice.findUniqueOrThrow({ where: { id } });
  const htmlTo = (telegramId: string) => outbox.customer.filter((m) => m.to === telegramId).map((m) => m.html);

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

    it('"to\'langan" bo\'lganda buyurtmaning ochiq hisob-fakturalari ham yopiladi; bekor qilinganiga tegilmaydi, to\'lov qaytarilsa hisob-faktura o\'zgarmaydi', async () => {
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

      // Tuzatish ("to'lanmagan" yoki "qaytarilgan"): hisob-fakturaga tegilmaydi — yopilgan hujjat o'z-o'zidan qayta ochilmaydi
      const settled = [await invoiceRow(partial.id), await invoiceRow(legacy.id)];
      expect(await setManualPayment(o.id, 'pending', admin)).toMatchObject({ ok: true, changed: true });
      expect(await setManualPayment(o.id, 'refunded', admin)).toMatchObject({ ok: true, changed: true });
      expect([await invoiceRow(partial.id), await invoiceRow(legacy.id)]).toEqual(settled);
      expect(await invoiceRow(cancelled.id)).toEqual(cancelled);
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
      expect(await held.call).toMatchObject({ ok: false, reason: 'conflict' });

      expect((await row(o.id)).paymentStatus).toBe('refunded');
      expect(await invoiceRow(open.id)).toEqual(open);
      expect(await events(o.id)).toEqual([]);
      expect(outbox.customer).toEqual([]);
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

        // To'lov tizimi so'rovni qayta yuborgan: yopilgan hisob-faktura qayta yozilmaydi
        expect(await settleInvoicesOfPaidOrder(o.id)).toBe(0);
        expect(await invoiceRow(open.id)).toEqual(settled);
      }
    });

    it('hisob-faktura faqat buyurtma bazada hozir ham "to\'langan" bo\'lsa yopiladi; hisob-faktura sahifasidan kelgan to\'lovda bu yerda tegilmaydi', async () => {
      const due = new Date(Date.now() + 86_400_000);
      // Webhook ishi fonda kechikkan, to'lov esa orada qaytarilgan: bazadagi holat "to'langan" emas
      const refunded = await fx.order({ paymentMethod: 'click', paymentStatus: 'refunded' });
      const stillOpen = await fx.invoice({ orderId: refunded.id, total: 100000, dueDate: due });
      await afterPaymentChange({ ...refunded, paymentStatus: 'paid' }, 'processing', { name: 'Click', via: 'click' }, { notifyStaff: false });
      expect(await settleInvoicesOfPaidOrder(refunded.id)).toBe(0);
      expect(await invoiceRow(stillOpen.id)).toEqual(stillOpen);

      // Qisman to'langan hisob-faktura sahifasidan (via: invoice) chaqirilganda summani hisob-faktura amali o'zi yozgan
      const viaInvoice = await fx.order({ paymentMethod: 'bank_transfer', paymentStatus: 'paid' });
      const second = await fx.invoice({ orderId: viaInvoice.id, total: 100000, paid: 40000, status: 'partial', dueDate: due });
      await afterPaymentChange(viaInvoice, 'pending', { name: 'Test Admin', via: 'invoice' }, { notifyStaff: false });
      expect(await invoiceRow(second.id)).toEqual(second);
    });
  });
});
