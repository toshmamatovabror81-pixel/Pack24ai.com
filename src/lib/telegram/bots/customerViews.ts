import 'server-only';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import type { CustomerDebt, DebtOrder } from '@/lib/customerAccount';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { getDict } from '@/lib/i18n';
import { pickText } from '@/lib/i18n/config';
import { overdueCutoff } from '@/lib/invoiceStatus';
import { orderStageLines, type StageWorkOrder } from '@/lib/orderStage';
import { statusKey } from '@/lib/orderStatus';
import type { SiteSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { esc, keyboard, type InlineKeyboard, type ReplyKeyboard } from '../api';
import type { BotLang } from '../customers';
import { customerTexts } from './customerTexts';

/**
 * Mijoz boti ko'rinishlari: tayyor ma'lumotdan HTML matn va tugmalar. Bu yerda baza ham, ctx ham yo'q —
 * shuning uchun testda qo'lda yasalgan obyektlar bilan tekshiriladi. Tashqaridan kelgan har bir matn
 * (mahsulot, kompaniya, hisob-faktura raqami, rekvizitlar ...) esc() dan o'tadi; ro'yxatlar qisqartiriladi,
 * chunki sendMessage 4000 belgidan keyin kesadi va kesilgan HTML teg butun xabarni yo'qqa chiqaradi.
 */

/** callback_data kelishuvi (bots/customer.ts shu prefikslarni ushlaydi; `o_<id>` ni xabarnomalardagi "Batafsil" ham yuboradi) */
export const CB = { order: 'o_', list: 'ol_', lang: 'lang_', notify: 'ntf_', requisites: 'req', phone: 'phone', stop: 'stop_' } as const;

type Money = Parameters<typeof formatPrice>[0];

export type OrderLineData = { id: number; status: OrderStatus; paymentStatus: PaymentStatus; totalAmount: Money; createdAt: Date };
export type OrderListData = { items: OrderLineData[]; total: number; page: number; pages: number };
/** `OrderDetail` (customerAccount.getOrder) shu turga mos keladi; testda oddiy sonlar bilan yasash mumkin */
export type OrderCardData = OrderLineData & {
  paymentMethod: string | null;
  accessToken: string | null;
  subtotal: Money;
  discountAmount: Money;
  deliveryFee: Money;
  items: { quantity: number; product: { name: string; nameI18n: unknown } }[];
  workOrders: StageWorkOrder[];
  corporateInvoices: { invoiceNo: string; dueDate: Date; totalAmount: Money; paidAmount: Money }[];
  events: { toValue: string; createdAt: Date }[];
};
export type SettingsData = { notify: boolean; phone: string | null };
type RequisitesData = Pick<SiteSettings, 'companyName' | 'legalName' | 'inn' | 'bankDetails' | 'directorName' | 'address' | 'phone'>;
type ContactsData = Pick<SiteSettings, 'phone' | 'phone2' | 'email' | 'address' | 'workHours' | 'telegramChannel'>;

const ITEMS_MAX = 12;
const PRODUCTION_MAX = 8;
const HISTORY_MAX = 6;
const DEBT_LINES_MAX = 10;
const CONTRACTS_MAX = 5;
const INVOICE_BUTTONS_MAX = 5;

const STATUS_ICON: Record<OrderStatus, string> = { draft: '📝', new_: '🆕', processing: '⚙️', shipping: '🚚', delivered: '✅', cancelled: '❌' };

const money = (v: Money, lang: BotLang) => formatPrice(v, customerTexts[lang].currency);
/** Belgilar bo'yicha qisqartirish (emoji o'rtasidan kesilmaydi) */
const cut = (s: string, max: number) => { const chars = [...s]; return chars.length > max ? `${chars.slice(0, max).join('')}…` : s; };
/** Ro'yxatning birinchi `max` satri va "… yana N ta" */
const capped = (lines: string[], max: number, lang: BotLang) => (lines.length > max ? [...lines.slice(0, max), customerTexts[lang].more(lines.length - max)] : lines);
const orderLink = (lang: BotLang, token: string) => `${siteUrl()}/${lang}/orders/${encodeURIComponent(token)}`;

/** 998901234567 -> "+998 ** *** ** 67": chatni ko'rgan begona raqamni to'liq bilib olmasin */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.length === 12 ? `+${d.slice(0, 3)} ** *** ** ${d.slice(10)}` : `** ${d.slice(-2)}`;
}

