import 'server-only';
import type { Order, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from './db';
import { deductForOrder } from './inventory';
import { OPEN_INVOICE_STATUSES } from './invoiceStatus';
import { notifyCustomerOrderStatus, notifyCustomerPaid, notifyStaffPaid } from './orderNotify';
import { isManualPayment, ORDER_FLOW, ORDER_STATUSES } from './orderStatus';
import { clip } from './telegram/api';

/**
 * Buyurtma holati va to'lovini o'zgartirishning yagona joyi. Admin panel ham, boshqaruv boti ham shu funksiyalarni
 * chaqiradi: vaqt belgilari, ombordan chiqim, tarix (OrderEvent) va mijozga xabar bir xil ishlaydi.
 * Yozish "holat hali o'zgarmagan bo'lsa" sharti bilan bajariladi — ikki xodim bir vaqtda bosganda faqat bittasi o'tadi.
 * `expected` — chaqiruvchi (admin formasi) ko'rib turgan qiymat: bazadagi qiymat undan farq qilsa (forma ochiq turganda bot yoki
 * boshqa xodim o'zgartirgan) hech narsa yozilmaydi va "conflict" qaytadi. Tanlangan qiymat allaqachon joyida bo'lsa — bu ziddiyat emas.
 */

export type Actor = { name: string; via: 'admin' | 'staff_bot' | 'payme' | 'click' | 'invoice' | 'system' };

export type StatusResult =
  | { ok: true; changed: boolean; order: Order }
  | { ok: false; reason: 'not_found' | 'flow' | 'conflict'; order?: Order };

export async function changeOrderStatus(orderId: number, next: OrderStatus, actor: Actor, opts: { enforceFlow?: boolean; expected?: string } = {}): Promise<StatusResult> {
  if (!ORDER_STATUSES.includes(next)) return { ok: false, reason: 'flow' };
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === next) return { ok: true, changed: false, order };
  // Eskirgan forma: eski holat ustidan yozilsa buyurtma orqaga qaytib, mijozga teskari xabar ketardi
  if (opts.expected != null && order.status !== opts.expected) return { ok: false, reason: 'conflict', order };
  if (opts.enforceFlow && !ORDER_FLOW[order.status].includes(next)) return { ok: false, reason: 'flow', order };

  const now = new Date();
  const data: Prisma.OrderUpdateManyMutationInput = { status: next };
  if (next === 'processing' && !order.confirmedAt) data.confirmedAt = now;
  if (next === 'shipping' && !order.shippedAt) data.shippedAt = now;
  if (next === 'delivered' && !order.deliveredAt) data.deliveredAt = now;
  if (next === 'cancelled' && !order.cancelledAt) data.cancelledAt = now;

  const updated = await prisma.order.updateMany({ where: { id: orderId, status: order.status }, data });
  if (updated.count !== 1) {
    const fresh = await prisma.order.findUnique({ where: { id: orderId } });
    return { ok: false, reason: 'conflict', order: fresh ?? order };
  }
  await prisma.orderEvent.create({ data: { orderId, kind: 'status', fromValue: order.status, toValue: next, actor: clip(actor.name, 100), via: actor.via } }).catch((e) => console.error('[orderFlow] tarix', orderId, e));

  // Birinchi yetkazishda ombordan chiqim (deliveredAt — takrorlanmaslik belgisi); ombor muammosi buyurtma holatini to'xtatmasin
  if (next === 'delivered' && !order.deliveredAt) {
    try {
      await deductForOrder(orderId, actor.name);
    } catch (e) {
      console.error('deductForOrder', orderId, e);
    }
  }
  const fresh = (await prisma.order.findUnique({ where: { id: orderId } })) ?? { ...order, status: next };
  await notifyCustomerOrderStatus(fresh);
  return { ok: true, changed: true, order: fresh };
}

export type PaymentResult =
  | { ok: true; changed: boolean; order: Order }
  | { ok: false; reason: 'not_found' | 'online' | 'conflict'; order?: Order };

