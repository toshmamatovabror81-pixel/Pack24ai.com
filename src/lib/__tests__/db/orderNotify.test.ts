import type { OrderStatus, Prisma, User } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, TEST_SETTINGS, type Fixture } from './helpers';
import { displayPhone } from '@/lib/format';

/**
 * Soxta Telegram'ni sekinlashtirish yoki bitta oluvchida "yiqitish" va bir vaqtda nechta xabar yo'lda ekanini ko'rish uchun.
 * topics — mijozga ketgan har bir xabarning navbat mavzusi (notifyCustomer ning to'rtinchi dalili; mavzusiz xabarda null);
 * staffTopics — xodimlarga ketgan har bir xabarniki (notifyStaff ning to'rtinchi dalili): faqat to'lov kartalari mavzuli
 * phone — do'kon telefoni (null — helpers.ts dagi standart, '' — kiritilmagan); sections — xodimlar ro'yxati qaysi bo'lim uchun so'ralgani;
 * keyboardFail — shu shartga mos xodimning tugmalarini yasash "yiqiladi" (staffOrderKeyboard dalillari: canEdit, canPay)
 */
const net = vi.hoisted(() => ({
  delayMs: 0, inFlight: 0, peak: 0, failFor: null as string | null, topics: [] as { to: string; topic: string | null }[], staffTopics: [] as { to: string; topic: string | null }[],
  phone: null as string | null, sections: [] as string[], keyboardFail: null as ((canEdit: boolean, canPay: boolean) => boolean) | null,
}));

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
  return { ...real, notifyCustomer: tracked(real.notifyCustomer, net.topics), notifyStaff: tracked(real.notifyStaff, net.staffTopics) };
});
vi.mock('@/lib/settings', async () => {
  const { TEST_SETTINGS: base } = await import('./helpers');
  return { getSettings: async () => ({ ...base, phone: net.phone ?? base.phone }) };
});
// Ikkalasi ham haqiqiy modul: faqat ro'yxat qaysi bo'lim uchun so'ralgani yozib olinadi va tugma yasashga bitta "yiqitish" nuqtasi qo'shilgan
vi.mock('@/lib/telegram/staffLink', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/telegram/staffLink')>();
  return {
    ...real,
    staffRecipients: (section: Parameters<typeof real.staffRecipients>[0]) => {
      net.sections.push(section);
      return real.staffRecipients(section);
    },
  };
});
vi.mock('@/lib/telegram/staffCards', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/telegram/staffCards')>();
  return {
    ...real,
    staffOrderKeyboard: (...args: Parameters<typeof real.staffOrderKeyboard>) => {
      if (net.keyboardFail?.(args[1], args[2] ?? false)) throw new Error('test: tugmalar yasalmadi');
      return real.staffOrderKeyboard(...args);
    },
  };
});

const { notifyCustomerInvoice, notifyCustomerOrderStatus, notifyCustomerPaid, notifyCustomerPaymentReverted, notifyCustomerProduction, notifyStaffLead, notifyStaffNewOrder, notifyStaffPaid, notifyStaffPaymentReverted } = await import('@/lib/orderNotify');
const { getDict } = await import('@/lib/i18n');

/**
 * To'lov tuzatishi xabarining ikkinchi satri gaplarga bo'lib (orderNotify.ts dagi paymentReverted): `unpaid` — "hozircha to'lanmagan"
 * gapi, u faqat to'lov kutilayotgan (bekor qilinmagan) buyurtmada yoziladi
 */
const CORRECTION = {
  uz: { first: 'Tuzatish: bu buyurtma bo\'yicha «to\'lov qabul qilindi» belgisi xato qo\'yilgan edi — u olib tashlandi.', unpaid: 'Buyurtma hozircha <b>to\'lanmagan</b> deb hisoblanadi.', sorry: 'Noqulaylik uchun uzr so\'raymiz.' },
  ru: { first: 'Исправление: отметка «оплата получена» по этому заказу была поставлена по ошибке и снята.', unpaid: 'Заказ пока считается <b>неоплаченным</b>.', sorry: 'Приносим извинения за неудобство.' },
};
const correction = (lang: keyof typeof CORRECTION, owed: boolean) => [CORRECTION[lang].first, ...(owed ? [CORRECTION[lang].unpaid] : []), CORRECTION[lang].sorry].join(' ');

