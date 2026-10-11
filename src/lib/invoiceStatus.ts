import type { ContractStatus, CorporateInvoice, InvoiceStatus, Prisma } from '@prisma/client';

export const contractStatusNames: Record<ContractStatus, string> = { active: 'Faol', suspended: "To'xtatilgan", closed: 'Yopilgan' };
export const invoiceStatusNames: Record<InvoiceStatus, string> = {
  issued: 'Berilgan',
  partial: "Qisman to'langan",
  paid: "To'langan",
  overdue: "Muddati o'tgan",
  cancelled: 'Bekor qilingan',
};

/** To'lanishi kutilayotgan hisob-fakturalar (bazada "overdue" yozilmaydi, lekin eski yozuvlar uchun qo'shilgan) */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ['issued', 'partial', 'overdue'];

const DAY_MS = 86_400_000;
const TASHKENT_OFFSET_MS = 5 * 3_600_000; // UTC+5, yozgi vaqt yo'q

/**
 * "Muddati o'tgan" chegarasi: bugungi Toshkent kunining boshi. To'lov muddati mijozga faqat sana bilan ko'rsatiladi va
 * shartnomada "N kun ichida" deyilgan, shuning uchun muddat kuni to'liq hisobga kiradi: hisob-faktura faqat
 * `dueDate < overdueCutoff(now)` bo'lganda, ya'ni muddatdan keyingi kun boshlangach muddati o'tgan sanaladi.
 */
export function overdueCutoff(now: Date): Date {
  return new Date(Math.floor((now.getTime() + TASHKENT_OFFSET_MS) / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS);
}

/**
 * Hisob-fakturasi qarz sanaladigan buyurtma: bekor qilinmagan va to'lovi "to'langan" / "qaytarilgan" deb belgilanmagan.
 * Buyurtma boshqa yo'l bilan to'langan yoki bekor qilingan, hisob-faktura esa hali yopilmagan bo'lishi mumkin (eski yozuvlar,
 * moliya bekor qilmagan hujjat) — bunday hisob-faktura mijozga ham, xodimlarga ham qarz bo'lib ko'rinmasin.
 */
export const OWED_ORDER: Prisma.OrderWhereInput = { status: { not: 'cancelled' }, paymentStatus: { notIn: ['paid', 'refunded'] } };

/** Muddati o'tgan, hali to'lanmagan hisob-fakturalar sharti: kunlik eslatma, boshqaruv boti va bosh sahifa bir xil sanasin */
export const overdueInvoiceWhere = (now: Date): Prisma.CorporateInvoiceWhereInput => ({ status: { in: OPEN_INVOICE_STATUSES }, dueDate: { lt: overdueCutoff(now) }, order: OWED_ORDER });

/** Muddati o'tganini o'qishda hisoblaymiz: berilgan/qisman to'langan va muddat kuni tugagan bo'lsa */
export function effectiveInvoiceStatus(inv: Pick<CorporateInvoice, 'status' | 'dueDate'>, now = new Date()): InvoiceStatus {
  if ((inv.status === 'issued' || inv.status === 'partial') && inv.dueDate < overdueCutoff(now)) return 'overdue';
  return inv.status;
}

/** Admin ro'yxatidagi holat filtri. "Muddati o'tgan" bazada saqlanmaydi, shuning uchun nishon (effectiveInvoiceStatus) bilan bir xil chegaradan hisoblanadi */
export function invoiceStatusWhere(status: InvoiceStatus, now: Date): Prisma.CorporateInvoiceWhereInput {
  const cutoff = overdueCutoff(now);
  if (status === 'overdue') return { OR: [{ status: 'overdue' }, { status: { in: ['issued', 'partial'] }, dueDate: { lt: cutoff } }] };
  if (status === 'issued' || status === 'partial') return { status, dueDate: { gte: cutoff } };
  return { status };
}
