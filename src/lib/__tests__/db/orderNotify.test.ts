import type { Prisma, User } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, type Fixture } from './helpers';

/**
 * Soxta Telegram'ni sekinlashtirish yoki bitta oluvchida "yiqitish" va bir vaqtda nechta xabar yo'lda ekanini ko'rish uchun.
 * topics — mijozga ketgan har bir xabarning navbat mavzusi (notifyCustomer ning to'rtinchi dalili; mavzusiz xabarda null)
 */
const net = vi.hoisted(() => ({ delayMs: 0, inFlight: 0, peak: 0, failFor: null as string | null, topics: [] as { to: string; topic: string | null }[] }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram/notify', async () => {
  const real = (await import('./helpers')).notifyMock();
  const tracked = (send: typeof real.notifyStaff, topics?: typeof net.topics) => async (to: string | null | undefined, html: string, inline?: Parameters<typeof real.notifyStaff>[2], topic?: string) => {
    topics?.push({ to: String(to), topic: topic ?? null });
    net.inFlight += 1;
    net.peak = Math.max(net.peak, net.inFlight);
    try {
      if (net.delayMs) await new Promise((resolve) => setTimeout(resolve, net.delayMs));
      if (net.failFor && String(to) === net.failFor) throw new Error('test: xabar yuborilmadi');
      return await send(to, html, inline);
    } finally {
      net.inFlight -= 1;
    }
  };
  return { ...real, notifyCustomer: tracked(real.notifyCustomer, net.topics), notifyStaff: tracked(real.notifyStaff) };
});
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());

const { notifyCustomerInvoice, notifyCustomerOrderStatus, notifyCustomerPaid, notifyCustomerProduction, notifyStaffLead, notifyStaffNewOrder } = await import('@/lib/orderNotify');
const { getDict } = await import('@/lib/i18n');

