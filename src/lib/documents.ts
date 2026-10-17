import 'server-only';
import { Prisma, type CorporateInvoice } from '@prisma/client';
import { prisma } from './db';
import { toNumber } from './format';
import type { SiteSettings } from './settings';

type Db = Prisma.TransactionClient | typeof prisma;

/** Bazaning "bu qiymat allaqachon bor" xatosi (P2002): bir vaqtda berilgan ikki raqam to'qnashganda */
export const isUniqueError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * Prefiksdan keyingi tartib raqamlarining eng kattasi + 1. Sonli taqqoslanadi: matn bo'yicha saralansa 'INV-2026-9999'
 * 'INV-2026-10000' dan "katta" chiqib, 10 000-hujjatdan keyin har bir yangi raqam takrorlanardi.
 */
export function nextSeq(numbers: string[], prefix: string): number {
  return numbers.reduce((m, n) => Math.max(m, Number(n.slice(prefix.length)) || 0), 0) + 1;
}

/**
 * B2B hujjatlar: hisob-faktura va shartnoma raqamlari, QQS hisobi.
 * Katalog narxlari QQS bilan, shuning uchun QQS summadan ajratib ko'rsatiladi.
 */

export function splitVat(totalWithVat: number, vatPercent: number) {
  const pct = Math.max(0, vatPercent);
  const subtotal = pct > 0 ? Math.round((totalWithVat / (1 + pct / 100)) * 100) / 100 : totalWithVat;
  const vatAmount = Math.round((totalWithVat - subtotal) * 100) / 100;
  return { subtotal, vatAmount, vatPercent: pct };
}

/** INV-2026-0007 ko'rinishidagi navbatdagi raqam (yil bo'yicha). Tranzaksiya ichida chaqirilsa `db` beriladi */
export async function nextInvoiceNo(now = new Date(), db: Db = prisma): Promise<string> {
  const year = now.getFullYear();
  const prefix = `INV-${year}-`;
  const rows = await db.corporateInvoice.findMany({ where: { invoiceNo: { startsWith: prefix } }, select: { invoiceNo: true } });
  return `${prefix}${String(nextSeq(rows.map((r) => r.invoiceNo), prefix)).padStart(4, '0')}`;
}

/** SH-2026-003 ko'rinishidagi navbatdagi shartnoma raqami */
export async function nextContractNo(now = new Date(), db: Db = prisma): Promise<string> {
  const year = now.getFullYear();
  const prefix = `SH-${year}-`;
  const rows = await db.contract.findMany({ where: { contractNo: { startsWith: prefix } }, select: { contractNo: true } });
  return `${prefix}${String(nextSeq(rows.map((r) => r.contractNo), prefix)).padStart(3, '0')}`;
}

export type EnsuredInvoice = { invoice: CorporateInvoice; created: boolean };

/**
 * Buyurtma uchun hisob-faktura yaratadi (bir buyurtmaga bitta; mavjud bo'lsa o'shani qaytaradi, `created: false`).
 * contractId berilsa to'lov muddati shartnomadan, aks holda 7 kun.
 *
 * Tranzaksiya ichida avval buyurtma qatori qulflanadi: "Hisob-faktura yaratish" ikki marta bosilsa (yoki ikki xodim bir vaqtda
 * bossa) ikkinchi so'rov birinchisi tugashini kutadi va u yaratgan hujjatni ko'radi — bitta buyurtmaga ikki ochiq hisob-faktura
 * chiqmaydi (mijoz qarzi ikki baravar ko'rinardi, xabar ikki marta ketardi). Qulf tartibi orderFlow bilan bir xil (avval buyurtma).
 * Ikki xil buyurtmaga bir vaqtda berilgan raqam to'qnashsa (P2002) bir marta qayta uriniladi.
 */
