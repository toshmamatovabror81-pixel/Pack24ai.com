import 'server-only';
import type { Order, OrderStatus, ProductionStage } from '@prisma/client';
import { can } from './auth/permissions';
import { prisma } from './db';
import { displayPhone, formatDate, formatPrice } from './format';
import { getDict } from './i18n';
import { overdueInvoiceWhere } from './invoiceStatus';
import { statusKey } from './orderStatus';
import { getSettings } from './settings';
import { siteUrl } from './site';
import { clip, esc, type InlineKeyboard } from './telegram/api';
import { orderRecipients, type BotLang } from './telegram/customers';
import { notifyCustomer, notifyStaff, staleInFlight } from './telegram/notify';
import { supersedePrefix } from './telegram/outbox';
import { staffOrder, staffOrderHtml, staffOrderKeyboard } from './telegram/staffCards';
import { staffRecipients, type StaffUser } from './telegram/staffLink';

/**
 * Buyurtma bo'yicha Telegram xabarnomalari: mijozga (mijoz boti) va xodimlarga (boshqaruv boti).
 * Hech bir funksiya xato tashlamaydi — xabar ketmasa ham buyurtma jarayoni to'xtamaydi (xato logga yoziladi).
 * Mijoz botidagi "Batafsil" tugmasi `o_<id>` callback'ini yuboradi (bots/customer.ts shu prefiksni ushlaydi).
 */

type OrderRef = Pick<Order, 'id' | 'status' | 'totalAmount' | 'accessToken' | 'telegramUserId' | 'contactPhone' | 'userId'>;

