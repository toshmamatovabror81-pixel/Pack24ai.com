import 'server-only';
import type { InvoiceStatus, Order, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from './db';
import { deductForOrder } from './inventory';
import { OPEN_INVOICE_STATUSES } from './invoiceStatus';
import { notifyCustomerOrderStatus, notifyCustomerPaid, notifyCustomerPaymentReverted, notifyStaffPaid, notifyStaffPaymentReverted } from './orderNotify';
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

/**
 * `reopened` — "to'lanmagan"ga qaytarilganda qayta ochilgan hisob-fakturalar soni; `stillPaid` — shundan keyin ham "to'langan"
 * turgan hisob-fakturalar raqamlari (alohida to'langan yoki surat saqlanmagan, yangilanishdan oldingi belgi yopgan — qaysi biri ekani
 * noma'lum) — chaqiruvchi xodimga ikkala sababni ham aytadi.
 */
export type PaymentResult =
  | { ok: true; changed: boolean; order: Order; reopened?: number; stillPaid?: string[] }
  | { ok: false; reason: 'not_found' | 'online' | 'conflict'; order?: Order };

/** Hisob-fakturaning "to'langan" bo'lishidan oldingi holati (to'lov tarixi yozuvida saqlanadi — OrderEvent.meta) */
export type InvoiceSnapshot = { id: number; status: InvoiceStatus; paidAmount: string; paidAt: string | null };
/** To'lov tarixi yozuvidagi qo'shimcha: "to'langan" yozuvida yopilgan hisob-fakturalar surati, bekor qilish yozuvida qayta ochilganlari raqami */
type PaymentMeta = { invoices: InvoiceSnapshot[] } | { reopened: string[] };

const SNAPSHOT_STATUSES: InvoiceStatus[] = ['issued', 'partial', 'overdue'];
/** Summa ustunga (Decimal(18, 2)) sig'adigan ko'rinishda: sig'maydigan qiymat yozuvni emas, butun bekor qilish amalini xato bilan to'xtatardi */
const SNAPSHOT_AMOUNT = /^\d{1,16}(\.\d{1,2})?$/;
const SNAPSHOT_DATE_MAX = Date.UTC(2200, 0, 1);
/** Bazadagi JSON'dan suratlar (shakli buzilgan yozuv tashlab ketiladi: noto'g'ri ma'lumot bilan hisob-faktura o'zgartirilmaydi) */
function snapshotsOf(meta: unknown): InvoiceSnapshot[] {
  const list = (meta as { invoices?: unknown } | null)?.invoices;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw): InvoiceSnapshot[] => {
    const v = (raw ?? {}) as Record<string, unknown>;
    // id ham ustunga (INT4) sig'ishi kerak — sig'maydigan qiymat so'rovni xato bilan to'xtatardi
    if (!Number.isSafeInteger(v.id) || (v.id as number) < 1 || (v.id as number) > 2_147_483_647) return [];
    if (!SNAPSHOT_STATUSES.includes(v.status as InvoiceStatus) || typeof v.paidAmount !== 'string' || !SNAPSHOT_AMOUNT.test(v.paidAmount)) return [];
    const at = typeof v.paidAt === 'string' ? Date.parse(v.paidAt) : NaN;
    const paidAt = at >= 0 && at < SNAPSHOT_DATE_MAX ? (v.paidAt as string) : null;
    return [{ id: v.id as number, status: v.status as InvoiceStatus, paidAmount: v.paidAmount, paidAt }];
  });
}

/**
 * "To'langan" buyurtmaning ochiq hisob-fakturalarini yopadi (to'langan summa = jami). Hisob-faktura sahifasi buni teskari
 * yo'nalishda qiladi; busiz mijozga "to'lov qabul qilindi" ketadi-yu, o'sha hisob-faktura balansda va qarzdorlar ro'yxatida turaveradi.
 * Yozuv shartli: buyurtma hozir ham "to'langan" va hisob-faktura hali ochiq bo'lsagina — takror chaqirilsa yoki orada moliya
 * hujjatni bekor qilgan bo'lsa hech narsa o'zgarmaydi.
 * Qaytadi: yopilgan hisob-fakturalarning yopilishdan OLDINGI holati (belgi bekor qilinsa shu holatga qaytariladi).
 */