// ─── Klaviaturalar ───────────────────────────────────────────────────────────

/** Asosiy menyu: doimiy reply-klaviatura */
export function mainKeyboard(lang: BotLang): ReplyKeyboard {
  const m = customerTexts[lang].menu;
  return keyboard([[m.orders, m.balance], [m.requisites, m.contacts], [m.settings]], { is_persistent: true });
}

/** Telefonni ulash: raqam faqat shu tugma (Telegram kontakti) orqali qabul qilinadi */
export function contactKeyboard(lang: BotLang): ReplyKeyboard {
  const p = customerTexts[lang].phone;
  return keyboard([[{ text: p.share, request_contact: true }], [p.later]]);
}

export function langKeyboard(current?: BotLang): InlineKeyboard {
  return [(['uz', 'ru'] as const).map((l) => ({ text: `${current === l ? '✓ ' : ''}${customerTexts[l].lang.button}`, callback_data: `${CB.lang}${l}` }))];
}

export const sharePhoneKeyboard = (lang: BotLang): InlineKeyboard => [[{ text: customerTexts[lang].phone.share, callback_data: CB.phone }]];

export const stopConfirmKeyboard = (lang: BotLang): InlineKeyboard => [[
  { text: customerTexts[lang].stop.yes, callback_data: `${CB.stop}yes` },
  { text: customerTexts[lang].stop.no, callback_data: `${CB.stop}no` },
]];

// ─── Salomlashuv, telefon, yordam ────────────────────────────────────────────

export const helloHtml = (lang: BotLang, name: string, company: string) => customerTexts[lang].start.hello(esc(cut(name, 40)), esc(company));

export const helpHtml = (lang: BotLang, companyPhone: string, ai = false) => customerTexts[lang].help(companyPhone ? esc(displayPhone(companyPhone)) : '', ai);

export const phoneLinkedHtml = (lang: BotLang, phone: string, orders: number) => customerTexts[lang].phone.linked(esc(displayPhone(phone)), orders);

export const phoneUnsupportedHtml = (lang: BotLang, companyPhone: string) => customerTexts[lang].phone.unsupported(companyPhone ? esc(displayPhone(companyPhone)) : '');

// ─── Buyurtmalar ro'yxati ────────────────────────────────────────────────────

/** "#12 · 09.10.2026 · Yangi · 1 250 000 so'm · To'lanmagan" */
export function orderLine(o: OrderLineData, lang: BotLang): string {
  const d = getDict(lang).order;
  return `<b>#${o.id}</b> · ${formatDate(o.createdAt, lang)} · ${esc(d.statuses[statusKey(o.status)])} · ${money(o.totalAmount, lang)} · ${esc(d.paymentStatuses[o.paymentStatus])}`;
}

/** `phoneLinked=false` — faqat havola orqali ulangan buyurtmalar ko'rinayotgan mijozga telefonni ulash eslatiladi */
export function ordersListHtml(list: OrderListData, lang: BotLang, phoneLinked = true): string {
  const t = customerTexts[lang].orders;
  return [
    `${t.title} · ${t.total(list.total)}`,
    list.pages > 1 ? t.page(list.page + 1, list.pages) : null,
    '',
    ...list.items.map((o) => orderLine(o, lang)),
    '',
    t.hint,
    phoneLinked ? null : t.linkHint,
  ].filter((l) => l !== null).join('\n');
}

/** Har buyurtmaga tugma (qatorda 3 tadan) va bir necha sahifa bo'lsa varaqlash qatori */
export function ordersListKeyboard(list: OrderListData): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < list.items.length; i += 3) rows.push(list.items.slice(i, i + 3).map((o) => ({ text: `#${o.id}`, callback_data: `${CB.order}${o.id}` })));
  if (list.pages > 1) {
    const pager: InlineKeyboard[number] = [];
    if (list.page > 0) pager.push({ text: '◀️', callback_data: `${CB.list}${list.page - 1}` });
    pager.push({ text: `${list.page + 1} / ${list.pages}`, callback_data: `${CB.list}${list.page}` });
    if (list.page < list.pages - 1) pager.push({ text: '▶️', callback_data: `${CB.list}${list.page + 1}` });
    rows.push(pager);
  }
  return rows;
}

