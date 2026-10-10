import 'server-only';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { isManualPayment, ORDER_FLOW, orderStatusNames, paymentMethodNames, paymentNames } from '@/lib/orderStatus';
import { siteUrl } from '@/lib/site';
import { clip, esc, type InlineKeyboard } from './api';

/**
 * Boshqaruv botidagi buyurtma kartasi va tugmalari. Yangi buyurtma xabarnomasi ham, botdagi ro'yxat/qidiruv ham
 * aynan shu kartani ishlatadi, shuning uchun tugma callback'lari bitta joyda:
 *   os_<id>_<status>  holatni o'zgartirish (ORDER_FLOW bo'yicha)
 *   oc_<id>           bekor qilishni so'rash;  ocy_<id> tasdiqlash;  or_<id> kartani yangilash (bekor qilmaslik ham shu)
 *   op_<id>           naqd / bank o'tkazmasi to'lovini "to'langan" deb belgilashni so'rash;  opy_<id> tasdiqlash
 */

export const STAFF_ORDER_INCLUDE = {
  items: { include: { product: { select: { name: true } } } },
  corporateInvoices: { where: { status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' }, take: 1, select: { invoiceNo: true } },
} satisfies Prisma.OrderInclude;
export type StaffOrder = Prisma.OrderGetPayload<{ include: typeof STAFF_ORDER_INCLUDE }>;

export const staffOrder = (id: number): Promise<StaffOrder | null> =>
  prisma.order.findFirst({ where: { id, deletedAt: null }, include: STAFF_ORDER_INCLUDE });

const STATUS_ICON: Record<OrderStatus, string> = { draft: '📝', new_: '🆕', processing: '⚙️', shipping: '🚚', delivered: '✅', cancelled: '❌' };
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { processing: '✅ Qabul qilish', shipping: "🚚 Jo'natildi", delivered: '📦 Yetkazildi' };
const sum = (v: unknown) => formatPrice(v as number, "so'm");
/** Qochirilgandan KEYINGI uzunlik bo'yicha kesish: `&` -> `&amp;` matnni 5 baravargacha uzaytiradi; belgi (&amp; yoki emoji) o'rtasidan kesilmaydi */
const escCut = (s: string, max: number): string => {
  let out = '';
  for (const ch of s) {
    const e = esc(ch);
    if (out.length + e.length > max) return `${out}…`;
    out += e;
  }
  return out;
};

/** Ro'yxat uchun bir satr: "#12 · 09.10 · Yangi · 1 250 000 so'm · Ali" */
export function staffOrderLine(o: Pick<StaffOrder, 'id' | 'status' | 'totalAmount' | 'createdAt' | 'customerName'>): string {
  return `${STATUS_ICON[o.status]} <b>#${o.id}</b> · ${formatDate(o.createdAt, 'uz')} · ${sum(o.totalAmount)} · ${esc(clip(o.customerName ?? '', 40))}`;
}

export function staffOrderHtml(o: StaffOrder, note?: string): string {
  // Nomlar qisqartiriladi: xabar 4000 belgidan oshsa sendMessage uni kesadi, kesilgan HTML teg esa butun xabarni yo'qqa chiqaradi.
  // Mijoz yozgan har bir maydonga qochirilgan uzunlik bo'yicha ham chegara bor (escCut): faqat & < > dan iborat ism, manzil va izoh
  // bilan ham karta bekor qilish so'rovi (cancelAskHtml) bilan birga 4000 ga sig'adi. Oddiy matn bu chegaralarga yetmaydi.
  const items = o.items.slice(0, 15).map((it) => `• ${escCut(clip(it.product.name, 80), 120)} × ${it.quantity}`);
  if (o.items.length > 15) items.push(`… yana ${o.items.length - 15} ta`);
  const invoice = o.corporateInvoices[0];
  return [
    note ? `${note}\n` : null,
    `${STATUS_ICON[o.status]} <b>Buyurtma #${o.id}</b> · ${orderStatusNames[o.status]}`,
    `🗓 ${formatDate(o.createdAt, 'uz', true)}`,
    `👤 ${escCut(o.customerName ?? '—', 300)}`,
    o.contactPhone ? `📞 ${esc(displayPhone(o.contactPhone))}` : null,
    o.companyInn ? `🏢 STIR: ${esc(o.companyInn)}` : null,
    '',
    ...items,
    '',
    `💰 <b>${sum(o.totalAmount)}</b> · ${paymentMethodNames[o.paymentMethod ?? ''] ?? '—'} · ${paymentNames[o.paymentStatus]}`,
    invoice ? `🧾 ${esc(invoice.invoiceNo)}` : null,
    o.deliveryMethod === 'pickup' ? '🏬 Olib ketish' : o.shippingAddress ? `📍 ${escCut(o.shippingAddress, 600)}` : null,
    o.comment ? `💬 ${escCut(clip(o.comment, 300), 400)}` : null,
  ].filter((l) => l !== null).join('\n');
}

/**
 * "To'landi" qachon mumkin: qo'lda belgilanadigan usul, hali to'lanmagan (qaytarilgan ham emas), buyurtma bekor qilinmagan.
 * Tugma shu shart bilan chiqadi; bot bosilganda ham shuni qayta tekshiradi — eski xabardagi tugma chatda qolib ketadi.
 */
export const canMarkPaid = (o: Pick<StaffOrder, 'status' | 'paymentStatus' | 'paymentMethod'>): boolean =>
  isManualPayment(o.paymentMethod) && o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && o.status !== 'cancelled';

/** `canEdit` — xodimda "orders" bo'limi ruxsati bormi (bo'lmasa faqat havola va yangilash) */
export function staffOrderKeyboard(o: Pick<StaffOrder, 'id' | 'status' | 'paymentStatus' | 'paymentMethod'>, canEdit: boolean): InlineKeyboard {
  const rows: InlineKeyboard = [];
  if (canEdit) {
    const next = ORDER_FLOW[o.status].filter((s) => s !== 'cancelled');
    if (next.length) rows.push(next.map((s) => ({ text: NEXT_LABEL[s] ?? orderStatusNames[s], callback_data: `os_${o.id}_${s}` })));
    const second: InlineKeyboard[number] = [];
    if (canMarkPaid(o)) second.push({ text: "💵 To'landi", callback_data: `op_${o.id}` });
    if (ORDER_FLOW[o.status].includes('cancelled')) second.push({ text: '❌ Bekor qilish', callback_data: `oc_${o.id}` });
    if (second.length) rows.push(second);
  }
  rows.push([{ text: '🔄 Yangilash', callback_data: `or_${o.id}` }, { text: '🌐 Admin panel', url: `${siteUrl()}/admin/orders/${o.id}` }]);
  return rows;
}

export const cancelConfirmKeyboard = (id: number): InlineKeyboard => [[{ text: 'Ha, bekor qilinsin', callback_data: `ocy_${id}` }, { text: "Yo'q", callback_data: `or_${id}` }]];
/** To'lovni tasdiqlash: bir bosishda xato qo'yilmasin — hisob-faktura ham shu bilan yopiladi va botdan ortga qaytarilmaydi */
export const payConfirmKeyboard = (id: number): InlineKeyboard => [[{ text: "Ha, to'landi", callback_data: `opy_${id}` }, { text: "Yo'q", callback_data: `or_${id}` }]];
