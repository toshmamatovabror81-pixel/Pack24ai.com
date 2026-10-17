import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { toNumber } from './format';
import { OPEN_INVOICE_STATUSES, overdueCutoff, OWED_ORDER } from './invoiceStatus';
import type { CustomerScope } from './telegram/customers';

/**
 * Mijozning o'z ma'lumotlari (mijoz boti uchun): buyurtmalar ro'yxati, bitta buyurtma, qarzdorlik.
 * Hamma so'rov `CustomerScope` bilan cheklanadi — bot hech qachon id bo'yicha "ochiq" qidirmaydi.
 */

const money = (v: unknown) => Math.round(toNumber(v as number) * 100) / 100;

/** Shu mijozga tegishli buyurtmalar sharti. Hech qanday belgi bo'lmasa — hech narsa mos kelmaydi. */
export function orderWhere(scope: CustomerScope): Prisma.OrderWhereInput {
  const or: Prisma.OrderWhereInput[] = [{ telegramUserId: scope.telegramId }];
  if (scope.phone) or.push({ contactPhone: scope.phone });
  if (scope.userId) or.push({ userId: scope.userId });
  return { deletedAt: null, status: { not: 'draft' }, OR: or };
}

const LIST_SELECT = {
  id: true, status: true, paymentStatus: true, paymentMethod: true, totalAmount: true, createdAt: true, accessToken: true,
} satisfies Prisma.OrderSelect;
export type OrderListItem = Prisma.OrderGetPayload<{ select: typeof LIST_SELECT }>;

export async function listOrders(scope: CustomerScope, page = 0, pageSize = 6): Promise<{ items: OrderListItem[]; total: number; page: number; pages: number }> {
  const where = orderWhere(scope);
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(0, page), pages - 1);
  const items = await prisma.order.findMany({ where, orderBy: { id: 'desc' }, skip: p * pageSize, take: pageSize, select: LIST_SELECT });
  return { items, total, page: p, pages };
}