const T: Record<BotLang, {
  order: (id: number) => string;
  statusNote: Record<OrderStatus, string>;
  /** Olib ketiladigan buyurtma yo'lga chiqmaydi va yetkazilmaydi: shu holatlarda nom ham, izoh ham boshqacha */
  pickup: Partial<Record<OrderStatus, { label: string; note: string }>>;
  statusLabel: string;
  paid: (sum: string) => string;
  /** Xato qo'yilgan "to'landi" belgisi olib tashlandi. `owed` — buyurtmadan to'lov kutilyaptimi (bekor qilingan buyurtmada yo'q) */
  paymentReverted: (owed: boolean) => string;
  /**
   * "Qaytarilgan"dan "to'lanmagan"ga o'tgan buyurtma: belgi xato qo'yilganmi yoki pul haqiqatan qaytarilganmi — tizim ajrata olmaydi,
   * shuning uchun "xato qo'yilgan edi" deyilmaydi (haqiqatan to'lab, pulini qaytarib olgan mijozga bu noto'g'ri bo'lardi)
   */
  paymentReset: (owed: boolean) => string;
  /** `due` bo'sh — to'lanadigan narsa qolmagan (buyurtma to'langan, puli qaytarilgan yoki bekor qilingan): to'lov muddati yozilmaydi */
  invoice: (no: string, sum: string, due: string | null) => string;
  production: (product: string, stage: string, pct: number) => string;
  productionDone: (product: string) => string;
  details: string;
  open: string;
  invoiceBtn: string;
  questions: (phone: string) => string;
  sum: string;
}> = {
  uz: {
    order: (id) => `Buyurtma #${id}`,
    statusNote: {
      draft: '',
      new_: 'Buyurtmangiz qabul qilindi.',
      processing: 'Buyurtmangiz tasdiqlandi va tayyorlanmoqda.',
      shipping: "Buyurtmangiz yo'lga chiqdi.",
      delivered: 'Buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!',
      cancelled: 'Buyurtmangiz bekor qilindi.',
    },
    pickup: {
      shipping: { label: 'Olib ketishga tayyor', note: 'Buyurtmangiz tayyor, olib ketishingiz mumkin.' },
      delivered: { label: 'Topshirildi', note: 'Buyurtmangiz topshirildi. Xaridingiz uchun rahmat!' },
    },
    statusLabel: 'Holati',
    paid: (sum) => `To'lov qabul qilindi: <b>${sum}</b>`,
    // "bekor qilindi" deyilmaydi: sarlavhadagi "Buyurtma #N" bilan birga buyurtmaning o'zi bekor qilingandek o'qilardi
    paymentReverted: (owed) => `Tuzatish: bu buyurtma bo'yicha «to'lov qabul qilindi» belgisi xato qo'yilgan edi — u olib tashlandi.${owed ? " Buyurtma hozircha <b>to'lanmagan</b> deb hisoblanadi." : ''} Noqulaylik uchun uzr so'raymiz.`,
    paymentReset: (owed) => `Bu buyurtma bo'yicha «to'lov qabul qilindi» belgisi olib tashlandi.${owed ? " Buyurtma hozircha <b>to'lanmagan</b> deb hisoblanadi." : ''}`,
    invoice: (no, sum, due) => `Hisob-faktura <b>${no}</b> tayyor.\nSumma: <b>${sum}</b>${due ? `\nTo'lov muddati: ${due}` : ''}`,
    production: (product, stage, pct) => `Ishlab chiqarish: ${product} — <b>${stage}</b> bosqichida (${pct}%)`,
    productionDone: (product) => `Ishlab chiqarish: ${product} — <b>tayyor</b> (100%)`,
    details: '📦 Batafsil',
    open: '🌐 Saytda ochish',
    invoiceBtn: '🧾 Hisob-faktura',
    questions: (phone) => `Savollar bo'lsa: ${phone}`,
    sum: "so'm",
  },
  ru: {
    order: (id) => `Заказ #${id}`,
    statusNote: {
      draft: '',
      new_: 'Ваш заказ принят.',
      processing: 'Ваш заказ подтверждён и готовится.',
      shipping: 'Ваш заказ отправлен.',
      delivered: 'Ваш заказ доставлен. Спасибо за покупку!',
      cancelled: 'Ваш заказ отменён.',
    },
    pickup: {
      shipping: { label: 'Готов к выдаче', note: 'Ваш заказ готов, его можно забрать.' },
      delivered: { label: 'Выдан', note: 'Ваш заказ выдан. Спасибо за покупку!' },
    },
    statusLabel: 'Статус',
    paid: (sum) => `Оплата получена: <b>${sum}</b>`,
    paymentReverted: (owed) => `Исправление: отметка «оплата получена» по этому заказу была поставлена по ошибке и снята.${owed ? ' Заказ пока считается <b>неоплаченным</b>.' : ''} Приносим извинения за неудобство.`,
    paymentReset: (owed) => `Отметка «оплата получена» по этому заказу снята.${owed ? ' Заказ пока считается <b>неоплаченным</b>.' : ''}`,
    invoice: (no, sum, due) => `Счёт-фактура <b>${no}</b> готов.\nСумма: <b>${sum}</b>${due ? `\nСрок оплаты: ${due}` : ''}`,
    production: (product, stage, pct) => `Производство: ${product} — этап <b>${stage}</b> (${pct}%)`,
    productionDone: (product) => `Производство: ${product} — <b>готово</b> (100%)`,
    details: '📦 Подробнее',
    open: '🌐 Открыть на сайте',
    invoiceBtn: '🧾 Счёт-фактура',
    questions: (phone) => `Если есть вопросы: ${phone}`,
    sum: 'сум',
  },
};

const orderLink = (lang: BotLang, token: string | null) => (token ? `${siteUrl()}/${lang}/orders/${token}` : null);

function customerKeyboard(lang: BotLang, o: Pick<Order, 'id' | 'accessToken'>, invoice = false): InlineKeyboard {
  const url = orderLink(lang, o.accessToken);
  const rows: InlineKeyboard = [[{ text: T[lang].details, callback_data: `o_${o.id}` }, ...(url ? [{ text: T[lang].open, url }] : [])]];
  if (invoice && url) rows.push([{ text: T[lang].invoiceBtn, url: `${url}/invoice` }]);
  return rows;
}

/** Yetib borgan xabarlar soni; bitta oluvchidagi xato qolganlarga xalaqit bermaydi — logga yoziladi */
function countSent(results: PromiseSettledResult<boolean>[], who: string): number {
  let sent = 0;
  for (const r of results) {
    if (r.status === 'rejected') console.error('[orderNotify]', who, r.reason);
    else if (r.value) sent += 1;
  }
  return sent;
}