export async function ensureInvoiceForOrder(orderId: number, settings: SiteSettings, contractId?: number | null): Promise<EnsuredInvoice> {
  const attempt = () =>
    prisma.$transaction(async (tx): Promise<EnsuredInvoice> => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const existing = await tx.corporateInvoice.findFirst({ where: { orderId, status: { not: 'cancelled' } } });
      if (existing) return { invoice: existing, created: false };
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { totalAmount: true } });
      const contract = contractId ? await tx.contract.findUnique({ where: { id: contractId }, select: { paymentTermDays: true } }) : null;
      const total = toNumber(order.totalAmount);
      const { subtotal, vatAmount, vatPercent } = splitVat(total, settings.vatPercent);
      const due = new Date();
      due.setDate(due.getDate() + (contract?.paymentTermDays ?? 7));
      const invoice = await tx.corporateInvoice.create({
        data: { invoiceNo: await nextInvoiceNo(new Date(), tx), orderId, contractId: contractId ?? null, subtotal, vatPercent, vatAmount, totalAmount: total, status: 'issued', dueDate: due },
      });
      return { invoice, created: true };
    });
  return attempt().catch((e: unknown) => (isUniqueError(e) ? attempt() : Promise.reject(e)));
}

/** Shartnoma matnidagi {{...}} o'rinbosarlarni to'ldiradi */
export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** Standart shartnoma matni (admin Sozlamalar'da o'zgartiriladi) */
export const DEFAULT_CONTRACT_TEXT = `# YETKAZIB BERISH SHARTNOMASI № {{contractNo}}

Toshkent sh. — {{date}}

**{{sellerName}}** (STIR {{sellerInn}}), keyingi o'rinlarda "Yetkazib beruvchi", direktor {{sellerDirector}} nomidan, bir tomondan, va **{{company}}** (STIR {{inn}}), keyingi o'rinlarda "Xaridor", {{director}} nomidan, ikkinchi tomondan, quyidagicha shartnoma tuzdilar:

## 1. Shartnoma predmeti
1.1. Yetkazib beruvchi qadoqlash mahsulotlarini (karton qutilar, paketlar, plyonka va boshqalar) Xaridorning buyurtmalariga (hisob-fakturalariga) muvofiq yetkazib beradi, Xaridor ularni qabul qilib, haqini to'laydi.
1.2. Mahsulot nomi, miqdori va narxi har bir hisob-fakturada ko'rsatiladi.

## 2. Narx va to'lov tartibi
2.1. Narxlar so'mda, QQS ({{vatPercent}}%) bilan ko'rsatiladi.
2.2. To'lov hisob-faktura berilgan kundan boshlab {{paymentTermDays}} kun ichida bank o'tkazmasi orqali amalga oshiriladi.
2.3. Nasiya limiti: {{creditLimit}} so'm.

## 3. Yetkazib berish
3.1. Toshkent shahri bo'ylab Yetkazib beruvchi kuryeri orqali; viloyatlarga tomonlar kelishuviga ko'ra.
3.2. Mahsulot qabul qilinganda miqdor va sifat bo'yicha da'volar 3 ish kuni ichida yozma ravishda bildiriladi.

## 4. Tomonlarning javobgarligi
4.1. To'lov kechiktirilganda Xaridor har kechiktirilgan kun uchun qarz summasining 0,1% miqdorida penya to'laydi, lekin qarz summasining 10% dan oshmaydi.

## 5. Muddati
5.1. Shartnoma imzolangan kundan kuchga kiradi va {{endDate}} gacha amal qiladi; tomonlar e'tiroz bildirmasa, keyingi yilga uzaytiriladi.

## 6. Tomonlarning rekvizitlari

**Yetkazib beruvchi:** {{sellerName}}, STIR {{sellerInn}}, {{sellerAddress}}. {{sellerBank}}

Direktor: {{sellerDirector}} ______________

**Xaridor:** {{company}}, STIR {{inn}}, {{address}}, tel. {{phone}}. Bank: {{bankName}}, MFO {{mfo}}, h/r {{bankAccount}}

Direktor: {{director}} ______________
`;