describe.skipIf(!DB_TESTS)('orderNotify (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let worker: User;
  let manager: User;
  let admin: User;
  let muted: User;

  // Bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin — faqat o'zimiznikilarga kelgan xabarlarga qaraymiz
  const sentTo = (u: User) => outbox.staff.filter((m) => m.to === u.telegramId);
  /** Shu xodimga ketgan xabarlarning navbat mavzulari, yuborilgan tartibda (mavzusiz xabarda null) */
  const topicsTo = (u: User) => net.staffTopics.filter((t) => t.to === u.telegramId).map((t) => t.topic);
  const callbacks = (m: { inline?: { callback_data?: string }[][] }) => (m.inline ?? []).flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));
  /** To'lov tugmalari: op_ — «To'landi», ou_ — «To'lov belgisini bekor qilish» (staffCards.ts); xodimga kelgan birinchi kartadan olinadi */
  const isPay = (data: string) => /^o[pu]_/.test(data);
  const payButtons = (u: User) => callbacks(sentTo(u)[0]).filter(isPay);
  const otherButtons = (u: User) => callbacks(sentTo(u)[0]).filter((d) => !isPay(d));

  beforeAll(async () => {
    fx = await fixture(6);
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
    manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
    admin = await fx.user({ role: 'admin', telegramId: fx.tg() });
    muted = await fx.user({ role: 'admin', telegramId: fx.tg(), telegramNotify: false });
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    clearOutbox();
    Object.assign(net, { delayMs: 0, inFlight: 0, peak: 0, failFor: null, phone: null, keyboardFail: null });
    net.topics.length = 0;
    net.staffTopics.length = 0;
    net.sections.length = 0;
  });

  describe('xodimlarga', () => {
    it('yangi buyurtma: karta va holat tugmalari "orders" ruxsati bor, xabarnomasi yoniq xodimlarga boradi; «To\'landi» tugmasi — faqat moliya ruxsati borlarga', async () => {
      const p = await fx.product({ name: 'Skotch 48mm' });
      const phone = fx.phone();
      const o = await fx.order({ contactPhone: phone, customerName: 'Olim & Co <script>', paymentMethod: 'cash', totalAmount: 360000, comment: 'Ertalab <10:00> gacha', items: { create: [{ productId: p.id, quantity: 36, price: 10000 }] } });

      expect(await notifyStaffNewOrder(o.id)).toBeGreaterThanOrEqual(3);
      for (const u of [worker, manager, admin]) {
        const [card, ...rest] = sentTo(u);
        expect(rest).toEqual([]);
        expect(card.html).toContain('Yangi buyurtma');
        expect(card.html).toContain(`Buyurtma #${o.id}`);
        expect(card.html).toContain('Olim &amp; Co &lt;script&gt;');
        expect(card.html).toContain('Ertalab &lt;10:00&gt; gacha');
        expect(card.html).toContain('Skotch 48mm × 36');
        expect(card.html).toMatch(/360\s000 so'm/);
        for (const data of callbacks(card)) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      }
      // staffCards.ts dagi kelishuv: qabul qilish, naqd to'lovni belgilash, bekor qilish, yangilash. «To'landi» (op_) hisob-fakturani ham
      // yopadi, shuning uchun u faqat "finance" ruxsati bor xodimning (menejer, administrator) kartasida; oddiy xodimda holat tugmalari qoladi
      for (const u of [manager, admin]) expect(callbacks(sentTo(u)[0])).toEqual([`os_${o.id}_processing`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
      expect(callbacks(sentTo(worker)[0])).toEqual([`os_${o.id}_processing`, `oc_${o.id}`, `or_${o.id}`]);
      expect(sentTo(manager)[0].inline?.[1]).toEqual([{ text: '💵 To\'landi', callback_data: `op_${o.id}` }, { text: '❌ Bekor qilish', callback_data: `oc_${o.id}` }]);
      // Matn hammaga bir xil — faqat tugmalar farq qiladi
      expect(new Set([worker, manager, admin].map((u) => sentTo(u)[0].html)).size).toBe(1);
      expect(sentTo(muted)).toEqual([]);
      // Yangi buyurtma — hodisa: karta navbat mavzusisiz ketadi (navbatda hech narsaning o'rnini bosmaydi)
      for (const u of [worker, manager, admin]) expect(topicsTo(u)).toEqual([null]);
    });

    it('to\'langan naqd buyurtma kartasi (notifyStaffPaid): «To\'lov belgisini bekor qilish» faqat moliya ruxsati bor xodimda; oddiy xodimda holat tugmalari qoladi', async () => {
      const o = await fx.order({ status: 'processing', paymentMethod: 'cash', paymentStatus: 'paid' });

      expect(await notifyStaffPaid(o.id, 'Kassa <1>')).toBeGreaterThanOrEqual(3);
      for (const u of [worker, manager, admin]) {
        expect(sentTo(u)).toHaveLength(1);
        expect(sentTo(u)[0].html).toContain('✅ <b>To\'lov qabul qilindi</b> (Kassa &lt;1&gt;)');
        expect(sentTo(u)[0].html).toContain(`Buyurtma #${o.id}`);
        for (const data of callbacks(sentTo(u)[0])) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      }
      for (const u of [manager, admin]) expect(callbacks(sentTo(u)[0])).toEqual([`os_${o.id}_shipping`, `oc_${o.id}`, `ou_${o.id}`, `or_${o.id}`]);
      expect(callbacks(sentTo(worker)[0])).toEqual([`os_${o.id}_shipping`, `oc_${o.id}`, `or_${o.id}`]);
      // Alohida qatorda: buyurtmani «Bekor qilish» tugmasi bilan yonma-yon turib adashtirilmasin
      expect(sentTo(admin)[0].inline?.[1]).toEqual([{ text: '❌ Bekor qilish', callback_data: `oc_${o.id}` }]);
      expect(sentTo(admin)[0].inline?.[2]).toEqual([{ text: '↩️ To\'lov belgisini bekor qilish', callback_data: `ou_${o.id}` }]);
      expect(sentTo(muted)).toEqual([]);
      // To'lov kartasi mavzuli (mijozga ketadigan to'lov xabarlari bilan bir xil satr): navbatda qolsa, keyingi tuzatish uning o'rnini bosadi
      for (const u of [worker, manager, admin]) expect(topicsTo(u)).toEqual([`order-payment:${o.id}`]);
    });

    // Xodimlarga e'lon qilingan to'lov ("To'lov qabul qilindi" kartasi) xato bo'lib chiqdi: chatida o'sha karta qolgan xodim to'lanmagan
    // buyurtmani jo'natib yubormasin — belgi bekor qilingani ham kartasi bilan shu xodimlarga boradi (orderFlow.afterPaymentChange)
    it('to\'lov belgisi bekor qilindi (notifyStaffPaymentReverted): izohli karta "orders" ruxsati bor xodimlarga; buyurtma yana to\'lanmagan — «To\'landi» moliya ruxsati borlarning kartasida qaytadan chiqadi, oddiy xodimda yo\'q', async () => {
      const client = await fx.user({ role: 'user', telegramId: fx.tg() });
      const o = await fx.order({ status: 'processing', paymentMethod: 'cash', paymentStatus: 'pending', totalAmount: 360000 });

      const sent = await notifyStaffPaymentReverted(o.id, 'Ali <admin> & Co');
      expect(sent).toBe(outbox.staff.length);
      expect(sent).toBeGreaterThanOrEqual(3);
      // "To'lov qabul qilindi" kartasi bilan bir xil oluvchilar: "finance" emas, "orders" bo'limi
      expect(net.sections).toEqual(['orders']);
      for (const u of [worker, manager, admin]) {
        const [card, ...rest] = sentTo(u);
        expect(rest).toEqual([]);
        // Izoh birinchi satrda, kim bekor qilgani HTML uchun qochirilgan; keyin bo'sh satr va buyurtma kartasi
        expect(card.html.split('\n').slice(0, 3)).toEqual(['↩️ <b>To\'lov belgisi bekor qilindi</b> (Ali &lt;admin&gt; &amp; Co)', '', `⚙️ <b>Buyurtma #${o.id}</b> · Tayyorlanmoqda`]);
        // Karta buyurtmaning hozirgi holatini ko'rsatadi: to'lanmagan
        expect(card.html).toMatch(/💰 <b>360\s000 so'm<\/b> · Naqd · To'lanmagan/);
        for (const data of callbacks(card)) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      }
      // Buyurtma yana to'lanmagan: «To'landi» (op_) moliya ruxsati bor xodimga qaytadi, belgini bekor qilish (ou_) esa hech kimda yo'q
      for (const u of [manager, admin]) expect(callbacks(sentTo(u)[0])).toEqual([`os_${o.id}_shipping`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
      expect(callbacks(sentTo(worker)[0])).toEqual([`os_${o.id}_shipping`, `oc_${o.id}`, `or_${o.id}`]);
      expect(sentTo(admin)[0].inline?.[1]).toEqual([{ text: '💵 To\'landi', callback_data: `op_${o.id}` }, { text: '❌ Bekor qilish', callback_data: `oc_${o.id}` }]);
      // Matn hammaga bir xil — faqat tugmalar farq qiladi
      expect(new Set([worker, manager, admin].map((u) => sentTo(u)[0].html)).size).toBe(1);
      for (const u of [muted, client]) expect(sentTo(u)).toEqual([]);
      // "To'lov qabul qilindi" kartasi bilan bitta mavzuda: navbatda kechikkan "qabul qilindi" tuzatishdan keyin yetib bormaydi
      for (const u of [worker, manager, admin]) expect(topicsTo(u)).toEqual([`order-payment:${o.id}`]);
    });

    // Navbat mavzusi (telegram/outbox.ts): "To'lov qabul qilindi" kartasi va uning tuzatishi bitta mavzuda — Telegram ishlamay navbatda qolgan
    // "qabul qilindi" tuzatishdan KEYIN yetib borsa, xodim to'lanmagan buyurtmani jo'natib yuborardi. Qolgan xodim xabarlari — hodisa: mavzusiz
    it('xodim xabarlarining navbat mavzusi: "To\'lov qabul qilindi" kartasi va tuzatishi — bitta mavzuda (order-payment:<buyurtma>, har bir buyurtma uchun alohida, mijoz xabarlari bilan bir xil satr); yangi buyurtma kartasi va ariza xabari — mavzusiz', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, status: 'processing', paymentStatus: 'paid' });
      const other = await fx.order({ status: 'processing', paymentMethod: 'payme', paymentStatus: 'paid' });

      expect(await notifyStaffNewOrder(o.id)).toBeGreaterThanOrEqual(3);
      expect(await notifyStaffPaid(o.id, 'Hisob-faktura')).toBeGreaterThanOrEqual(3);
      expect(await notifyStaffPaymentReverted(o.id, 'Kassa')).toBeGreaterThanOrEqual(3);
      expect(await notifyStaffPaid(other.id, 'Payme')).toBeGreaterThanOrEqual(3); // boshqa buyurtma (onlayn to'lov)
      expect(await notifyStaffLead(['📩 Yangi ariza'])).toBeGreaterThanOrEqual(3);
      expect(await notifyStaffNewOrder(other.id)).toBeGreaterThanOrEqual(3);
      for (const u of [worker, manager, admin]) {
        expect(sentTo(u).map((m) => m.html.split(' ')[0])).toEqual(['🛒', '✅', '↩️', '✅', '📩', '🛒']);
        expect(topicsTo(u)).toEqual([null, `order-payment:${o.id}`, `order-payment:${o.id}`, `order-payment:${other.id}`, null, null]);
      }
      // Xabarnomani o'chirgan xodimga hech narsa chiqarilmagan
      expect(topicsTo(muted)).toEqual([]);
      // Hamma oluvchiga (bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin) bir xil mavzu: u oluvchiga bog'liq emas
      expect(new Set(net.staffTopics.map((t) => t.topic))).toEqual(new Set([null, `order-payment:${o.id}`, `order-payment:${other.id}`]));

      // Mijozga ketadigan to'lov xabarining mavzusi ham aynan shu satr — faqat u mijoz botida (navbat har bir bot uchun alohida yuritiladi)
      expect(await notifyCustomerPaid(o)).toBe(1);
      expect(net.topics).toEqual([{ to: c.telegramId, topic: `order-payment:${o.id}` }]);
    });

    it('belgi bekor qilingani haqidagi karta ham buyurtmaning HOZIRGI holatidan yasaladi: bekor qilingan buyurtmada «To\'landi» hech kimda yo\'q; belgi shu orada qayta qo\'yilgan bo\'lsa — yana «bekor qilish»', async () => {
      const cases: { data: Partial<Prisma.OrderUncheckedCreateInput>; pay: 'op' | 'ou' | null; line: RegExp }[] = [
        { data: { paymentMethod: 'bank_transfer', paymentStatus: 'pending', status: 'shipping' }, pay: 'op', line: /· Bank o'tkazmasi · To'lanmagan/ },
        { data: { paymentMethod: 'cash', paymentStatus: 'pending', status: 'delivered' }, pay: 'op', line: /· Naqd · To'lanmagan/ },
        { data: { paymentMethod: 'cash', paymentStatus: 'pending', status: 'cancelled' }, pay: null, line: /· Naqd · To'lanmagan/ }, // bekor qilingan buyurtmadan to'lov kutilmaydi
        { data: { paymentMethod: 'cash', paymentStatus: 'paid' }, pay: 'ou', line: /· Naqd · To'langan/ }, // karta yasalguncha boshqa xodim belgini qayta qo'ygan
      ];
      for (const c of cases) {
        clearOutbox();
        const o = await fx.order(c.data);
        const name = JSON.stringify(c.data);
        expect(await notifyStaffPaymentReverted(o.id, 'Kassa'), name).toBeGreaterThanOrEqual(3);
        for (const u of [worker, manager, admin]) {
          expect(sentTo(u), name).toHaveLength(1);
          expect(sentTo(u)[0].html.split('\n')[0], name).toBe('↩️ <b>To\'lov belgisi bekor qilindi</b> (Kassa)');
          expect(sentTo(u)[0].html, name).toMatch(c.line);
        }
        for (const u of [manager, admin]) expect(payButtons(u), name).toEqual(c.pay ? [`${c.pay}_${o.id}`] : []);
        expect(payButtons(worker), name).toEqual([]);
        // Qolgan tugmalar ruxsatdan qat'i nazar bir xil
        for (const u of [manager, admin]) expect(otherButtons(u), name).toEqual(otherButtons(worker));
      }
    });

    it('belgi bekor qilingani haqidagi karta: yo\'q yoki o\'chirilgan buyurtmada 0 qaytadi va xato tashlamaydi — hech kimga hech narsa ketmaydi', async () => {
      const deleted = await fx.order({ deletedAt: new Date(), paymentMethod: 'cash' });
      const gone = await fx.order();
      await prisma.order.delete({ where: { id: gone.id } });

      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await expect(notifyStaffPaymentReverted(gone.id, 'Kassa')).resolves.toBe(0);
        await expect(notifyStaffPaymentReverted(deleted.id, 'Kassa')).resolves.toBe(0);
        // Hech qachon bo'lmagan raqam (INT4 ichida)
        await expect(notifyStaffPaymentReverted(2_000_000_000, 'Kassa')).resolves.toBe(0);
        // Bu xato emas: logga ham hech narsa yozilmaydi
        expect(logged).not.toHaveBeenCalled();
      } finally {
        logged.mockRestore();
      }
      expect(outbox.staff).toEqual([]);
      // Karta yasalmagan — xodimlar ro'yxati so'ralmagan ham
      expect(net.sections).toEqual([]);
    });

    it('to\'lov tugmalari buyurtmaga qarab: «To\'landi» — qo\'lda belgilanadigan, hali to\'lanmagan va bekor qilinmagan buyurtmada; belgini bekor qilish — qo\'lda "to\'langan"da; onlayn to\'lovda ikkalasi ham yo\'q', async () => {
      const cases: { data: Partial<Prisma.OrderUncheckedCreateInput>; pay: 'op' | 'ou' | null }[] = [
        { data: { paymentMethod: 'bank_transfer', paymentStatus: 'pending' }, pay: 'op' },
        { data: { paymentMethod: 'bank_transfer', paymentStatus: 'paid', status: 'delivered' }, pay: 'ou' },
        { data: { paymentMethod: 'cash', paymentStatus: 'paid', status: 'cancelled' }, pay: 'ou' }, // bekor qilingan buyurtmadagi xato belgi ham qaytariladi
        { data: { paymentMethod: 'cash', paymentStatus: 'pending', status: 'cancelled' }, pay: null },
        { data: { paymentMethod: 'cash', paymentStatus: 'refunded' }, pay: null },
        { data: { paymentMethod: 'payme', paymentStatus: 'pending' }, pay: null },
        { data: { paymentMethod: 'click', paymentStatus: 'paid' }, pay: null }, // onlayn to'lovni to'lov tizimi belgilagan
      ];
      for (const c of cases) {
        clearOutbox();
        const o = await fx.order(c.data);
        const name = JSON.stringify(c.data);
        expect(await notifyStaffNewOrder(o.id), name).toBeGreaterThanOrEqual(3);
        for (const u of [manager, admin]) expect(payButtons(u), name).toEqual(c.pay ? [`${c.pay}_${o.id}`] : []);
        expect(payButtons(worker), name).toEqual([]);
        // Qolgan tugmalar (holat, bekor qilish, yangilash) ruxsatdan qat'i nazar bir xil
        for (const u of [manager, admin]) expect(otherButtons(u), name).toEqual(otherButtons(worker));
        expect(otherButtons(worker).at(-1), name).toBe(`or_${o.id}`);
      }
    });

    it('oluvchilar ro\'yxati avvalgidek "orders" bo\'limi bo\'yicha: moliya ruxsati yo\'q xodim ham kartani oladi; mijoz akkaunti, o\'chirib qo\'yilgan, o\'chirilgan va xabarnomani o\'chirgan xodim — yo\'q', async () => {
      const client = await fx.user({ role: 'user', telegramId: fx.tg() });
      const blocked = await fx.user({ role: 'manager', telegramId: fx.tg(), isActive: false });
      const removed = await fx.user({ role: 'admin', telegramId: fx.tg(), deletedAt: new Date() });
      const o = await fx.order();
      const paid = await fx.order({ paymentStatus: 'paid' });

      const sent = await notifyStaffNewOrder(o.id);
      expect(sent).toBe(outbox.staff.length);
      expect(await notifyStaffPaid(paid.id, 'Kassa')).toBe(outbox.staff.length - sent);
      // Kartalar "finance" emas, "orders" bo'limi xodimlariga: to'lov tugmasi bo'lmasa ham oddiy xodim buyurtmadan xabardor bo'ladi
      expect(net.sections).toEqual(['orders', 'orders']);
      for (const u of [worker, manager, admin]) expect(sentTo(u).map((m) => m.html.split('\n')[0])).toEqual(['🛒 <b>Yangi buyurtma</b>', '✅ <b>To\'lov qabul qilindi</b> (Kassa)']);
      for (const u of [muted, client, blocked, removed]) expect(sentTo(u)).toEqual([]);
    });

    // toStaff tugmalarni har bir oluvchi uchun alohida, o'sha oluvchining yuborish va'dasi ichida yasaydi: bittasida xato chiqsa
    // (masalan kutilmagan rol) qolgan xodimlar buyurtmadan bexabar qolmasin
    it('bitta xodimning tugmalarini yasashdagi xato qolganlarga xalaqit bermaydi: ular kartani o\'z tugmalari bilan oladi, xato logga tushadi va sanoqqa kirmaydi', async () => {
      const o = await fx.order();
      // Faqat moliya ruxsati yo'q xodimlarning (bu faylda — worker) tugmalari yasalmaydi
      net.keyboardFail = (_canEdit, canPay) => !canPay;
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const sent = await notifyStaffNewOrder(o.id);
        expect(sent).toBe(outbox.staff.length);
        expect(sent).toBeGreaterThanOrEqual(2);
        // Har bir yiqilgan oluvchiga bitta yozuv (bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin) — butun xabarnoma yiqilmagan
        expect(logged.mock.calls.length).toBeGreaterThanOrEqual(1);
        for (const call of logged.mock.calls) {
          expect(call.slice(0, 2)).toEqual(['[orderNotify]', 'xodim']);
          expect(call[2]).toMatchObject({ message: 'test: tugmalar yasalmadi' });
        }
      } finally {
        logged.mockRestore();
      }
      for (const u of [manager, admin]) {
        expect(sentTo(u)).toHaveLength(1);
        expect(callbacks(sentTo(u)[0])).toEqual([`os_${o.id}_processing`, `op_${o.id}`, `oc_${o.id}`, `or_${o.id}`]);
      }
      // Tugmalari yasalmagan xodimga boshqa birovning (to'lov tugmali) kartasi ham ketib qolmagan
      expect(sentTo(worker).flatMap(callbacks).filter(isPay)).toEqual([]);

      // Hammada yiqilsa ham xato tashqariga chiqmaydi (checkout yoki to'lov webhook'i yiqilmasin)
      clearOutbox();
      net.keyboardFail = () => true;
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await expect(notifyStaffNewOrder(o.id)).resolves.toBe(0);
      } finally {
        quiet.mockRestore();
      }
      for (const u of [worker, manager, admin]) expect(sentTo(u)).toEqual([]);
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
      // Ariza — hodisa: xabar navbat mavzusisiz ketadi
      for (const u of [worker, manager]) expect(topicsTo(u)).toEqual([null]);
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
    it('xabarlarning navbat mavzusi: ishlab chiqarish — buyurtma va TOPSHIRIQ raqami bo\'yicha (mahsulot nomi bo\'yicha emas), holat — buyurtma bo\'yicha, "to\'lov qabul qilindi" va uning tuzatishi — bitta mavzuda (buyurtma bo\'yicha), hisob-faktura — mavzusiz', async () => {
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
      expect(await notifyCustomerPaymentReverted(o)).toBe(1); // xato qo'yilgan belgi bekor qilindi — "qabul qilindi" bilan bitta mavzu
      expect(await notifyCustomerPaid(other)).toBe(1); // boshqa buyurtma
      expect(await notifyCustomerInvoice(o.id, invoice)).toBe(1);
      expect(net.topics.map((t) => t.topic)).toEqual([
        `order-production:${o.id}:7`,
        `order-production:${o.id}:8`,
        `order-production:${other.id}:7`,
        `order-production:${o.id}:7`,
        `order-status:${o.id}`,
        `order-payment:${o.id}`,
        `order-payment:${o.id}`,
        `order-payment:${other.id}`,
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
          await queue({ topic: `order-payment:${o.id}` }), // shu buyurtmaning "to'lov qabul qilindi" xabari yoki uning tuzatishi
          await queue({ topic: `order-payment:${o.id}`, chatId: second.telegramId, attempts: 3 }),
          await queue({ topic: null }), // mavzusiz (hisob-faktura)
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

    // Xodim «To'landi»ni xato bosgan va bekor qilgan: mijoz oldin "to'lov qabul qilindi" xabarini olgan — unga tuzatish boradi
    it('to\'lov belgisi bekor qilindi: tuzatish har kimga o\'z tilida — ayblovsiz va summasiz, do\'kon telefoni, "Batafsil" tugmasi va buyurtma havolasi bilan', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      // Akkaunt telefoni orqali ulangan, lekin xabarnomani o'chirgan mijoz
      const account = await fx.user();
      const silent = await fx.customer({ phone: account.phone, notify: false });
      const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, userId: account.id, paymentMethod: 'cash', totalAmount: 360000 });

      expect(await notifyCustomerPaymentReverted(o)).toBe(2);
      expect(outbox.customer).toHaveLength(2);
      expect(net.topics.map((t) => t.topic)).toEqual([`order-payment:${o.id}`, `order-payment:${o.id}`]);
      expect(net.topics.map((t) => t.to).sort()).toEqual([uz.telegramId, ru.telegramId].sort());
      expect(outbox.customer.some((m) => m.to === silent.telegramId)).toBe(false);
      const toUz = outbox.customer.find((m) => m.to === uz.telegramId)!;
      const toRu = outbox.customer.find((m) => m.to === ru.telegramId)!;
      const shopPhone = displayPhone(TEST_SETTINGS.phone);
      expect(toUz.html.split('\n')).toEqual([
        `ℹ️ <b>Buyurtma #${o.id}</b>`,
        'Tuzatish: bu buyurtma bo\'yicha «to\'lov qabul qilindi» belgisi xato qo\'yilgan edi — u olib tashlandi. Buyurtma hozircha <b>to\'lanmagan</b> deb hisoblanadi. Noqulaylik uchun uzr so\'raymiz.',
        `Savollar bo'lsa: ${shopPhone}`,
      ]);
      expect(toRu.html.split('\n')).toEqual([
        `ℹ️ <b>Заказ #${o.id}</b>`,
        'Исправление: отметка «оплата получена» по этому заказу была поставлена по ошибке и снята. Заказ пока считается <b>неоплаченным</b>. Приносим извинения за неудобство.',
        `Если есть вопросы: ${shopPhone}`,
      ]);
      expect(shopPhone).toMatch(/^\+998 \d\d \d{3} \d\d \d\d$/);
      // "Buyurtma #N" sarlavhasi ostida "bekor qilindi" (ruschada «отменён») buyurtmaning o'zi bekor qilingandek o'qiladi — belgi "olib tashlandi" / «снята»
      expect(toUz.html).not.toMatch(/bekor qilindi/i);
      expect(toRu.html).not.toMatch(/отмен/iu);
      // Xato do'konniki: ikkala tilda ham uzr so'raladi
      expect(toUz.html).toContain('uzr so\'raymiz');
      expect(toRu.html).toContain('извинения');
      for (const m of [toUz, toRu]) {
        // Betaraf ohang: xato do'konniki — summa, undov va pul talab qiladigan so'zlar yo'q
        expect(m.html).not.toMatch(/360\s?000|so'm|сум/u);
        expect(m.html).not.toMatch(/[!❌⚠]/u);
        expect(m.html).not.toMatch(/qarz|to'lang|shoshiling|долг|оплатите|срочно/iu);
        // Telegram HTML: <b> dan boshqa teg yo'q
        expect(m.html.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);
      }
      // "Batafsil" tugmasi (o_<id>) va buyurtma sahifasi — o'z tilida; hisob-faktura tugmasi yo'q
      expect(toUz.inline).toEqual([[{ text: '📦 Batafsil', callback_data: `o_${o.id}` }, { text: '🌐 Saytda ochish', url: expect.stringMatching(new RegExp(`/uz/orders/${o.accessToken}$`)) }]]);
      expect(toRu.inline).toEqual([[{ text: '📦 Подробнее', callback_data: `o_${o.id}` }, { text: '🌐 Открыть на сайте', url: expect.stringMatching(new RegExp(`/ru/orders/${o.accessToken}$`)) }]]);
    });

    it('tuzatish xabari: do\'konda telefon kiritilmagan bo\'lsa telefon satri yozilmaydi; telefon matni HTML uchun qochiriladi; havola kaliti yo\'q buyurtmada faqat "Batafsil"', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, accessToken: null });

      net.phone = '';
      expect(await notifyCustomerPaymentReverted(o)).toBe(1);
      // 12 xonali bo'lmagan qiymat o'zgarishsiz chiqadi (displayPhone) — sozlamadagi belgilar xabar HTML'ini buzmasin
      net.phone = '<i>88 055</i> & 78';
      expect(await notifyCustomerPaymentReverted(o)).toBe(1);
      const [bare, odd] = outbox.customer.map((m) => m.html.split('\n'));
      expect(bare).toEqual([`ℹ️ <b>Buyurtma #${o.id}</b>`, expect.stringContaining('<b>to\'lanmagan</b>')]);
      expect(bare.join('\n')).not.toMatch(/Savollar|\+998/);
      expect(odd).toHaveLength(3);
      expect(odd[2]).toBe('Savollar bo\'lsa: &lt;i&gt;88 055&lt;/i&gt; &amp; 78');
      for (const m of outbox.customer) expect(m.inline).toEqual([[{ text: '📦 Batafsil', callback_data: `o_${o.id}` }]]);
    });

    // Bekor qilingan buyurtmadagi xato belgi ham olib tashlanadi (mijozda "to'lov qabul qilindi" xabari turibdi), lekin undan to'lov
    // kutilmaydi: "hozircha to'lanmagan" gapi mijozni to'lashga undagandek o'qilardi (hisob-faktura xabaridagi qoida bilan bir xil)
    it('tuzatish xabari buyurtma holatiga qarab: bekor qilingan buyurtmada "hozircha to\'lanmagan" gapi yo\'q (uz va ru) — sarlavha, birinchi gap, uzr, telefon va tugmalar joyida; qolgan hamma holatda gap bor', async () => {
      const phone = fx.phone();
      const uz = await fx.customer({ phone });
      const ru = await fx.customer({ lang: 'ru' });
      const shopPhone = displayPhone(TEST_SETTINGS.phone);
      // Record: yangi holat qo'shilsa tsc shu jadvalni to'ldirishni talab qiladi — hech bir holat tekshiruvsiz qolmaydi
      const owed: Record<OrderStatus, boolean> = { draft: true, new_: true, processing: true, shipping: true, delivered: true, cancelled: false };
      for (const [status, expected] of Object.entries(owed) as [OrderStatus, boolean][]) {
        clearOutbox();
        net.topics.length = 0;
        const o = await fx.order({ contactPhone: phone, telegramUserId: ru.telegramId, status, paymentMethod: 'cash', totalAmount: 360000 });

        expect(await notifyCustomerPaymentReverted(o), status).toBe(2);
        expect(outbox.customer, status).toHaveLength(2);
        // Mavzu holatga bog'liq emas: bekor qilingan buyurtmaning tuzatishi ham navbatdagi "to'lov qabul qilindi"ning o'rnini bosadi
        expect(net.topics.map((t) => t.topic), status).toEqual([`order-payment:${o.id}`, `order-payment:${o.id}`]);
        const toUz = outbox.customer.find((m) => m.to === uz.telegramId)!;
        const toRu = outbox.customer.find((m) => m.to === ru.telegramId)!;
        expect(toUz.html.split('\n'), status).toEqual([`ℹ️ <b>Buyurtma #${o.id}</b>`, correction('uz', expected), `Savollar bo'lsa: ${shopPhone}`]);
        expect(toRu.html.split('\n'), status).toEqual([`ℹ️ <b>Заказ #${o.id}</b>`, correction('ru', expected), `Если есть вопросы: ${shopPhone}`]);
        expect(/to'lanmagan/i.test(toUz.html), status).toBe(expected);
        expect(/неоплаченн/iu.test(toRu.html), status).toBe(expected);
        // Hech bir holatda: buyurtma bekor qilingandek o'qiladigan ibora, summa va undov yo'q
        expect(toUz.html, status).not.toMatch(/bekor qilindi/i);
        expect(toRu.html, status).not.toMatch(/отмен/iu);
        for (const m of [toUz, toRu]) expect(m.html, status).not.toMatch(/360\s?000|so'm|сум|[!❌⚠]/u);
        expect(toUz.inline, status).toEqual([[{ text: '📦 Batafsil', callback_data: `o_${o.id}` }, { text: '🌐 Saytda ochish', url: expect.stringMatching(new RegExp(`/uz/orders/${o.accessToken}$`)) }]]);
        expect(toRu.inline, status).toEqual([[{ text: '📦 Подробнее', callback_data: `o_${o.id}` }, { text: '🌐 Открыть на сайте', url: expect.stringMatching(new RegExp(`/ru/orders/${o.accessToken}$`)) }]]);
      }
    });

    it('bekor qilingan buyurtmaning tuzatishi: do\'konda telefon kiritilmagan bo\'lsa xabar ikki satr — sarlavha va "to\'lanmagan" gapisiz tuzatish (uzr bilan tugaydi)', async () => {
      const phone = fx.phone();
      await fx.customer({ phone });
      const o = await fx.order({ contactPhone: phone, status: 'cancelled', paymentMethod: 'bank_transfer' });

      net.phone = '';
      expect(await notifyCustomerPaymentReverted(o)).toBe(1);
      expect(outbox.customer[0].html).toBe(`ℹ️ <b>Buyurtma #${o.id}</b>\n${CORRECTION.uz.first} ${CORRECTION.uz.sorry}`);
    });

    it('tuzatish ham barcha oluvchilarga birdaniga yuboriladi; bittasidagi xato ikkinchisiga xalaqit bermaydi, oluvchisi yo\'q buyurtmada hech narsa ketmaydi', async () => {
      const phone = fx.phone();
      const first = await fx.customer({ phone });
      const second = await fx.customer({ lang: 'ru' });
      const o = await fx.order({ contactPhone: phone, telegramUserId: second.telegramId });

      net.delayMs = 40;
      expect(await notifyCustomerPaymentReverted(o)).toBe(2);
      expect(net.peak).toBe(2);

      clearOutbox();
      net.failFor = first.telegramId;
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        expect(await notifyCustomerPaymentReverted(o)).toBe(1);
        expect(logged).toHaveBeenCalledTimes(1);
      } finally {
        logged.mockRestore();
      }
      expect(outbox.customer.map((m) => m.to)).toEqual([second.telegramId]);

      clearOutbox();
      net.failFor = null;
      const nobody = await fx.order({ contactPhone: fx.phone() });
      expect(await notifyCustomerPaymentReverted(nobody)).toBe(0);
      expect(outbox.customer).toEqual([]);
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