/** `topic` — holat xabarlari uchun: kechikib qayta yuborilayotgan eski holat yangisidan keyin yetib bormasin (telegram/outbox.ts) */
async function toCustomers(order: OrderRef, build: (lang: BotLang) => { html: string; inline?: InlineKeyboard } | null, topic?: string): Promise<number> {
  try {
    // Hammaga birdaniga: Telegram javob bermasa kutish oluvchilar soniga ko'paymaydi (bitta chaqiruv muddati bilan cheklanadi)
    const results = await Promise.allSettled((await orderRecipients(order)).map(async (r) => {
      const m = build(r.lang);
      return m ? notifyCustomer(r.telegramId, m.html, m.inline, topic) : false;
    }));
    return countSent(results, `mijoz ${order.id}`);
  } catch (e) {
    console.error('[orderNotify] mijoz', order.id, e);
    return 0;
  }
}

/** Buyurtma holati o'zgardi */
export async function notifyCustomerOrderStatus(order: OrderRef & Pick<Order, 'deliveryMethod'>): Promise<number> {
  if (order.status === 'draft') return 0;
  // Bekor qilingan buyurtmaning navbatda turgan ishlab chiqarish xabarlari endi yetib bormasin: yangi ishlab chiqarish xabari
  // chiqmaydi, ya'ni ularni boshqa hech narsa bekor qilmaydi (hamma oluvchilar uchun, xabar yuborilishidan oldin)
  if (order.status === 'cancelled') {
    // Ayni paytda yuborilayotgani ham (Telegram javobini kutmoqda): o'tmasa navbatga tushmasin
    staleInFlight('customer', `order-production:${order.id}:`);
    await supersedePrefix('customer', `order-production:${order.id}:`).catch((e) => console.error('[orderNotify] navbat', order.id, e));
  }
  const phone = order.status === 'cancelled' ? (await getSettings().catch(() => null))?.phone : null;
  return toCustomers(order, (lang) => {
    const t = T[lang];
    const pickup = order.deliveryMethod === 'pickup' ? t.pickup[order.status] : undefined;
    const label = pickup?.label ?? getDict(lang).order.statuses[statusKey(order.status)];
    return {
      html: [
        `📦 <b>${t.order(order.id)}</b>`,
        `${t.statusLabel}: <b>${esc(label)}</b>`,
        pickup?.note ?? t.statusNote[order.status],
        phone ? t.questions(esc(displayPhone(phone))) : null,
      ].filter(Boolean).join('\n'),
      inline: customerKeyboard(lang, order),
    };
  }, `order-status:${order.id}`);
}

/**
 * To'lov xabarlarining mavzusi: "to'lov qabul qilindi" va uning tuzatishi bir-birini navbatda bekor qiladi — Telegram vaqtincha
 * javob bermay kechikkan "qabul qilindi" tuzatishdan KEYIN yetib bormaydi (mijozda aksincha ham: belgi qayta qo'yilsa eski tuzatish ketmaydi).
 * Xodimlarda qo'lda qayta qo'yilgan belgi e'lon qilinmaydi, shuning uchun navbatdagi tuzatish kartasi ATAYLAB bekor qilinmaydi: chatda
 * qolgan "To'lov qabul qilindi" kartasini faqat shu tuzatadi.
 */
const paymentTopic = (orderId: number) => `order-payment:${orderId}`;

/** To'lov qabul qilindi (Payme / Click / naqd / bank o'tkazmasi) */
export async function notifyCustomerPaid(order: OrderRef): Promise<number> {
  return toCustomers(order, (lang) => ({
    html: `✅ <b>${T[lang].order(order.id)}</b>\n${T[lang].paid(formatPrice(order.totalAmount, T[lang].sum))}`,
    inline: customerKeyboard(lang, order),
  }), paymentTopic(order.id));
}

/**
 * Xato qo'yilgan "to'landi" belgisi bekor qilindi: mijoz oldin "to'lov qabul qilindi" xabarini olgan — tuzatish yuboriladi.
 * `viaRefund` — buyurtma "qaytarilgan" orqali "to'lanmagan"ga o'tgan: sababi aytilmaydigan matn (paymentReset).
 */
export async function notifyCustomerPaymentReverted(order: OrderRef, viaRefund = false): Promise<number> {
  const phone = (await getSettings().catch(() => null))?.phone;
  return toCustomers(order, (lang) => ({
    // Bekor qilingan buyurtmadan to'lov kutilmaydi (boshqa xabarlardagi qoida bilan bir xil — invoiceStatus.OWED_ORDER)
    html: [`ℹ️ <b>${T[lang].order(order.id)}</b>`, T[lang][viaRefund ? 'paymentReset' : 'paymentReverted'](order.status !== 'cancelled'), phone ? T[lang].questions(esc(displayPhone(phone))) : null].filter(Boolean).join('\n'),
    inline: customerKeyboard(lang, order),
  }), paymentTopic(order.id));
}