export async function settleInvoicesOfPaidOrder(orderId: number, tx: Prisma.TransactionClient = prisma): Promise<InvoiceSnapshot[]> {
  // Qatorlar qulflab o'qiladi: ayni paytda hisob-faktura sahifasida kiritilayotgan qisman to'lov suratga tushmay qolmasin —
  // aks holda belgi bekor qilinganda hisob-faktura eskirgan holatga qaytib, o'sha to'lov yo'qolardi
  await tx.$queryRaw`SELECT "id" FROM "CorporateInvoice" WHERE "orderId" = ${orderId} FOR UPDATE`;
  const open = await tx.corporateInvoice.findMany({ where: { orderId, status: { in: OPEN_INVOICE_STATUSES } }, select: { id: true, totalAmount: true, status: true, paidAmount: true, paidAt: true } });
  const paidAt = new Date();
  const settled: InvoiceSnapshot[] = [];
  for (const inv of open) {
    const updated = await tx.corporateInvoice.updateMany({
      where: { id: inv.id, status: { in: OPEN_INVOICE_STATUSES }, order: { paymentStatus: 'paid' } },
      data: { paidAmount: inv.totalAmount, paidAt, status: 'paid' },
    });
    if (updated.count === 1) settled.push({ id: inv.id, status: inv.status, paidAmount: inv.paidAmount.toString(), paidAt: inv.paidAt?.toISOString() ?? null });
  }
  return settled;
}

/**
 * Buyurtma "to'lanmagan"ga qaytarilganda (xato qo'yilgan "to'landi" belgisi bekor qilindi): "to'langan" belgisi yopgan hisob-fakturalar
 * yopilishdan oldingi holatiga qaytariladi (qaysilari va qanday holatdan — "to'langan" yozuvining meta.invoices suratida).
 * Oxirgi "to'lanmagan" yozuvidan keyingi HAMMA "to'langan" yozuvlari ko'riladi (yangisidan boshlab): orada "qaytarilgan" bo'lib
 * o'tgan bo'lsa ham (to'langan -> qaytarilgan -> to'lanmagan) surat yo'qolmaydi. Faqat hozir ham "to'langan" turgan va shu buyurtmaga
 * tegishli hisob-faktura qaytariladi: orada moliya uni bekor qilgan yoki qayta ochgan bo'lsa tegilmaydi; suratda yo'q (alohida
 * to'langan) hisob-faktura ham o'z holida qoladi — bundaylar `stillPaid`da qaytadi, xodim tekshirishi uchun.
 * Yozuvlar id bo'yicha tartiblanadi: har bir to'lov amali avval buyurtma qatorini qulflaydi, shuning uchun id tartibi amallar tartibi
 * (createdAt esa tranzaksiya boshlangan vaqt — ketma-ketlikni kafolatlamaydi).
 */
async function reopenInvoicesOfUnpaidOrder(orderId: number, tx: Prisma.TransactionClient): Promise<{ reopened: string[]; stillPaid: string[]; announced: boolean; wasPaid: boolean }> {
  const boundary = await tx.orderEvent.findFirst({ where: { orderId, kind: 'payment', toValue: 'pending' }, orderBy: { id: 'desc' }, select: { id: true } });
  const paidEvents = await tx.orderEvent.findMany({
    where: { orderId, kind: 'payment', toValue: 'paid', ...(boundary ? { id: { gt: boundary.id } } : {}) },
    orderBy: { id: 'desc' },
    select: { meta: true, via: true },
  });
  const ids: number[] = [];
  for (const ev of paidEvents) {
    for (const snap of snapshotsOf(ev.meta)) {
      const updated = await tx.corporateInvoice.updateMany({
        where: { id: snap.id, orderId, status: 'paid' },
        data: { status: snap.status, paidAmount: snap.paidAmount, paidAt: snap.paidAt ? new Date(snap.paidAt) : null },
      });
      if (updated.count === 1) ids.push(snap.id);
    }
  }
  const rows = await tx.corporateInvoice.findMany({ where: { orderId, OR: [{ id: { in: ids } }, { status: 'paid' }] }, orderBy: { id: 'asc' }, select: { id: true, invoiceNo: true, status: true } });
  return {
    reopened: rows.filter((r) => ids.includes(r.id)).map((r) => r.invoiceNo),
    stillPaid: rows.filter((r) => r.status === 'paid').map((r) => r.invoiceNo),
    // Hisob-faktura sahifasidan qabul qilingan to'lov xodimlarga e'lon qilingan ("To'lov qabul qilindi" kartasi) — tuzatish ham ularga boradi
    announced: paidEvents.some((ev) => ev.via === 'invoice'),
    // Oxirgi "to'lanmagan"dan beri buyurtma "to'langan" bo'lgan: mijoz "to'lov qabul qilindi" xabarini olgan va tuzatish hali bormagan
    wasPaid: paidEvents.length > 0,
  };
}

