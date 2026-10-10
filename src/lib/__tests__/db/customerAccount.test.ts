import type { Contract, CorporateInvoice, InvoiceStatus, Order } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CustomerDebt } from '@/lib/customerAccount';
import type { CustomerScope } from '@/lib/telegram/customers';
import { DB_TESTS, fixture, prisma, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));

const { customerDebt, getOrder, listOrders, orderWhere } = await import('@/lib/customerAccount');
const { effectiveInvoiceStatus, invoiceStatusWhere, overdueCutoff } = await import('@/lib/invoiceStatus');
const { bindOrderByToken, customerScope } = await import('@/lib/telegram/customers');

// Sof shart — bazasiz, oddiy `npm test` da ham tekshiriladi: mijoz doirasi (OR) tushib qolsa shu yerda ko'rinadi
describe('orderWhere: mijoz doirasi', () => {
  it('chat, tasdiqlangan telefon va sayt akkaunti — boshqa hech narsa', () => {
    const base = { deletedAt: null, status: { not: 'draft' } };
    expect(orderWhere({ telegramId: '7001', phone: null, userId: null })).toEqual({ ...base, OR: [{ telegramUserId: '7001' }] });
    expect(orderWhere({ telegramId: '7001', phone: '998901234567', userId: null })).toEqual({ ...base, OR: [{ telegramUserId: '7001' }, { contactPhone: '998901234567' }] });
    expect(orderWhere({ telegramId: '7001', phone: '998901234567', userId: 42 })).toEqual({ ...base, OR: [{ telegramUserId: '7001' }, { contactPhone: '998901234567' }, { userId: 42 }] });
  });
});