describe.skipIf(!DB_TESTS)('orderNotify (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let worker: User;
  let manager: User;
  let muted: User;

  // Bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin — faqat o'zimiznikilarga kelgan xabarlarga qaraymiz
  const sentTo = (u: User) => outbox.staff.filter((m) => m.to === u.telegramId);
  const callbacks = (m: { inline?: { callback_data?: string }[][] }) => (m.inline ?? []).flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));

  beforeAll(async () => {
    fx = await fixture(6);
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
    manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
    muted = await fx.user({ role: 'admin', telegramId: fx.tg(), telegramNotify: false });
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    clearOutbox();
    Object.assign(net, { delayMs: 0, inFlight: 0, peak: 0, failFor: null });
    net.topics.length = 0;
  });

  describe('xodimlarga', () => {
    it('yangi buyurtma: karta va holat tugmalari "orders" ruxsati bor, xabarnomasi yoniq xodimlarga boradi', async () => {
      const p = await fx.product({ name: 'Skotch 48mm' });
      const phone = fx.phone();
      const o = await fx.order({ contactPhone: phone, customerName: 'Olim & Co <script>', paymentMethod: 'cash', totalAmount: 360000, comment: 'Ertalab <10:00> gacha', items: { create: [{ productId: p.id, quantity: 36, price: 10000 }] } });

      expect(await notifyStaffNewOrder(o.id)).toBeGreaterThanOrEqual(2);
      for (const u of [worker, manager]) {
        const [card, ...rest] = sentTo(u);
        expect(rest).toEqual([]);
        expect(card.html).toContain('Yangi buyurtma');
        expect(card.html).toContain(`Buyurtma #${o.id}`);
        expect(card.html).toContain('Olim &amp; Co &lt;script&gt;');
        expect(card.html).toContain('Ertalab &lt;10:00&gt; gacha');
        expect(card.html).toContain('Skotch 48mm × 36');
        expect(card.html).toMatch(/360\s000 so'm/);
        // staffCards.ts dagi kelishuv: qabul qilish, naqd to'lovni belgilash, bekor qilish, yangilash
        expect(callbacks(card)).toEqual([`os_${o.id}_processing`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
        for (const data of callbacks(card)) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      }
      expect(sentTo(muted)).toEqual([]);
    });

    it('yo\'q yoki o\'chirilgan buyurtma haqida xabar yuborilmaydi', async () => {
      const deleted = await fx.order({ deletedAt: new Date() });
      const gone = await fx.order();
      await prisma.order.delete({ where: { id: gone.id } });

      expect(await notifyStaffNewOrder(deleted.id)).toBe(0);
      expect(await notifyStaffNewOrder(gone.id)).toBe(0);
      expect(outbox.staff).toEqual([]);
    });

    it('yangi ariza: "leads" ruxsati bor xodimlarga, foydalanuvchi matni qochirilgan holda', async () => {
      expect(await notifyStaffLead(['📩 Yangi ariza', 'Ali <b>Valiyev</b>', null, undefined, 'Izoh: 5 > 3 & 2 < 4'])).toBeGreaterThanOrEqual(2);
      for (const u of [worker, manager]) expect(sentTo(u).map((m) => m.html)).toEqual(['📩 Yangi ariza\nAli &lt;b&gt;Valiyev&lt;/b&gt;\nIzoh: 5 &gt; 3 &amp; 2 &lt; 4']);
      expect(sentTo(muted)).toEqual([]);
    });

    it('hammaga birdaniga yuboriladi: Telegram sekin bo\'lsa kutish xodimlar soniga ko\'paymaydi', async () => {
      net.delayMs = 40;
      const o = await fx.order();
      const sent = await notifyStaffNewOrder(o.id);
      expect(sent).toBeGreaterThanOrEqual(2);
      // Ketma-ket yuborilganda bir vaqtda faqat bitta xabar yo'lda bo'lardi
      expect(net.peak).toBe(sent);
      for (const u of [worker, manager]) expect(sentTo(u)).toHaveLength(1);

      net.peak = 0;
      const leads = await notifyStaffLead(['📩 Yangi ariza']);
      expect(leads).toBeGreaterThanOrEqual(2);
      expect(net.peak).toBe(leads);
    });

    it('bitta xodimga yuborishdagi xato qolganlarga xalaqit bermaydi va sanoqqa kirmaydi', async () => {
      net.failFor = worker.telegramId;
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const sent = await notifyStaffLead(['📩 Yangi ariza']);
        // Sanoq — haqiqatan yetib borgan xabarlar soni (bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin)
        expect(sent).toBe(outbox.staff.length);
        expect(logged).toHaveBeenCalledTimes(1);
      } finally {
        logged.mockRestore();
      }
      expect(sentTo(worker)).toEqual([]);
      expect(sentTo(manager)).toHaveLength(1);
    });
  });

  describe('mijozga', () => {
    it('hisob-faktura berildi: summa, muddat va hisob-faktura havolasi bilan — har kim o\'z tilida', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, paymentMethod: 'bank_transfer', totalAmount: 1500000 });
      const invoice = await fx.invoice({ orderId: o.id, total: 1500000, dueDate: new Date('2026-10-25T00:00:00Z') });

      expect(await notifyCustomerInvoice(o.id, invoice)).toBe(2);
      const toUz = outbox.customer.find((m) => m.to === uz.telegramId);
      const toRu = outbox.customer.find((m) => m.to === ru.telegramId);
      expect(outbox.customer).toHaveLength(2);
      expect(toUz?.html).toContain(`Buyurtma #${o.id}`);
      expect(toUz?.html).toContain(`<b>${invoice.invoiceNo}</b>`);
      expect(toUz?.html).toMatch(/1\s500\s000 so'm/);
      expect(toUz?.html).toContain('25.10.2026');
      expect(toRu?.html).toContain(`Заказ #${o.id}`);
      expect(toRu?.html).toMatch(/1\s500\s000 сум/);
      // "Batafsil" tugmasi (o_<id>) va hisob-faktura sahifasi
      expect(toUz?.inline?.[0][0].callback_data).toBe(`o_${o.id}`);
      expect(toUz?.inline?.[1][0].url).toMatch(new RegExp(`/uz/orders/${o.accessToken}/invoice$`));
      expect(toRu?.inline?.[1][0].url).toMatch(new RegExp(`/ru/orders/${o.accessToken}/invoice$`));
      expect(toUz?.html).toContain("To'lov muddati: 25.10.2026");
      expect(toRu?.html).toContain('Срок оплаты: 25.10.2026');
      // «Счёт-фактура» erkak jinsida (birinchi so'zi bo'yicha) — kartadagi «Оплачен полностью» bilan bir xil
      expect(toRu?.html).toContain(`Счёт-фактура <b>${invoice.invoiceNo}</b> готов.\n`);
    });

    it('allaqachon to\'langan buyurtmaga berilgan hisob-faktura: xabarda to\'lov muddati yozilmaydi', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, paymentMethod: 'payme', paymentStatus: 'paid', totalAmount: 345000 });
      const invoice = await fx.invoice({ orderId: o.id, total: 345000, dueDate: new Date('2026-10-25T00:00:00Z') });

      expect(await notifyCustomerInvoice(o.id, invoice)).toBe(2);
      const toUz = outbox.customer.find((m) => m.to === uz.telegramId);
      const toRu = outbox.customer.find((m) => m.to === ru.telegramId);
      expect(toUz?.html).toMatch(new RegExp(`^🧾 <b>Buyurtma #${o.id}</b>\nHisob-faktura <b>${invoice.invoiceNo}</b> tayyor\\.\nSumma: <b>345\\s000 so'm</b>$`));
      expect(toRu?.html).toMatch(new RegExp(`^🧾 <b>Заказ #${o.id}</b>\nСчёт-фактура <b>${invoice.invoiceNo}</b> готов\\.\nСумма: <b>345\\s000 сум</b>$`));
      for (const m of [toUz, toRu]) expect(m?.html).not.toContain('25.10.2026');
      // Puli qaytarilgan va bekor qilingan buyurtmalar ham "qarz emas" (balans va karta bilan bir xil qoida): muddat yozilmaydi
      for (const state of [{ paymentStatus: 'refunded' as const }, { status: 'cancelled' as const }]) {
        outbox.customer.length = 0;
        const other = await fx.order({ contactPhone: phone, paymentMethod: 'bank_transfer', totalAmount: 345000, ...state });
        const inv = await fx.invoice({ orderId: other.id, total: 345000, dueDate: new Date('2026-10-25T00:00:00Z') });
        expect(await notifyCustomerInvoice(other.id, inv)).toBe(1);
        expect(outbox.customer[0].html).not.toMatch(/To'lov muddati|25\.10\.2026/);
      }
      // Hujjat havolasi o'z joyida
      expect(toUz?.inline?.[1][0].url).toMatch(new RegExp(`/uz/orders/${o.accessToken}/invoice$`));
    });

    it('bir buyurtmaning barcha oluvchilariga birdaniga yuboriladi; bittasidagi xato ikkinchisiga xalaqit bermaydi', async () => {
      const phone = fx.phone();
      const first = await fx.customer({ phone });
      const second = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: second.telegramId, status: 'processing' });
      const wo = { id: 7, orderId: o.id, productName: 'Quti', currentStage: 'gofra' as const, progress: 10, status: 'in_progress' };

      net.delayMs = 40;
      expect(await notifyCustomerProduction(wo)).toBe(2);
      expect(net.peak).toBe(2);
      // Ikkala oluvchiga ham bir xil mavzu bilan (navbat har bir oluvchi uchun alohida yuritiladi)
      expect(net.topics.map((t) => t.topic)).toEqual([`order-production:${o.id}:7`, `order-production:${o.id}:7`]);
      expect(net.topics.map((t) => t.to).sort()).toEqual([first.telegramId, second.telegramId].sort());

      clearOutbox();
      net.failFor = first.telegramId;
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        expect(await notifyCustomerProduction(wo)).toBe(1);
        expect(logged).toHaveBeenCalledTimes(1);
      } finally {
        logged.mockRestore();
      }
      expect(outbox.customer.map((m) => m.to)).toEqual([second.telegramId]);
    });

    it('ishlab chiqarish bosqichi: bosqich nomi va foiz; yakunlanganda "tayyor"', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, status: 'processing' });

      expect(await notifyCustomerProduction({ id: 7, orderId: o.id, productName: 'Quti <30x20>', currentStage: 'pechat', progress: 40.4, status: 'in_progress' })).toBe(1);
      expect(await notifyCustomerProduction({ id: 7, orderId: o.id, productName: 'Quti <30x20>', currentStage: 'qc', progress: 80, status: 'completed' })).toBe(1);
      expect(outbox.customer.map((m) => m.to)).toEqual([c.telegramId, c.telegramId]);
      const [stage, done] = outbox.customer.map((m) => m.html);
      expect(stage).toContain(`Buyurtma #${o.id}`);
      expect(stage).toContain('Quti &lt;30x20&gt;');
      expect(stage).toContain(`<b>${getDict('uz').order.stages.pechat}</b>`);
      expect(stage).toContain('(40%)');
      expect(done).toContain('<b>tayyor</b> (100%)');
      // Bitta topshiriqning bosqichlari — bitta mavzu: navbatda yangi bosqich eskisining o'rnini bosadi
      expect(net.topics.map((t) => t.topic)).toEqual([`order-production:${o.id}:7`, `order-production:${o.id}:7`]);
    });

    // Ilgari mavzu mahsulot nomidan yasalardi: bitta buyurtmada bir xil mahsulotning ikki topshirig'i (ikki partiya) bitta mavzuga tushib,
    // navbatda bir-birining xabarini bekor qilardi
    it('xabarlarning navbat mavzusi: ishlab chiqarish — buyurtma va TOPSHIRIQ raqami bo\'yicha (mahsulot nomi bo\'yicha emas), holat — buyurtma bo\'yicha, to\'lov va hisob-faktura — mavzusiz', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, status: 'processing' });
      const other = await fx.order({ contactPhone: phone, status: 'processing' });
      const invoice = await fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date('2031-01-15T00:00:00Z') });
      const wo = (id: number, orderId: number) => ({ id, orderId, productName: 'Quti 30x20', currentStage: 'gofra' as const, progress: 10, status: 'in_progress' });

      expect(await notifyCustomerProduction(wo(7, o.id))).toBe(1);
      expect(await notifyCustomerProduction(wo(8, o.id))).toBe(1); // shu mahsulotning ikkinchi topshirig'i
      expect(await notifyCustomerProduction(wo(7, other.id))).toBe(1); // boshqa buyurtma
      expect(await notifyCustomerProduction({ ...wo(7, o.id), productName: 'Nomi o\'zgargan quti' })).toBe(1); // o'sha topshiriq
      expect(await notifyCustomerOrderStatus(o)).toBe(1);
      expect(await notifyCustomerPaid(o)).toBe(1);
      expect(await notifyCustomerInvoice(o.id, invoice)).toBe(1);
      expect(net.topics.map((t) => t.topic)).toEqual([
        `order-production:${o.id}:7`,
        `order-production:${o.id}:8`,
        `order-production:${other.id}:7`,
        `order-production:${o.id}:7`,
        `order-status:${o.id}`,
        null,
        null,
      ]);
      expect(JSON.stringify(net.topics)).not.toMatch(/Quti|quti/);
    });

    // Bekor qilingan buyurtma uchun yangi ishlab chiqarish xabari chiqmaydi — navbatda turganlarini "bekor qilindi" xabarining o'zi tozalaydi
    it('buyurtma bekor qilinsa navbatda turgan ishlab chiqarish xabarlari bekor bo\'ladi (haqiqiy bazada); boshqa holat o\'zgarishi va boshqa buyurtma ularga tegmaydi', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const second = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: second.telegramId, status: 'processing' });
      const chats = [c.telegramId, second.telegramId];
      // Navbat butun bazaga bitta: vaqtlar uzoq kelajakda — boshqa fayllarning ticklari bu qatorlarni "vaqti kelgan" deb olmaydi
      const far = new Date('2099-01-01T00:00:00.000Z');
      const queue = (data: Partial<Prisma.BotOutboxUncheckedCreateInput>) =>
        prisma.botOutbox.create({ data: { bot: 'customer', chatId: c.telegramId, html: '🏭 <b>Buyurtma</b>', nextAt: far, createdAt: far, lastError: 'fetch failed', ...data } });
      const mine = (ids: number[]) => prisma.botOutbox.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
      try {
        const target = [
          await queue({ topic: `order-production:${o.id}:7` }),
          await queue({ topic: `order-production:${o.id}:7`, chatId: second.telegramId, attempts: 4 }), // boshqa oluvchi
          await queue({ topic: `order-production:${o.id}:8` }), // shu buyurtmaning boshqa topshirig'i
        ];
        const kept = [
          await queue({ topic: `order-production:${o.id}1:7` }), // raqami shu bilan boshlanadigan boshqa buyurtma (15 va 151 kabi)
          await queue({ topic: `order-status:${o.id}` }),
          await queue({ topic: null }), // mavzusiz (to'lov, hisob-faktura)
          await queue({ topic: `order-production:${o.id}:7`, bot: 'staff' }),
          await queue({ topic: `order-production:${o.id}:7`, sentAt: far, lastError: null }), // allaqachon yetib borgan
          await queue({ topic: `order-production:${o.id}:7`, failedAt: far, lastError: 'Telegram sendMessage: 403 Forbidden' }), // haqiqiy xato
        ];
        const all = [...target, ...kept].map((r) => r.id);

        // Oddiy holat o'zgarishi navbatdagi ishlab chiqarish xabarlariga tegmaydi
        for (const status of ['shipping', 'delivered'] as const) expect(await notifyCustomerOrderStatus({ ...o, status })).toBe(2);
        expect(await mine(all)).toEqual([...target, ...kept]);

        const started = Date.now();
        clearOutbox();
        expect(await notifyCustomerOrderStatus({ ...o, status: 'cancelled' })).toBe(2);
        expect(outbox.customer.map((m) => m.to).sort()).toEqual([...chats].sort());
        expect(outbox.customer.find((m) => m.to === c.telegramId)?.html).toContain('Buyurtmangiz bekor qilindi.');
        const after = await mine(target.map((r) => r.id));
        expect(after.map((r) => ({ ...r, failedAt: null, lastError: null }))).toEqual(target.map((r) => ({ ...r, failedAt: null, lastError: null })));
        for (const r of after) {
          expect(r.lastError).toBe('eskirgan');
          expect(r.failedAt!.getTime()).toBeGreaterThanOrEqual(started);
          expect(r.failedAt!.getTime()).toBeLessThanOrEqual(Date.now());
        }
        expect(await mine(kept.map((r) => r.id))).toEqual(kept);
      } finally {
        await prisma.botOutbox.deleteMany({ where: { chatId: { in: chats } } });
      }
    });

    it('buyurtmaga bog\'lanmagan topshiriq, bekor qilingan yoki o\'chirilgan buyurtma: xabar yo\'q', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const cancelled = await fx.order({ contactPhone: phone, status: 'cancelled' });
      const deleted = await fx.order({ contactPhone: phone, deletedAt: new Date() });
      const wo = { id: 7, productName: 'Quti', currentStage: 'gofra' as const, progress: 10, status: 'in_progress' };

      expect(await notifyCustomerProduction({ ...wo, orderId: null })).toBe(0);
      expect(await notifyCustomerProduction({ ...wo, orderId: cancelled.id })).toBe(0);
      expect(await notifyCustomerProduction({ ...wo, orderId: deleted.id })).toBe(0);
      expect(await notifyCustomerInvoice(deleted.id, { invoiceNo: 'INV-X', totalAmount: 1000, dueDate: new Date() })).toBe(0);
      expect(outbox.customer).toEqual([]);
    });
  });
});