export const ordersEmptyHtml = (lang: BotLang) => customerTexts[lang].orders.empty(esc(siteUrl()));

// ─── Buyurtma kartasi ────────────────────────────────────────────────────────

/** Tarixdagi holat nomi (OrderEvent.toValue); notanish qiymat mijozga ko'rsatilmaydi */
function eventLabel(value: string, lang: BotLang): string | null {
  const statuses: Record<string, string> = getDict(lang).order.statuses;
  const key = value === 'new_' ? 'new' : value;
  return key !== 'draft' && Object.hasOwn(statuses, key) ? statuses[key] : null;
}

const isPayable = (o: Pick<OrderCardData, 'status' | 'paymentStatus'>) => o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && o.status !== 'cancelled';

export function orderCardHtml(o: OrderCardData, lang: BotLang, now = new Date()): string {
  const t = customerTexts[lang];
  const dict = getDict(lang);
  const stage = orderStageLines(o, o.workOrders, dict.order, lang);
  const out: string[] = [
    `📦 <b>${t.card.title(o.id)}</b>`,
    `🗓 ${t.card.registered(formatDate(o.createdAt, lang, true))}`,
    '',
    `${STATUS_ICON[o.status]} ${esc(dict.order.status)}: <b>${esc(stage.status)}</b>`,
  ];
  if (stage.production.length) out.push(`🏭 ${esc(dict.order.production)}:`, ...capped(stage.production.map((l) => `• ${esc(cut(l, 160))}`), PRODUCTION_MAX, lang));

  // Tarix: faqat holat o'zgarishlari (ro'yxatga olingan vaqt yuqorida turibdi); eng oxirgilari
  const history = o.events.flatMap((e) => { const label = eventLabel(e.toValue, lang); return label ? [`• ${formatDate(e.createdAt, lang, true)} — ${esc(label)}`] : []; });
  if (history.length) out.push('', `🕓 ${t.card.history}:`, ...history.slice(-HISTORY_MAX));

  if (o.items.length) {
    const items = o.items.map((it) => `• ${esc(cut(pickText(it.product.nameI18n, lang, it.product.name), 80))} × ${it.quantity}`);
    out.push('', `🛒 ${esc(dict.order.items)}:`, ...capped(items, ITEMS_MAX, lang));
  }

  const discount = toNumber(o.discountAmount);
  const delivery = toNumber(o.deliveryFee);
  out.push('');
  if (o.subtotal != null && (discount > 0 || delivery > 0)) out.push(`${esc(dict.cart.subtotal)}: ${money(o.subtotal, lang)}`);
  if (discount > 0) out.push(`${esc(dict.cart.discount)}: −${money(discount, lang)}`);
  if (delivery > 0) out.push(`${esc(dict.cart.delivery)}: ${money(delivery, lang)}`);
  out.push(`💰 ${esc(dict.cart.total)}: <b>${money(o.totalAmount, lang)}</b>`);
  const method = o.paymentMethod ? (t.payMethod as Record<string, string>)[o.paymentMethod] : undefined;
  out.push(`💳 ${esc(dict.order.payment)}: ${method ? `${method} · ` : ''}${esc(dict.order.paymentStatuses[o.paymentStatus])}`);

  const invoice = o.corporateInvoices[0];
  if (invoice) {
    out.push('', `🧾 ${esc(dict.order.invoice)} <b>${esc(invoice.invoiceNo)}</b>`);
    // "Balans" bilan bir xil qoida (invoiceStatus.OWED_ORDER), hisob-faktura hali yopilmagan bo'lsa ham: to'langan buyurtmada
    // qoldiq yo'q; bekor qilingan yoki puli qaytarilgan buyurtmada to'lov muddati ham, qoldiq ham ko'rsatilmaydi
    if (o.status !== 'cancelled' && o.paymentStatus !== 'refunded') {
      const remaining = o.paymentStatus === 'paid' ? 0 : Math.max(0, Math.round((toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount)) * 100) / 100);
      out.push(
        `${t.card.due(formatDate(invoice.dueDate, lang))}${remaining > 0 && invoice.dueDate < overdueCutoff(now) ? ` ${t.balance.overdue}` : ''}`,
        remaining > 0 ? t.card.remaining(money(remaining, lang)) : t.card.invoicePaid,
      );
    }
  }
  return out.join('\n');
}

