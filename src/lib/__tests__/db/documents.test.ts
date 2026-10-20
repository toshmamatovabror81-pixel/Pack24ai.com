import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB_TESTS, fixture, prisma, waitForBlocked, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));

const { ensureInvoiceForOrder } = await import('@/lib/documents');
const { defaultSettings } = await import('@/lib/settings');

/**
 * Buyurtma uchun hisob-faktura (haqiqiy baza). "Hisob-faktura yaratish" ikki marta bosilsa yoki ikki xodim bir vaqtda bossa
 * bitta buyurtmaga ikki ochiq hujjat chiqmasligi (mijoz qarzi ikki baravar ko'rinardi, xabar ikki marta ketardi) va ikkinchi
 * so'rov xato bilan yiqilmasligi kerak.
 */
describe.skipIf(!DB_TESTS)('documents.ensureInvoiceForOrder (haqiqiy baza)', { timeout: 30_000 }, () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await fixture(6);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  const open = (orderId: number) => prisma.corporateInvoice.findMany({ where: { orderId, status: { not: 'cancelled' } }, orderBy: { id: 'asc' } });

  it('yaratadi (created: true), ikkinchi chaqiruvda mavjudini qaytaradi (created: false); bekor qilingan hujjat hisobga olinmaydi', async () => {
    const o = await fx.order({ totalAmount: 1120 });
    const first = await ensureInvoiceForOrder(o.id, defaultSettings);
    expect(first.created).toBe(true);
    expect(first.invoice).toMatchObject({ orderId: o.id, status: 'issued', contractId: null });
    expect(first.invoice.invoiceNo).toMatch(/^INV-\d{4}-\d{4,}$/);
    expect(Number(first.invoice.totalAmount)).toBe(1120);
    expect(Number(first.invoice.vatAmount)).toBe(120);
    // 7 kun muddat (shartnomasiz)
    expect(Math.round((first.invoice.dueDate.getTime() - Date.now()) / 86_400_000)).toBe(7);

    const again = await ensureInvoiceForOrder(o.id, defaultSettings);
    expect(again).toEqual({ invoice: first.invoice, created: false });
    expect(await open(o.id)).toHaveLength(1);

    await prisma.corporateInvoice.update({ where: { id: first.invoice.id }, data: { status: 'cancelled' } });
    const replacement = await ensureInvoiceForOrder(o.id, defaultSettings);
    expect(replacement.created).toBe(true);
    expect(replacement.invoice.id).not.toBe(first.invoice.id);
    expect(replacement.invoice.invoiceNo).not.toBe(first.invoice.invoiceNo);
  });

  it('shartnoma berilsa to\'lov muddati shartnomadan olinadi', async () => {
    const c = await fx.contract({ paymentTermDays: 30 });
    const o = await fx.order({ totalAmount: 500 });
    const { invoice, created } = await ensureInvoiceForOrder(o.id, defaultSettings, c.id);
    expect(created).toBe(true);
    expect(invoice.contractId).toBe(c.id);
    expect(Math.round((invoice.dueDate.getTime() - Date.now()) / 86_400_000)).toBe(30);
  });

  it('bir vaqtda kelgan ikki so\'rov: bitta hujjat, bittasi "yaratdi", ikkinchisi o\'shani oladi — xato yo\'q', async () => {
    const o = await fx.order({ totalAmount: 2240 });
    // Buyurtma qatori tashqaridan qulflab turiladi: ikkala so'rov ham qulf oldida to'planadi, qulf bo'shagach ketma-ket o'tadi
    const held = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
        const race = Promise.all([ensureInvoiceForOrder(o.id, defaultSettings), ensureInvoiceForOrder(o.id, defaultSettings)]);
        await waitForBlocked(tx, 2);
        return { race };
      },
      { timeout: 15_000 },
    );
    const results = await held.race;
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.created)).toHaveLength(1);
    expect(results[0].invoice.id).toBe(results[1].invoice.id);
    const rows = await open(o.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(results[0].invoice.id);
  });

  it('ikki xil buyurtmaga bir vaqtda: ikkala hujjat ham yaratiladi, raqamlar farqli', async () => {
    const [a, b] = await Promise.all([fx.order({ totalAmount: 100 }), fx.order({ totalAmount: 200 })]);
    const results = await Promise.all([ensureInvoiceForOrder(a.id, defaultSettings), ensureInvoiceForOrder(b.id, defaultSettings)]);
    expect(results.map((r) => r.created)).toEqual([true, true]);
    expect(results[0].invoice.invoiceNo).not.toBe(results[1].invoice.invoiceNo);
    expect((await open(a.id)).length + (await open(b.id)).length).toBe(2);
  });
});