/**
 * "To'langan" buyurtmaning ochiq hisob-fakturalarini yopadi (to'langan summa = jami). Hisob-faktura sahifasi buni teskari
 * yo'nalishda qiladi; busiz mijozga "to'lov qabul qilindi" ketadi-yu, o'sha hisob-faktura balansda va qarzdorlar ro'yxatida turaveradi.
 * Yozuv shartli: buyurtma hozir ham "to'langan" va hisob-faktura hali ochiq bo'lsagina — takror chaqirilsa yoki orada moliya
 * hujjatni bekor qilgan bo'lsa hech narsa o'zgarmaydi. To'lov "to'lanmagan"ga qaytarilsa hisob-fakturaga tegilmaydi.
 * Qaytadi: yopilgan hisob-fakturalar soni.
 */
export async function settleInvoicesOfPaidOrder(orderId: number, tx: Prisma.TransactionClient = prisma): Promise<number> {
  const open = await tx.corporateInvoice.findMany({ where: { orderId, status: { in: OPEN_INVOICE_STATUSES } }, select: { id: true, totalAmount: true } });
  const paidAt = new Date();
  let settled = 0;
  for (const inv of open) {
    const updated = await tx.corporateInvoice.updateMany({
      where: { id: inv.id, status: { in: OPEN_INVOICE_STATUSES }, order: { paymentStatus: 'paid' } },
      data: { paidAmount: inv.totalAmount, paidAt, status: 'paid' },
    });
    settled += updated.count;
  }
  return settled;
}

/** Qo'lda to'lov holati (faqat naqd va bank o'tkazmasi; onlayn to'lovni Payme/Click o'zi belgilaydi) */
export async function setManualPayment(orderId: number, next: Extract<PaymentStatus, 'pending' | 'paid' | 'refunded'>, actor: Actor, opts: { expected?: string } = {}): Promise<PaymentResult> {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, reason: 'not_found' };
  if (!isManualPayment(order.paymentMethod)) return { ok: false, reason: 'online', order };
  if (order.paymentStatus === next) return { ok: true, changed: false, order };
  if (opts.expected != null && order.paymentStatus !== opts.expected) return { ok: false, reason: 'conflict', order };
  // Bitta tranzaksiya: buyurtma "to'langan" bo'lib, hisob-fakturasi ochiq qolgan oraliq holat bazaga tushmaydi
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: orderId, paymentStatus: order.paymentStatus }, data: { paymentStatus: next } });
    if (updated.count !== 1) return false;
    if (next === 'paid') await settleInvoicesOfPaidOrder(orderId, tx);
    return true;
  });
  if (!changed) return { ok: false, reason: 'conflict', order };
  const fresh = { ...order, paymentStatus: next };
  await afterPaymentChange(fresh, order.paymentStatus, actor, { notifyStaff: false });
  return { ok: true, changed: true, order: fresh };
}

/**
 * To'lov holati o'zgargandan KEYIN chaqiriladi (yozuvni chaqiruvchi o'zi bajaradi: Payme, Click, hisob-faktura, qo'lda):
 * tarixga yozadi, "to'langan" bo'lsa mijozga va (onlayn to'lovda) xodimlarga xabar beradi; Payme/Click to'lovida buyurtmaning
 * ochiq hisob-fakturasini ham yopadi. Xato tashlamaydi.
 */
export async function afterPaymentChange(
  order: Pick<Order, 'id' | 'status' | 'paymentStatus' | 'totalAmount' | 'accessToken' | 'telegramUserId' | 'contactPhone' | 'userId'>,
  from: PaymentStatus | null,
  actor: Actor,
  opts: { notifyStaff?: boolean } = {},
): Promise<void> {
  try {
    await prisma.orderEvent.create({ data: { orderId: order.id, kind: 'payment', fromValue: from, toValue: order.paymentStatus, actor: clip(actor.name, 100), via: actor.via } });
  } catch (e) {
    console.error('[orderFlow] to\'lov tarixi', order.id, e);
  }
  if (order.paymentStatus !== 'paid') return;
  // Onlayn to'lovda yozuvni Payme/Click yo'li bajaradi — hujjat uchun berilgan ochiq hisob-faktura shu yerda yopiladi
  // (qo'lda to'lovda setManualPayment o'z tranzaksiyasida yopadi). Xatosi xabarnomalarni to'xtatmaydi.
  if (actor.via === 'payme' || actor.via === 'click') {
    try {
      await settleInvoicesOfPaidOrder(order.id);
    } catch (e) {
      console.error('[orderFlow] hisob-fakturani yopish', order.id, e);
    }
  }
  await notifyCustomerPaid(order);
  if (opts.notifyStaff ?? true) await notifyStaffPaid(order.id, actor.name);
}