/** `payUrl` — onlayn to'lov havolasi (orders.paymentUrl natijasi); to'langan yoki bekor qilingan buyurtmada ko'rsatilmaydi */
export function orderCardKeyboard(o: Pick<OrderCardData, 'id' | 'status' | 'paymentStatus' | 'accessToken' | 'corporateInvoices'>, lang: BotLang, payUrl: string | null): InlineKeyboard {
  const t = customerTexts[lang].card;
  const rows: InlineKeyboard = [];
  if (o.accessToken) {
    const url = orderLink(lang, o.accessToken);
    rows.push([{ text: t.open, url }, ...(o.corporateInvoices.length ? [{ text: t.invoice, url: `${url}/invoice` }] : [])]);
  }
  if (payUrl && isPayable(o)) rows.push([{ text: t.pay, url: payUrl }]);
  rows.push([{ text: t.refresh, callback_data: `${CB.order}${o.id}` }, { text: t.back, callback_data: `${CB.list}0` }]);
  return rows;
}

// ─── Balans (qarzdorlik) ─────────────────────────────────────────────────────

function debtMethod(o: Pick<DebtOrder, 'paymentMethod' | 'deliveryMethod'>, lang: BotLang): string {
  const m = customerTexts[lang].balance.method;
  // Olib ketiladigan buyurtmada naqd pul yetkazishda emas, olib ketishda to'lanadi
  if (o.paymentMethod === 'cash') return o.deliveryMethod === 'pickup' ? m.cashPickup : m.cash;
  if (o.paymentMethod === 'bank_transfer') return m.bank_transfer;
  return o.paymentMethod === 'payme' || o.paymentMethod === 'click' ? m.online : m.other;
}

/** "Balans" — oldindan to'lov hisobi emas, to'lanishi kerak bo'lgan summa (xabar oxirida shu izoh turadi) */
export function balanceHtml(d: CustomerDebt, lang: BotLang): string {
  const t = customerTexts[lang].balance;
  const out: string[] = [t.title, '', d.total > 0 ? t.total(money(d.total, lang)) : t.noDebt];

  if (d.invoices.length) {
    const lines = d.invoices.map((i) => `• <b>${esc(i.invoiceNo)}</b> · ${t.order(i.orderId)} · ${t.remaining(money(i.remaining, lang))} · ${t.due(formatDate(i.dueDate, lang))}${i.overdue ? ` ${t.overdue}` : ''}`);
    out.push('', `🧾 <b>${t.invoices}</b> — ${money(d.invoiceTotal, lang)}`, ...capped(lines, DEBT_LINES_MAX, lang));
    if (d.overdueTotal > 0) out.push(t.overdueTotal(money(d.overdueTotal, lang)));
  }

  if (d.unpaidOrders.length) {
    const lines = d.unpaidOrders.map((o) => `• <b>#${o.id}</b> · ${formatDate(o.createdAt, lang)} · ${money(o.total, lang)} · ${debtMethod(o, lang)}`);
    out.push('', `📦 <b>${t.unpaidOrders}</b> — ${money(d.unpaidOrdersTotal, lang)}`, ...capped(lines, DEBT_LINES_MAX, lang));
  }

  for (const c of d.contracts.slice(0, CONTRACTS_MAX)) {
    out.push('', `📄 <b>${t.contract(esc(c.contractNo))}</b> · ${esc(cut(c.companyName, 80))}`);
    if (c.creditLimit > 0) out.push(t.limit(money(c.creditLimit, lang)), t.used(money(c.used, lang)), t.available(money(c.available ?? 0, lang)));
    else out.push(t.noLimit, ...(c.used > 0 ? [t.used(money(c.used, lang))] : []));
    out.push(t.term(c.paymentTermDays));
  }
  if (d.contracts.length > CONTRACTS_MAX) out.push('', customerTexts[lang].more(d.contracts.length - CONTRACTS_MAX));

  out.push('', `<i>${t.note}</i>`);
  return out.join('\n');
}