/**
 * Buyurtmadagi oxirgi "to'langan" belgisining tarix yozuvi (OrderEvent.id); tarixsiz (yangilanishdan oldingi) belgi — 0.
 * Belgini bekor qilish tasdig'i (bot tugmasi ouy_<id>_<mark>, admin formasidagi prevPaidMark) aynan shu belgiga bog'lanadi —
 * setManualPayment `expectedMark` bilan tekshiradi.
 */
export async function lastPaidMark(orderId: number, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
  const ev = await db.orderEvent.findFirst({ where: { orderId, kind: 'payment', toValue: 'paid' }, orderBy: { id: 'desc' }, select: { id: true } });
  return ev?.id ?? 0;
}

/** Tasdiq so'ralgan belgi bilan hozirgi belgi bir xil emas (orada bekor qilinib, qayta qo'yilgan): tranzaksiya bekor qilinadi, natija "conflict" */
class StaleMark extends Error {}

/**
 * Qo'lda to'lov holati (faqat naqd va bank o'tkazmasi; onlayn to'lovni Payme/Click o'zi belgilaydi). Kim o'zgartira olishini
 * chaqiruvchi tekshiradi: admin panel ham, bot ham faqat "finance" (moliya) ruxsati bor xodimga yo'l beradi.
 * `expected` — chaqiruvchi ko'rgan to'lov holati; `expectedMark` — chaqiruvchi ko'rgan "to'langan" belgisi (lastPaidMark): ikkisidan
 * biri eskirgan bo'lsa hech narsa yozilmaydi va "conflict" qaytadi.
 * "To'langan" -> "to'lanmagan" — xato qo'yilgan belgini bekor qilish: shu belgi yopgan hisob-fakturalar qayta ochiladi va mijozga
 * tuzatish xabari boradi. "Qaytarilgan" orqali aylanib kelinganda ham ("to'langan" -> "qaytarilgan" -> "to'lanmagan") xuddi shunday:
 * o'sha oraliq qadamda hisob-faktura ham ochilmagan, mijozga ham hech narsa aytilmagan. Buyurtma, hisob-faktura va tarix yozuvi
 * bitta tranzaksiyada o'zgaradi.
 */
export async function setManualPayment(orderId: number, next: Extract<PaymentStatus, 'pending' | 'paid' | 'refunded'>, actor: Actor, opts: { expected?: string; expectedMark?: number } = {}): Promise<PaymentResult> {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, reason: 'not_found' };
  if (!isManualPayment(order.paymentMethod)) return { ok: false, reason: 'online', order };
  if (order.paymentStatus === next) return { ok: true, changed: false, order };
  if (opts.expected != null && order.paymentStatus !== opts.expected) return { ok: false, reason: 'conflict', order };
  // Bitta tranzaksiya: buyurtma "to'langan" bo'lib hisob-fakturasi ochiq qolgan (yoki aksincha) oraliq holat bazaga tushmaydi;
  // tarix yozuvi ham shu yerda — belgi bekor qilinganda qaysi hisob-fakturalar qaytarilishi aynan shu yozuvdan olinadi
  const result = await prisma
    .$transaction(async (tx) => {
      const updated = await tx.order.updateMany({ where: { id: orderId, paymentStatus: order.paymentStatus }, data: { paymentStatus: next } });
      if (updated.count !== 1) return null;
      // Buyurtma qatori qulflangan: amal qilinayotgan "to'langan" belgisi chaqiruvchi ko'rgan belgi ekani shu yerda tekshiriladi. Holat
      // nomi ("to'langan") buning uchun yetmaydi: tasdiq tugmasi chatda (yoki forma ochiq) qolib, orada belgi bekor qilinib, haqiqiy
      // to'lov bilan QAYTA qo'yilgan bo'lsa holat yana "to'langan" — eski tasdiq o'sha haqiqiy to'lovni bekor qilib yuborardi
      if (opts.expectedMark != null && (await lastPaidMark(orderId, tx)) !== opts.expectedMark) throw new StaleMark();
      const settled = next === 'paid' ? await settleInvoicesOfPaidOrder(orderId, tx) : [];
      const undo = next === 'pending' && (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') ? await reopenInvoicesOfUnpaidOrder(orderId, tx) : null;
      await writePaymentEvent(tx, orderId, order.paymentStatus, next, actor, settled, undo?.reopened);
      return { undo };
    })
    .catch((e: unknown) => {
      if (e instanceof StaleMark) return null;
      throw e;
    });
  if (!result) return { ok: false, reason: 'conflict', order: (await prisma.order.findUnique({ where: { id: orderId } })) ?? order };
  const fresh = { ...order, paymentStatus: next };
  // Xodimlarga faqat ularga e'lon qilingan to'lovning tuzatishi boradi (bot yoki admin formasidan qo'yilgan belgi e'lon qilinmaydi)
  await afterPaymentChange(fresh, order.paymentStatus, actor, { notifyStaff: result.undo?.announced ?? false, reverted: result.undo?.wasPaid ?? false, event: false });
  return { ok: true, changed: true, order: fresh, ...(result.undo ? { reopened: result.undo.reopened.length, stillPaid: result.undo.stillPaid } : {}) };
}