describe.skipIf(!DB_TESTS)('customerAccount (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(3);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  const idsOf = (rows: { id: number }[]) => rows.map((r) => r.id);
  const desc = (rows: { id: number }[]) => idsOf(rows).sort((a, b) => b - a);

  describe('buyurtmalar: har kim faqat o\'zinikini ko\'radi', () => {
    let a: CustomerScope;
    let b: CustomerScope;
    let byPhone: Order;
    let byAccount: Order;
    let byLink: Order;
    let draft: Order;
    let deleted: Order;
    let orphan: Order;
    let foreign: Order;

    beforeAll(async () => {
      const phoneA = fx.phone();
      const phoneB = fx.phone();
      const account = await fx.user({ phone: phoneA, role: 'user' });
      const ca = await fx.customer({ phone: phoneA });
      const cb = await fx.customer({ phone: phoneB });
      const product = await fx.product({ name: 'Gofra quti 30x20x15' });

      byPhone = await fx.order({ contactPhone: phoneA, items: { create: [{ productId: product.id, quantity: 500, price: 2400 }] } });
      byAccount = await fx.order({ userId: account.id, contactPhone: fx.phone() }); // akkauntdan, boshqa aloqa raqami bilan
      byLink = await fx.order({ contactPhone: fx.phone() }); // begona raqam, lekin havolasi shu chatda ochilgan
      draft = await fx.order({ contactPhone: phoneA, status: 'draft' });
      deleted = await fx.order({ contactPhone: phoneA, deletedAt: new Date() });
      orphan = await fx.order(); // telefon ham, akkaunt ham, chat ham yo'q
      foreign = await fx.order({ contactPhone: phoneB });
      await bindOrderByToken(ca.telegramId, byLink.accessToken!);

      a = await customerScope(ca);
      b = await customerScope(cb);
      expect(a).toEqual({ telegramId: ca.telegramId, phone: phoneA, userId: account.id });
      expect(b).toEqual({ telegramId: cb.telegramId, phone: phoneB, userId: null });
    });

    it('ro\'yxat: telefon, sayt akkaunti va havola orqali ulangan buyurtmalar — yangisi birinchi', async () => {
      const mine = await listOrders(a);
      expect(idsOf(mine.items)).toEqual(desc([byPhone, byAccount, byLink]));
      expect(mine).toMatchObject({ total: 3, page: 0, pages: 1 });

      const theirs = await listOrders(b);
      expect(idsOf(theirs.items)).toEqual([foreign.id]);
      expect(theirs.total).toBe(1);
    });

    it('qoralama va o\'chirilgan buyurtma ro\'yxatda ham, id bo\'yicha ham ko\'rinmaydi', async () => {
      const visible = idsOf((await listOrders(a)).items);
      expect(visible).not.toContain(draft.id);
      expect(visible).not.toContain(deleted.id);
      expect(await getOrder(a, draft.id)).toBeNull();
      expect(await getOrder(a, deleted.id)).toBeNull();
    });

    it('begona buyurtma id si to\'g\'ridan-to\'g\'ri so\'ralsa ham ochilmaydi', async () => {
      expect(await getOrder(a, foreign.id)).toBeNull();
      expect(await getOrder(a, orphan.id)).toBeNull();
      for (const own of [byPhone, byAccount, byLink]) expect(await getOrder(b, own.id)).toBeNull();
      expect((await getOrder(b, foreign.id))?.id).toBe(foreign.id);
      for (const own of [byPhone, byAccount, byLink]) expect((await getOrder(a, own.id))?.id).toBe(own.id);
    });

    it('telefoni tasdiqlanmagan chat faqat havola orqali ulangan buyurtmani ko\'radi; hech narsasi yo\'q chat — hech narsani', async () => {
      const linkOnly: CustomerScope = { telegramId: a.telegramId, phone: null, userId: null };
      expect(idsOf((await listOrders(linkOnly)).items)).toEqual([byLink.id]);
      expect(await getOrder(linkOnly, byPhone.id)).toBeNull();
      expect(await customerDebt(linkOnly)).toBeNull();

      const nobody: CustomerScope = { telegramId: fx.tg(), phone: null, userId: null };
      expect(orderWhere(nobody)).toEqual({ deletedAt: null, status: { not: 'draft' }, OR: [{ telegramUserId: nobody.telegramId }] });
      expect(await listOrders(nobody)).toEqual({ items: [], total: 0, page: 0, pages: 1 });
      for (const any of [byPhone, byAccount, byLink, orphan, foreign]) expect(await getOrder(nobody, any.id)).toBeNull();
    });

    it('buyurtma kartasi: mahsulotlar, bekor qilinmagan ish topshirig\'i va hisob-faktura, holat tarixi', async () => {
      const deadline = new Date(Date.now() + 5 * 86_400_000);
      await prisma.workOrder.create({ data: { orderNo: `T${fx.tag}-WO-1`, orderId: byPhone.id, clientName: 'Test', productName: 'Gofra quti 30x20x15', quantity: 500, deadline, status: 'in_progress', currentStage: 'pechat', progress: 40 } });
      await prisma.workOrder.create({ data: { orderNo: `T${fx.tag}-WO-2`, orderId: byPhone.id, clientName: 'Test', productName: 'Bekor qilingan', quantity: 1, deadline, status: 'cancelled' } });
      await fx.invoice({ orderId: byPhone.id, total: 500000, dueDate: deadline, status: 'cancelled' });
      const invoice = await fx.invoice({ orderId: byPhone.id, total: 1200000, paid: 200000, dueDate: deadline, status: 'partial' });
      await prisma.orderEvent.createMany({
        data: [
          { orderId: byPhone.id, kind: 'status', fromValue: 'new_', toValue: 'processing', actor: 'Test', via: 'admin' },
          { orderId: byPhone.id, kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'Test', via: 'admin' },
        ],
      });

      const o = await getOrder(a, byPhone.id);
      expect(o).toMatchObject({ id: byPhone.id, status: 'new_', contactPhone: a.phone });
      expect(o!.items.map((it) => ({ name: it.product.name, quantity: it.quantity, price: Number(it.price) }))).toEqual([{ name: 'Gofra quti 30x20x15', quantity: 500, price: 2400 }]);
      expect(o!.workOrders).toEqual([{ productName: 'Gofra quti 30x20x15', quantity: 500, status: 'in_progress', currentStage: 'pechat', progress: 40, deadline }]);
      expect(o!.corporateInvoices.map((i) => ({ invoiceNo: i.invoiceNo, status: i.status, total: Number(i.totalAmount), paid: Number(i.paidAmount) }))).toEqual([{ invoiceNo: invoice.invoiceNo, status: 'partial', total: 1200000, paid: 200000 }]);
      expect(o!.events.map((e) => e.toValue)).toEqual(['processing']);
    });
  });

  describe('listOrders: sahifalash', () => {
    let scope: CustomerScope;
    let all: number[];

    beforeAll(async () => {
      const phone = fx.phone();
      scope = { telegramId: fx.tg(), phone, userId: null };
      const made: Order[] = [];
      for (let i = 0; i < 7; i += 1) made.push(await fx.order({ contactPhone: phone }));
      all = desc(made);
    });

    it('7 ta buyurtma, sahifada 3 tadan: 3 sahifa, oxirgisida 1 ta', async () => {
      const first = await listOrders(scope, 0, 3);
      expect(first).toMatchObject({ total: 7, page: 0, pages: 3 });
      expect(idsOf(first.items)).toEqual(all.slice(0, 3));
      expect(idsOf((await listOrders(scope, 1, 3)).items)).toEqual(all.slice(3, 6));
      const last = await listOrders(scope, 2, 3);
      expect(last).toMatchObject({ total: 7, page: 2, pages: 3 });
      expect(idsOf(last.items)).toEqual(all.slice(6));
    });

    it('chegaradan tashqari sahifa raqami eng yaqin mavjud sahifaga tushadi', async () => {
      const beyond = await listOrders(scope, 99, 3);
      expect(beyond).toMatchObject({ page: 2, pages: 3 });
      expect(idsOf(beyond.items)).toEqual(all.slice(6));
      const negative = await listOrders(scope, -5, 3);
      expect(negative).toMatchObject({ page: 0, pages: 3 });
      expect(idsOf(negative.items)).toEqual(all.slice(0, 3));
    });

    it('standart sahifa hajmi 6: 2 sahifa; aynan to\'lgan sahifadan keyin bo\'sh sahifa chiqmaydi', async () => {
      const first = await listOrders(scope);
      expect(first).toMatchObject({ total: 7, page: 0, pages: 2 });
      expect(idsOf(first.items)).toEqual(all.slice(0, 6));
      expect(await listOrders(scope, 0, 7)).toMatchObject({ total: 7, page: 0, pages: 1 });
    });

    it('ro\'yxat qatorida faqat kerakli maydonlar bor (telefon, manzil chiqmaydi)', async () => {
      const [item] = (await listOrders(scope, 0, 1)).items;
      expect(Object.keys(item).sort()).toEqual(['accessToken', 'createdAt', 'id', 'paymentMethod', 'paymentStatus', 'status', 'totalAmount']);
    });
  });

  describe('customerDebt', () => {
    const NOW = new Date('2026-10-10T07:00:00Z');
    const PAST = new Date('2026-10-01T00:00:00Z');
    const SOON = new Date('2026-10-20T00:00:00Z');
    const LATER = new Date('2026-10-25T00:00:00Z');

    let d: CustomerScope;
    let e: CustomerScope;
    let debt: CustomerDebt;
    let limited: Contract;
    let unlimited: Contract;
    let closed: Contract;
    let partialOrder: Order;
    let overdueOrder: Order;
    let branchOrder: Order;
    let cancelledInvoiceOrder: Order;
    let cashOrder: Order;
    let accountOrder: Order;
    let linkedOrder: Order;
    let partial: CorporateInvoice;
    let overdue: CorporateInvoice;
    let branch: CorporateInvoice;
    let hidden: CorporateInvoice[];
    let foreignOrder: Order;
    let foreignInvoice: CorporateInvoice;
    let foreignContract: Contract;

    beforeAll(async () => {
      const phoneD = fx.phone();
      const phoneE = fx.phone();
      const account = await fx.user({ phone: phoneD, role: 'user' });
      const cd = await fx.customer({ phone: phoneD });
      d = await customerScope(cd);
      e = { telegramId: fx.tg(), phone: phoneE, userId: null };

      limited = await fx.contract({ phone: phoneD, creditLimit: 2000000, paymentTermDays: 15 });
      unlimited = await fx.contract({ userId: account.id, creditLimit: 0, paymentTermDays: 30 }); // telefoni yo'q, akkaunt orqali
      closed = await fx.contract({ phone: phoneD, creditLimit: 9000000, status: 'closed' });

      // Qisman to'langan, muddati kelmagan
      partialOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'bank_transfer', totalAmount: 1000000.5 });
      partial = await fx.invoice({ orderId: partialOrder.id, contractId: limited.id, total: 1000000.5, paid: 400000.25, status: 'partial', dueDate: SOON });
      // To'lanmagan, muddati o'tgan
      overdueOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'bank_transfer', totalAmount: 500000 });
      overdue = await fx.invoice({ orderId: overdueOrder.id, contractId: limited.id, total: 500000, dueDate: PAST });
      // Shu shartnoma bo'yicha, lekin filialning boshqa raqamidan berilgan buyurtma
      branchOrder = await fx.order({ contactPhone: fx.phone(), paymentMethod: 'bank_transfer', totalAmount: 700000 });
      branch = await fx.invoice({ orderId: branchOrder.id, contractId: limited.id, total: 700000, dueDate: LATER });

      // Hisobga kirmaydigan hisob-fakturalar: bekor qilingan, to'liq to'langan, holati "qisman" qolgan-u aslida yopilgan, o'chirilgan buyurtmaniki
      cancelledInvoiceOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', totalAmount: 300000 });
      const paidOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'bank_transfer', paymentStatus: 'paid', totalAmount: 200000 });
      const settledOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'bank_transfer', paymentStatus: 'paid', totalAmount: 80000 });
      const deletedOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'bank_transfer', totalAmount: 60000, deletedAt: new Date() });
      hidden = [
        await fx.invoice({ orderId: cancelledInvoiceOrder.id, total: 300000, status: 'cancelled', dueDate: PAST }),
        await fx.invoice({ orderId: paidOrder.id, total: 200000, paid: 200000, status: 'paid', dueDate: PAST }),
        await fx.invoice({ orderId: settledOrder.id, total: 80000, paid: 80000, status: 'partial', dueDate: PAST }),
        await fx.invoice({ orderId: deletedOrder.id, total: 60000, dueDate: PAST }),
      ];

      // Hisob-fakturasiz to'lanmagan buyurtmalar
      cashOrder = await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', totalAmount: 150000 });
      accountOrder = await fx.order({ userId: account.id, contactPhone: fx.phone(), paymentMethod: 'payme', paymentStatus: 'failed', totalAmount: 90000 });
      // Qarzga kirmaydigan buyurtmalar: to'langan, bekor qilingan, qoralama, o'chirilgan, faqat havola orqali ulangan
      await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', paymentStatus: 'paid', totalAmount: 41000 });
      await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', status: 'cancelled', totalAmount: 42000 });
      await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', status: 'draft', totalAmount: 43000 });
      await fx.order({ contactPhone: phoneD, paymentMethod: 'cash', deletedAt: new Date(), totalAmount: 44000 });
      linkedOrder = await fx.order({ contactPhone: fx.phone(), telegramUserId: d.telegramId, paymentMethod: 'cash', totalAmount: 999000 });

      // Boshqa mijoz: o'z shartnomasi, hisob-fakturasi va to'lanmagan buyurtmasi
      foreignContract = await fx.contract({ phone: phoneE, creditLimit: 100000 });
      const foreignInvoiced = await fx.order({ contactPhone: phoneE, paymentMethod: 'bank_transfer', totalAmount: 222000 });
      foreignInvoice = await fx.invoice({ orderId: foreignInvoiced.id, contractId: foreignContract.id, total: 222000, dueDate: PAST });
      foreignOrder = await fx.order({ contactPhone: phoneE, paymentMethod: 'cash', totalAmount: 111000 });

      debt = (await customerDebt(d, NOW))!;
    });

    it('telefon tasdiqlanmagan bo\'lsa qarzdorlik umuman ko\'rsatilmaydi', async () => {
      expect(await customerDebt({ telegramId: d.telegramId, phone: null, userId: null }, NOW)).toBeNull();
      expect(await customerDebt({ telegramId: d.telegramId, phone: null, userId: d.userId }, NOW)).toBeNull();
    });

    it('qisman to\'langan hisob-faktura: qoldiq = jami − to\'langan', () => {
      expect(debt.invoices.find((i) => i.invoiceNo === partial.invoiceNo)).toEqual({
        invoiceNo: partial.invoiceNo, orderId: partialOrder.id, accessToken: partialOrder.accessToken,
        total: 1000000.5, paid: 400000.25, remaining: 600000.25, dueDate: SOON, overdue: false, contractNo: limited.contractNo,
      });
    });

    it('muddati o\'tgani belgilanadi va alohida jamlanadi; ro\'yxat muddat bo\'yicha tartiblangan', async () => {
      expect(debt.invoices.map((i) => [i.invoiceNo, i.remaining, i.overdue])).toEqual([
        [overdue.invoiceNo, 500000, true],
        [partial.invoiceNo, 600000.25, false],
        [branch.invoiceNo, 700000, false],
      ]);
      expect(debt.invoiceTotal).toBe(1800000.25);
      expect(debt.overdueTotal).toBe(500000);

      // Muddat `now` ga nisbatan hisoblanadi: ertaroq qaralsa hali o'tmagan, kechroq qaralsa hammasi o'tgan
      expect((await customerDebt(d, new Date('2026-09-30T00:00:00Z')))!.overdueTotal).toBe(0);
      expect((await customerDebt(d, new Date('2026-11-01T00:00:00Z')))!.overdueTotal).toBe(1800000.25);
    });

    it('bekor qilingan, to\'liq to\'langan va o\'chirilgan buyurtmaning hisob-fakturasi qarzga kirmaydi', () => {
      const listed = debt.invoices.map((i) => i.invoiceNo);
      for (const inv of hidden) expect(listed).not.toContain(inv.invoiceNo);
    });

    it('hisob-fakturasiz to\'lanmagan buyurtmalar alohida ro\'yxatda; hisob-fakturasi bor buyurtma ikki marta sanalmaydi', () => {
      // cancelledInvoiceOrder: yagona hisob-fakturasi bekor qilingan — buyurtmaning o'zi hali to'lanmagan
      expect(debt.unpaidOrders.map((o) => o.id)).toEqual(desc([cancelledInvoiceOrder, cashOrder, accountOrder]));
      expect(debt.unpaidOrders.find((o) => o.id === cashOrder.id)).toEqual({ id: cashOrder.id, accessToken: cashOrder.accessToken, total: 150000, paymentMethod: 'cash', deliveryMethod: null, createdAt: cashOrder.createdAt });
      expect(debt.unpaidOrders.find((o) => o.id === accountOrder.id)).toMatchObject({ total: 90000, paymentMethod: 'payme' });
      expect(debt.unpaidOrdersTotal).toBe(540000);

      const unpaidIds = debt.unpaidOrders.map((o) => o.id);
      for (const invoiced of [partialOrder, overdueOrder, branchOrder]) expect(unpaidIds).not.toContain(invoiced.id);
      expect(debt.total).toBe(2340000.25);
    });

    it('to\'lanmagan naqd buyurtmaga hisob-faktura berilsa, qarz buyurtmadan hisob-fakturaga ko\'chadi — summa ikkilanmaydi', async () => {
      const scope: CustomerScope = { telegramId: fx.tg(), phone: fx.phone(), userId: null };
      const o = await fx.order({ contactPhone: scope.phone, paymentMethod: 'cash', totalAmount: 750000 });

      const before = (await customerDebt(scope, NOW))!;
      expect(before.unpaidOrders.map((u) => u.id)).toEqual([o.id]);
      expect(before).toMatchObject({ invoices: [], invoiceTotal: 0, unpaidOrdersTotal: 750000, total: 750000 });

      const inv = await fx.invoice({ orderId: o.id, total: 750000, dueDate: SOON });
      const after = (await customerDebt(scope, NOW))!;
      expect(after.unpaidOrders).toEqual([]);
      expect(after.invoices.map((i) => [i.invoiceNo, i.orderId, i.remaining, i.contractNo])).toEqual([[inv.invoiceNo, o.id, 750000, null]]);
      expect(after).toMatchObject({ invoiceTotal: 750000, overdueTotal: 0, unpaidOrdersTotal: 0, total: 750000 });
    });

    it('faqat havola orqali ulangan buyurtma qarzga qo\'shilmaydi', () => {
      expect(debt.unpaidOrders.map((o) => o.id)).not.toContain(linkedOrder.id);
    });

    it('shartnoma telefon yoki akkaunt bo\'yicha topiladi: limitli — ishlatilgan va qolgan, limitsiz — qolgan null', () => {
      expect(debt.contracts).toEqual([
        { contractNo: limited.contractNo, companyName: limited.companyName, creditLimit: 2000000, used: 1800000.25, available: 199999.75, paymentTermDays: 15 },
        { contractNo: unlimited.contractNo, companyName: unlimited.companyName, creditLimit: 0, used: 0, available: null, paymentTermDays: 30 },
      ]);
      expect(debt.contracts.map((c) => c.contractNo)).not.toContain(closed.contractNo);
    });

    it('boshqa mijozning hisob-fakturasi, buyurtmasi va shartnomasi hech qachon aralashmaydi', async () => {
      expect(debt.invoices.map((i) => i.invoiceNo)).not.toContain(foreignInvoice.invoiceNo);
      expect(debt.unpaidOrders.map((o) => o.id)).not.toContain(foreignOrder.id);
      expect(debt.contracts.map((c) => c.contractNo)).not.toContain(foreignContract.contractNo);

      const theirs = (await customerDebt(e, NOW))!;
      expect(theirs.invoices.map((i) => [i.invoiceNo, i.remaining, i.overdue])).toEqual([[foreignInvoice.invoiceNo, 222000, true]]);
      expect(theirs.unpaidOrders.map((o) => o.id)).toEqual([foreignOrder.id]);
      // Limitdan oshgan: qolgan summa manfiy bo'lmaydi
      expect(theirs.contracts).toEqual([{ contractNo: foreignContract.contractNo, companyName: foreignContract.companyName, creditLimit: 100000, used: 222000, available: 0, paymentTermDays: 15 }]);
      expect(theirs).toMatchObject({ invoiceTotal: 222000, overdueTotal: 222000, unpaidOrdersTotal: 111000, total: 333000 });
    });

    it('qarzi yo\'q mijoz: bo\'sh ro\'yxatlar va nol', async () => {
      expect(await customerDebt({ telegramId: fx.tg(), phone: fx.phone(), userId: null }, NOW)).toEqual({
        invoices: [], invoiceTotal: 0, overdueTotal: 0, unpaidOrders: [], unpaidOrdersTotal: 0, contracts: [], total: 0,
      });
    });

    it('20 tadan ko\'p to\'lanmagan buyurtma: jami summa hammasi bo\'yicha hisoblanadi; yetkazish usuli ham qaytadi', async () => {
      const scope: CustomerScope = { telegramId: fx.tg(), phone: fx.phone(), userId: null };
      for (let i = 0; i < 22; i += 1) await fx.order({ contactPhone: scope.phone, status: 'delivered', deliveryMethod: 'courier', totalAmount: 100000 });
      const pickup = await fx.order({ contactPhone: scope.phone, deliveryMethod: 'pickup', totalAmount: 100000 });

      const many = (await customerDebt(scope, NOW))!;
      expect(many.unpaidOrders).toHaveLength(23);
      expect(many).toMatchObject({ unpaidOrdersTotal: 2300000, total: 2300000 });
      // Balans satridagi "naqd, olib ketishda" / "naqd, yetkazishda" shu maydondan tanlanadi
      expect(many.unpaidOrders[0]).toMatchObject({ id: pickup.id, paymentMethod: 'cash', deliveryMethod: 'pickup' });
      expect(many.unpaidOrders[1]).toMatchObject({ paymentMethod: 'cash', deliveryMethod: 'courier' });
    });

    it('to\'langan (yoki puli qaytarilgan) buyurtmaning ochiq qolgan hisob-fakturasi qarz emas: balans, muddati o\'tgan summa va nasiya limiti', async () => {
      const scope: CustomerScope = { telegramId: fx.tg(), phone: fx.phone(), userId: null };
      const contract = await fx.contract({ phone: scope.phone, creditLimit: 5000000 });
      const o = await fx.order({ contactPhone: scope.phone, paymentMethod: 'bank_transfer', totalAmount: 400000 });
      const inv = await fx.invoice({ orderId: o.id, contractId: contract.id, total: 400000, dueDate: PAST });

      const owed = (await customerDebt(scope, NOW))!;
      expect(owed).toMatchObject({ invoiceTotal: 400000, overdueTotal: 400000, unpaidOrders: [], total: 400000 });
      expect(owed.contracts).toMatchObject([{ used: 400000, available: 4600000 }]);

      // Buyurtma hisob-faktura sahifasidan tashqarida to'langan (xodim "To'landi"ni bosgan, Payme/Click), hujjat esa "berilgan"
      // holatida qolgan — eski yozuvlar shunday. Mijozga "to'lov qabul qilindi" ketgan: qarz ko'rsatilmasligi kerak.
      for (const paymentStatus of ['paid', 'refunded'] as const) {
        await prisma.order.update({ where: { id: o.id }, data: { paymentStatus } });
        const settled = (await customerDebt(scope, NOW))!;
        expect(settled).toMatchObject({ invoices: [], invoiceTotal: 0, overdueTotal: 0, unpaidOrders: [], unpaidOrdersTotal: 0, total: 0 });
        expect(settled.contracts).toMatchObject([{ used: 0, available: 5000000 }]);
      }

      // To'lov belgisi olib tashlansa (xato bosilgan) qarz o'z-o'zidan qaytadi
      await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: 'pending' } });
      const again = (await customerDebt(scope, NOW))!;
      expect(again.invoices.map((i) => [i.invoiceNo, i.remaining, i.overdue])).toEqual([[inv.invoiceNo, 400000, true]]);
      expect(again.contracts).toMatchObject([{ used: 400000 }]);
    });

    it('bekor qilingan buyurtmaning ochiq hisob-fakturasi qarz emas — shartnoma orqali ham o\'tib ketmaydi', async () => {
      const scope: CustomerScope = { telegramId: fx.tg(), phone: fx.phone(), userId: null };
      const contract = await fx.contract({ phone: scope.phone, creditLimit: 1000000 });
      const own = await fx.order({ contactPhone: scope.phone, paymentMethod: 'bank_transfer', totalAmount: 700000 });
      await fx.invoice({ orderId: own.id, contractId: contract.id, total: 700000, dueDate: PAST });
      // Shu shartnoma bo'yicha filialning boshqa raqamidan berilgan buyurtma: ro'yxatga faqat shartnoma orqali tushadi
      const branchOrder = await fx.order({ contactPhone: fx.phone(), paymentMethod: 'bank_transfer', totalAmount: 200000 });
      await fx.invoice({ orderId: branchOrder.id, contractId: contract.id, total: 200000, dueDate: SOON });
      // Hisob-fakturasiz naqd buyurtma: bekor qilinganda u ham qarzdan chiqadi — balansning ikki yarmi bir xil ishlashi kerak
      const cash = await fx.order({ contactPhone: scope.phone, paymentMethod: 'cash', totalAmount: 120000 });

      expect(await customerDebt(scope, NOW)).toMatchObject({ invoiceTotal: 900000, overdueTotal: 700000, unpaidOrdersTotal: 120000, total: 1020000, contracts: [{ used: 900000, available: 100000 }] });

      await prisma.order.updateMany({ where: { id: { in: [own.id, branchOrder.id, cash.id] } }, data: { status: 'cancelled' } });
      expect(await customerDebt(scope, NOW)).toMatchObject({ invoices: [], invoiceTotal: 0, overdueTotal: 0, unpaidOrders: [], total: 0, contracts: [{ used: 0, available: 1000000 }] });
    });

    it('muddat kuni to\'liq hisobga kiradi; mijoz boti, admin nishoni va admin ro\'yxati filtri bir xil chegarani ishlatadi', async () => {
      const scope: CustomerScope = { telegramId: fx.tg(), phone: fx.phone(), userId: null };
      const dueAt = async (iso: string) => {
        const o = await fx.order({ contactPhone: scope.phone, paymentMethod: 'bank_transfer' });
        return fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date(iso) });
      };
      // NOW — Toshkentda 10.10.2026, 12:00
      const yesterday = await dueAt('2026-10-09T18:59:59Z'); // 09.10, 23:59:59
      const midnight = await dueAt('2026-10-09T19:00:00Z'); // 10.10, 00:00
      const morning = await dueAt('2026-10-10T05:00:00Z'); // 10.10, 10:00 — soat bo'yicha o'tgan, lekin muddat kuni hali tugamagan
      const tomorrow = await dueAt('2026-10-10T19:00:00Z'); // 11.10, 00:00
      const all = [yesterday, midnight, morning, tomorrow];
      expect(overdueCutoff(NOW)).toEqual(new Date('2026-10-09T19:00:00Z'));

      const got = (await customerDebt(scope, NOW))!;
      expect(got.invoices.map((i) => [i.invoiceNo, i.overdue])).toEqual([[yesterday.invoiceNo, true], [midnight.invoiceNo, false], [morning.invoiceNo, false], [tomorrow.invoiceNo, false]]);
      expect(got).toMatchObject({ invoiceTotal: 400000, overdueTotal: 100000 });

      // Admin paneldagi nishon va "holat" filtri: qaysi filtrda chiqsa, nishoni ham o'sha bo'ladi
      const filtered = async (status: InvoiceStatus, now: Date) =>
        (await prisma.corporateInvoice.findMany({ where: { AND: [invoiceStatusWhere(status, now), { id: { in: all.map((i) => i.id) } }] }, orderBy: { dueDate: 'asc' } })).map((i) => i.invoiceNo);
      expect(all.map((i) => effectiveInvoiceStatus(i, NOW))).toEqual(['overdue', 'issued', 'issued', 'issued']);
      expect(await filtered('overdue', NOW)).toEqual([yesterday.invoiceNo]);
      expect(await filtered('issued', NOW)).toEqual([midnight.invoiceNo, morning.invoiceNo, tomorrow.invoiceNo]);
      expect(await filtered('paid', NOW)).toEqual([]);

      // Kun almashgach (Toshkentda 11.10, 00:00) kechagi muddatlar o'tgan bo'ladi; aynan shu lahzada tugaydigani — hali yo'q
      const nextDay = new Date('2026-10-10T19:00:00Z');
      expect((await customerDebt(scope, nextDay))!.overdueTotal).toBe(300000);
      expect(all.map((i) => effectiveInvoiceStatus(i, nextDay))).toEqual(['overdue', 'overdue', 'overdue', 'issued']);
      expect(await filtered('overdue', nextDay)).toEqual([yesterday.invoiceNo, midnight.invoiceNo, morning.invoiceNo]);
      expect(await filtered('issued', nextDay)).toEqual([tomorrow.invoiceNo]);
    });
  });
});