/** Buyurtmaga hisob-faktura berildi */
export async function notifyCustomerInvoice(orderId: number, invoice: { invoiceNo: string; totalAmount: unknown; dueDate: Date }): Promise<number> {
  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order || order.deletedAt) return 0;
  // "Balans" va karta bilan bir xil qoida (invoiceStatus.OWED_ORDER): to'langan, puli qaytarilgan yoki bekor qilingan buyurtmaga
  // hujjat uchun berilgan hisob-fakturada to'lov muddati yozilmaydi — aks holda mijoz to'lash kerak deb o'ylaydi
  const owed = order.status !== 'cancelled' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded';
  return toCustomers(order, (lang) => ({
    html: `🧾 <b>${T[lang].order(order.id)}</b>\n${T[lang].invoice(esc(invoice.invoiceNo), formatPrice(invoice.totalAmount as number, T[lang].sum), owed ? formatDate(invoice.dueDate, lang) : null)}`,
    inline: customerKeyboard(lang, order, true),
  }));
}

/** Ishlab chiqarish bosqichi o'zgardi (buyurtmaga bog'langan ish topshirig'i) */
export async function notifyCustomerProduction(wo: { id: number; orderId: number | null; productName: string; currentStage: ProductionStage; progress: number; status: string }): Promise<number> {
  if (!wo.orderId) return 0;
  const order = await prisma.order.findUnique({ where: { id: wo.orderId } }).catch(() => null);
  if (!order || order.deletedAt || order.status === 'cancelled') return 0;
  const n = await toCustomers(order, (lang) => {
    const t = T[lang];
    const line = wo.status === 'completed'
      ? t.productionDone(esc(wo.productName))
      : t.production(esc(wo.productName), esc(getDict(lang).order.stages[wo.currentStage]), Math.min(100, Math.max(0, Math.round(wo.progress))));
    return { html: `🏭 <b>${t.order(order.id)}</b>\n${line}`, inline: customerKeyboard(lang, order) };
    // Ish topshirig'i bo'yicha alohida: bitta buyurtmaning ikki topshirig'i (nomi bir xil bo'lsa ham) bir-birining xabarini bekor qilmaydi
  }, `order-production:${order.id}:${wo.id}`);
  // Holat yuqorida o'qilgandan keyin, notify() yo'ldagi xabar belgisini qo'yguncha (oluvchilar bazadan o'qilayotgan oraliq) buyurtma bekor
  // qilingan bo'lsa, bekor qilish na yo'ldagi (staleInFlight), na navbatdagi (supersedePrefix) xabarni topmaydi — navbatga tushgani keyin
  // ketib qolardi. Shuning uchun holat qayta o'qiladi: bekor qilingan bo'lsa shu buyurtmaning navbatdagi ishlab chiqarish xabarlari bekor bo'ladi
  const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } }).catch(() => null);
  if (fresh?.status === 'cancelled') await supersedePrefix('customer', `order-production:${order.id}:`).catch((e) => console.error('[orderNotify] navbat', order.id, e));
  return n;
}

/**
 * `inline` — tugmalar har bir oluvchining o'z ruxsatiga qarab yasaladi (masalan «To'landi» faqat moliya ruxsati bor xodimga).
 * `topic` — faqat to'lov kartalari uchun (paymentTopic): navbatda kechikkan "To'lov qabul qilindi" tuzatishdan keyin yetib bormasin.
 */
async function toStaff(section: 'orders' | 'leads' | 'finance', html: string, inline?: (to: StaffUser) => InlineKeyboard, topic?: string): Promise<number> {
  try {
    // Hammaga birdaniga: Telegram javob bermasa kutish xodimlar soniga ko'paymaydi (bitta chaqiruv muddati bilan cheklanadi)
    const results = await Promise.allSettled((await staffRecipients(section)).map(async (u) => notifyStaff(u.telegramId, html, inline?.(u), topic)));
    return countSent(results, 'xodim');
  } catch (e) {
    console.error('[orderNotify] xodim', e);
    return 0;
  }
}