/** Hisob-faktura sahifalari (ko'pi bilan 5 ta) va rekvizitlar */
export function balanceKeyboard(d: CustomerDebt, lang: BotLang): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (const i of d.invoices) {
    if (rows.length >= INVOICE_BUTTONS_MAX) break;
    if (i.accessToken) rows.push([{ text: `🧾 ${cut(i.invoiceNo, 40)}`, url: `${orderLink(lang, i.accessToken)}/invoice` }]);
  }
  rows.push([{ text: customerTexts[lang].menu.requisites, callback_data: CB.requisites }]);
  return rows;
}

// ─── Rekvizitlar va aloqa ────────────────────────────────────────────────────

export function requisitesHtml(s: RequisitesData, lang: BotLang): string {
  const t = customerTexts[lang].requisites;
  const phone = s.phone ? esc(displayPhone(s.phone)) : '';
  const bank = s.bankDetails.trim();
  const head = [t.title, '', `<b>${esc(s.legalName.trim() || s.companyName)}</b>`, s.inn ? `${t.inn}: <code>${esc(s.inn)}</code>` : null];
  // Bank rekvizitlari kiritilmagan: yarim ma'lumot bilan to'lov qilinmasin — menejer yuboradi
  if (!bank) return [...head, '', t.onRequest(phone)].filter((l) => l !== null).join('\n');
  const address = pickText(s.address, lang);
  return [
    ...head,
    esc(cut(bank, 1500)),
    s.directorName ? `${t.director}: ${esc(s.directorName)}` : null,
    address ? `${t.address}: ${esc(address)}` : null,
    phone ? `${t.phone}: ${phone}` : null,
    '',
    t.purpose,
  ].filter((l) => l !== null).join('\n');
}

export function contactsHtml(s: ContactsData, lang: BotLang): string {
  const t = customerTexts[lang].contacts;
  const address = pickText(s.address, lang);
  const hours = pickText(s.workHours, lang);
  const channel = s.telegramChannel.trim().replace(/^(https?:\/\/t\.me\/|@)/, '');
  return [
    t.title,
    '',
    s.phone ? `📞 ${esc(displayPhone(s.phone))}` : null,
    s.phone2 ? `📞 ${esc(displayPhone(s.phone2))}` : null,
    s.email ? `✉️ ${esc(s.email)}` : null,
    address ? `📍 ${esc(address)}` : null,
    hours ? `🕒 ${t.hours}: ${esc(hours)}` : null,
    `🌐 ${t.site}: ${esc(siteUrl())}`,
    channel ? `📣 ${t.channel}: https://t.me/${esc(channel)}` : null,
  ].filter((l) => l !== null).join('\n');
}

// ─── Sozlamalar ──────────────────────────────────────────────────────────────

export function settingsHtml(c: SettingsData, lang: BotLang): string {
  const t = customerTexts[lang];
  return [
    t.settings.title,
    '',
    `🌐 ${t.settings.lang(t.lang.name)}`,
    c.notify ? `🔔 ${t.settings.notifyOn}` : `🔕 ${t.settings.notifyOff}`,
    `📱 ${c.phone ? t.settings.phone(maskPhone(c.phone)) : t.settings.noPhone}`,
  ].join('\n');
}

export function settingsKeyboard(c: SettingsData, lang: BotLang): InlineKeyboard {
  const t = customerTexts[lang];
  return [
    ...langKeyboard(lang),
    [c.notify ? { text: t.settings.turnOff, callback_data: `${CB.notify}off` } : { text: t.settings.turnOn, callback_data: `${CB.notify}on` }],
    [{ text: c.phone ? t.settings.changePhone : t.phone.share, callback_data: CB.phone }],
    [{ text: t.settings.stop, callback_data: `${CB.stop}ask` }],
  ];
}