/**
 * To'lov tarixi yozuvi. `settled` — shu amal yopgan hisob-fakturalarning avvalgi holati, `reopened` — shu amal qayta ochgan
 * hisob-fakturalar raqamlari (bo'lsa meta'ga yoziladi: buyurtma sahifasidagi "Tarix"da ko'rinadi).
 */
export function writePaymentEvent(db: Prisma.TransactionClient, orderId: number, from: PaymentStatus | null, to: PaymentStatus, actor: Actor, settled: InvoiceSnapshot[] = [], reopened: string[] = []) {
  const meta: PaymentMeta | undefined = settled.length ? { invoices: settled } : reopened.length ? { reopened } : undefined;
  return db.orderEvent.create({ data: { orderId, kind: 'payment', fromValue: from, toValue: to, actor: clip(actor.name, 100), via: actor.via, ...(meta ? { meta: meta as unknown as Prisma.InputJsonValue } : {}) } });
}

/**
 * To'lov holati o'zgargandan KEYIN chaqiriladi (yozuvni chaqiruvchi o'zi bajaradi: Payme, Click, hisob-faktura, qo'lda):
 * tarixga yozadi (`event: false` — chaqiruvchi o'z tranzaksiyasida yozib bo'lgan), "to'langan" bo'lsa mijozga va (onlayn to'lovda)
 * xodimlarga xabar beradi; Payme/Click to'lovida buyurtmaning ochiq hisob-fakturasini ham yopadi. Qo'lda qo'yilgan "to'langan"
 * belgisi bekor qilinganda ("to'langan" -> "to'lanmagan"; `reverted` — "qaytarilgan" orqali aylanib kelingan bo'lsa ham) mijozga
 * tuzatish xabari boradi; o'sha to'lov xodimlarga e'lon qilingan bo'lsa (`notifyStaff`) ularga ham. Xato tashlamaydi.
 */
export async function afterPaymentChange(
  order: Pick<Order, 'id' | 'status' | 'paymentStatus' | 'totalAmount' | 'accessToken' | 'telegramUserId' | 'contactPhone' | 'userId'>,
  from: PaymentStatus | null,
  actor: Actor,
  opts: { notifyStaff?: boolean; event?: boolean; reverted?: boolean } = {},
): Promise<void> {
  if (opts.event ?? true) {
    try {
      await writePaymentEvent(prisma, order.id, from, order.paymentStatus, actor);
    } catch (e) {
      console.error('[orderFlow] to\'lov tarixi', order.id, e);
    }
  }
  // Mijoz "to'lov qabul qilindi" xabarini olgan: belgi xato bo'lgani aytilmasa u buyurtmani to'langan deb o'ylab qoladi
  const undone = from === 'paid' || (from === 'refunded' && opts.reverted === true);
  if (undone && order.paymentStatus === 'pending' && (actor.via === 'admin' || actor.via === 'staff_bot')) {
    await notifyCustomerPaymentReverted(order, from === 'refunded');
    // Chatda "To'lov qabul qilindi" kartasi qolgan xodim to'lanmagan buyurtmani jo'natib yubormasin
    if (opts.notifyStaff ?? true) await notifyStaffPaymentReverted(order.id, actor.name);
    return;
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