const DETAIL_INCLUDE = {
  items: { include: { product: { select: { name: true, nameI18n: true } } } },
  workOrders: { where: { status: { not: 'cancelled' } }, orderBy: { createdAt: 'asc' }, select: { productName: true, quantity: true, status: true, currentStage: true, progress: true, deadline: true } },
  corporateInvoices: { where: { status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' }, take: 1, select: { invoiceNo: true, status: true, dueDate: true, totalAmount: true, paidAmount: true } },
  events: { where: { kind: 'status' }, orderBy: { createdAt: 'asc' }, select: { toValue: true, createdAt: true } },
} satisfies Prisma.OrderInclude;
export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Bitta buyurtma — faqat shu mijozniki bo'lsa */
export function getOrder(scope: CustomerScope, id: number): Promise<OrderDetail | null> {
  return prisma.order.findFirst({ where: { AND: [{ id }, orderWhere(scope)] }, include: DETAIL_INCLUDE });
}

export type DebtInvoice = { invoiceNo: string; orderId: number; accessToken: string | null; total: number; paid: number; remaining: number; dueDate: Date; overdue: boolean; contractNo: string | null };
export type DebtContract = { contractNo: string; companyName: string; creditLimit: number; used: number; available: number | null; paymentTermDays: number };
export type DebtOrder = { id: number; accessToken: string | null; total: number; paymentMethod: string | null; deliveryMethod: string | null; createdAt: Date };
export type CustomerDebt = {
  /** Hisob-fakturalar bo'yicha qoldiq */
  invoices: DebtInvoice[];
  invoiceTotal: number;
  overdueTotal: number;
  /** Hisob-fakturasiz, hali to'lanmagan buyurtmalar (naqd / bank o'tkazmasi / onlayn to'lov tugallanmagan) */
  unpaidOrders: DebtOrder[];
  unpaidOrdersTotal: number;
  contracts: DebtContract[];
  total: number;
};

/**
 * Mijozning qarzdorligi. Faqat tasdiqlangan telefon (va shu telefonli sayt akkaunti) bo'yicha hisoblanadi —
 * buyurtma havolasi orqali ulangan chatga kompaniya qarzi ko'rsatilmaydi.
 * "Balans" oldindan to'lov hisobi emas: bu to'lanishi kerak bo'lgan summa (hisob-fakturalar qoldig'i + to'lanmagan buyurtmalar).
 */
export async function customerDebt(scope: CustomerScope, now = new Date()): Promise<CustomerDebt | null> {
  if (!scope.phone) return null;
  const mine: Prisma.OrderWhereInput[] = [{ contactPhone: scope.phone }, ...(scope.userId ? [{ userId: scope.userId }] : [])];
  const contractMine: Prisma.ContractWhereInput[] = [{ phone: scope.phone }, ...(scope.userId ? [{ userId: scope.userId }] : [])];

  const [invoiceRows, contractRows, orderRows] = await Promise.all([
    prisma.corporateInvoice.findMany({
      // To'langan yoki bekor qilingan buyurtmaning hisob-fakturasi qarz emas (hujjat hali yopilmagan bo'lsa ham). Shart yuqori
      // darajada turadi: OR ichida bo'lsa, shartnoma tarmog'i orqali baribir o'tib ketardi.
      where: { status: { in: OPEN_INVOICE_STATUSES }, order: OWED_ORDER, OR: [{ order: { deletedAt: null, OR: mine } }, { contract: { OR: contractMine } }] },
      orderBy: { dueDate: 'asc' },
      select: { invoiceNo: true, orderId: true, totalAmount: true, paidAmount: true, dueDate: true, order: { select: { accessToken: true } }, contract: { select: { contractNo: true } } },
    }),
    prisma.contract.findMany({
      where: { status: 'active', OR: contractMine },
      orderBy: { id: 'asc' },
      select: { id: true, contractNo: true, companyName: true, creditLimit: true, paymentTermDays: true },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null, OR: mine,
        status: { notIn: ['cancelled', 'draft'] },
        paymentStatus: { in: ['pending', 'processing', 'failed'] },
        corporateInvoices: { none: { status: { not: 'cancelled' } } },
      },
      // Cheklovsiz: jami summa hamma qator bo'yicha hisoblanadi (xabardagi satrlar sonini ko'rinishning o'zi cheklaydi)
      orderBy: { id: 'desc' },
      select: { id: true, accessToken: true, totalAmount: true, paymentMethod: true, deliveryMethod: true, createdAt: true },
    }),
  ]);

  const cutoff = overdueCutoff(now);
  const invoices: DebtInvoice[] = invoiceRows
    .map((i) => {
      const total = money(i.totalAmount);
      const paid = money(i.paidAmount);
      return { invoiceNo: i.invoiceNo, orderId: i.orderId, accessToken: i.order.accessToken, total, paid, remaining: money(total - paid), dueDate: i.dueDate, overdue: i.dueDate < cutoff, contractNo: i.contract?.contractNo ?? null };
    })
    .filter((i) => i.remaining > 0);

  // Nasiya limitidan foydalanilgani: shartnomaning BARCHA ochiq hisob-fakturalari (boshqa telefondan berilgan buyurtmalar ham),
  // yuqoridagi ro'yxat bilan bir xil qoida bo'yicha — to'langan yoki bekor qilingan buyurtmaniki limitni band qilmaydi
  const used = contractRows.length
    ? await prisma.corporateInvoice.groupBy({
        by: ['contractId'],
        where: { contractId: { in: contractRows.map((c) => c.id) }, status: { in: OPEN_INVOICE_STATUSES }, order: OWED_ORDER },
        _sum: { totalAmount: true, paidAmount: true },
      })
    : [];
  const usedBy = new Map(used.map((u) => [u.contractId, money(toNumber(u._sum.totalAmount) - toNumber(u._sum.paidAmount))]));
  const contracts: DebtContract[] = contractRows.map((c) => {
    const limit = money(c.creditLimit);
    const u = Math.max(0, usedBy.get(c.id) ?? 0);
    return { contractNo: c.contractNo, companyName: c.companyName, creditLimit: limit, used: u, available: limit > 0 ? Math.max(0, money(limit - u)) : null, paymentTermDays: c.paymentTermDays };
  });

  const unpaidOrders: DebtOrder[] = orderRows.map((o) => ({ id: o.id, accessToken: o.accessToken, total: money(o.totalAmount), paymentMethod: o.paymentMethod, deliveryMethod: o.deliveryMethod, createdAt: o.createdAt }));
  const invoiceTotal = money(invoices.reduce((s, i) => s + i.remaining, 0));
  const overdueTotal = money(invoices.filter((i) => i.overdue).reduce((s, i) => s + i.remaining, 0));
  const unpaidOrdersTotal = money(unpaidOrders.reduce((s, o) => s + o.total, 0));
  return { invoices, invoiceTotal, overdueTotal, unpaidOrders, unpaidOrdersTotal, contracts, total: money(invoiceTotal + unpaidOrdersTotal) };
}