/** Buyurtma kartasi "orders" ruxsati bor xodimlarga. Kartani yasash ham try ichida: bu yerdagi xato checkout yoki to'lov webhook'ini yiqitmasin. */
async function staffCard(orderId: number, note: string, topic?: string): Promise<number> {
  try {
    const o = await staffOrder(orderId);
    if (!o) return 0;
    return await toStaff('orders', staffOrderHtml(o, note), (u) => staffOrderKeyboard(o, can(u.role, 'orders'), can(u.role, 'finance')), topic);
  } catch (e) {
    console.error('[orderNotify] xodim kartasi', orderId, e);
    return 0;
  }
}

/** Yangi buyurtma: "orders" ruxsati bor xodimlarga karta va holat tugmalari bilan */
export async function notifyStaffNewOrder(orderId: number): Promise<number> {
  return staffCard(orderId, '🛒 <b>Yangi buyurtma</b>');
}

/** Onlayn to'lov keldi yoki hisob-faktura to'landi */
export async function notifyStaffPaid(orderId: number, source: string): Promise<number> {
  return staffCard(orderId, `✅ <b>To'lov qabul qilindi</b> (${esc(source)})`, paymentTopic(orderId));
}

/** Xodimlarga e'lon qilingan to'lov ("To'lov qabul qilindi" kartasi) xato bo'lib chiqdi: belgi bekor qilingani ham shu xodimlarga boradi */
export async function notifyStaffPaymentReverted(orderId: number, source: string): Promise<number> {
  return staffCard(orderId, `↩️ <b>To'lov belgisi bekor qilindi</b> (${esc(source)})`, paymentTopic(orderId));
}

/** Yangi ariza (ulgurji so'rov, aloqa formasi va h.k.): "leads" ruxsati bor xodimlarga */
export async function notifyStaffLead(lines: (string | null | undefined)[]): Promise<number> {
  return toStaff('leads', lines.filter(Boolean).map((l) => esc(String(l))).join('\n'));
}

/** Kunlik eslatma (cron): muddati o'tgan hisob-fakturalar va 24 soatdan beri "Yangi" turgan buyurtmalar */
export async function sendDailyDigest(now = new Date()): Promise<{ finance: number; orders: number }> {
  const out = { finance: 0, orders: 0 };
  try {
    const overdue = await prisma.corporateInvoice.findMany({
      where: overdueInvoiceWhere(now),
      orderBy: { dueDate: 'asc' },
      take: 15,
      select: { id: true, invoiceNo: true, totalAmount: true, paidAmount: true, dueDate: true, order: { select: { customerName: true } } },
    });
    if (overdue.length) {
      const count = await prisma.corporateInvoice.count({ where: overdueInvoiceWhere(now) });
      const lines = overdue.map((i) => `• <b>${esc(i.invoiceNo)}</b> · ${formatPrice(Number(i.totalAmount) - Number(i.paidAmount), "so'm")} · muddat ${formatDate(i.dueDate, 'uz')} · ${esc(clip(i.order.customerName ?? '', 40))}`);
      out.finance = await toStaff('finance', [`⏰ <b>Muddati o'tgan hisob-fakturalar: ${count} ta</b>`, ...lines, count > overdue.length ? `… yana ${count - overdue.length} ta` : null, `${siteUrl()}/admin/invoices`].filter(Boolean).join('\n'));
    }
    const staleWhere = { status: 'new_' as const, deletedAt: null, createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } };
    const stale = await prisma.order.findMany({
      where: staleWhere,
      orderBy: { id: 'asc' },
      take: 15,
      select: { id: true, totalAmount: true, createdAt: true, customerName: true },
    });
    if (stale.length) {
      // Sarlavhada ro'yxat uzunligi emas, haqiqiy son: 15 tadan ko'p bo'lsa qolgani "… yana N ta" bilan aytiladi
      const count = await prisma.order.count({ where: staleWhere });
      const lines = stale.map((o) => `• <b>#${o.id}</b> · ${formatDate(o.createdAt, 'uz')} · ${formatPrice(o.totalAmount, "so'm")} · ${esc(clip(o.customerName ?? '', 40))}`);
      out.orders = await toStaff('orders', [`⏳ <b>24 soatdan beri qabul qilinmagan buyurtmalar: ${count} ta</b>`, ...lines, count > stale.length ? `… yana ${count - stale.length} ta` : null, `${siteUrl()}/admin/orders`].filter(Boolean).join('\n'));
    }
  } catch (e) {
    console.error('[orderNotify] kunlik eslatma', e);
  }
  return out;
}
