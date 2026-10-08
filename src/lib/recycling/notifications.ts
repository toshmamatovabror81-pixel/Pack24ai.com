import 'server-only';
import type { Driver, RecycleCollection, RecyclePoint, RecycleRequest, Supervisor } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import { esc, type InlineKeyboard } from '@/lib/telegram/api';
import { notifyCustomer, notifyDriver, notifyHqAdmins, notifyOpsChat, notifySupervisor } from '@/lib/telegram/notify';
import { googleMapsUrl } from './geo';
import { materialLabels, pickupTypeLabels, statusLabels } from './statuses';

/**
 * Bildirishnomalar markazi: ariza hayot siklidagi har bir qadamda kimga, qaysi bot orqali, qanday matn.
 * Hammasi "jim" ishlaydi — token yo'q yoki foydalanuvchi botni bloklagan bo'lsa jarayon to'xtamaydi.
 */

export type RequestWithRefs = RecycleRequest & { point?: RecyclePoint | null; supervisor?: Supervisor | null; assignedDriver?: Driver | null };

export const trackingUrl = (token: string | null | undefined, lang: Locale = 'uz') => (token ? `${siteUrl()}/${lang}/recycling/${token}` : null);

const sum = (v: unknown) => formatPrice(v as number, "so'm");

/** Ariza kartasi (HTML) — masul/haydovchi/HQ ko'radigan to'liq ko'rinish */
export function requestCardHtml(r: RequestWithRefs, opts: { forCustomer?: boolean; locale?: Locale } = {}): string {
  const l: Locale = opts.locale ?? 'uz';
  const lines: string[] = [`📦 <b>Ariza #${r.id}</b> · ${esc(statusLabels[l][r.status])}`];
  if (!opts.forCustomer) lines.push(`👤 ${esc(r.name)} · <a href="tel:+${esc(r.phone)}">${esc(displayPhone(r.phone))}</a>`);
  if (r.material) lines.push(`♻️ ${esc(materialLabels[l][r.material])}${r.volume ? ` · ~${r.volume} kg` : ''}`);
  else if (r.volume) lines.push(`⚖️ ~${r.volume} kg`);
  lines.push(`🚚 ${esc(pickupTypeLabels[l][r.pickupType])}`);
  if (r.pickupType === 'pickup') {
    if (r.address) lines.push(`📍 ${esc(r.address)}`);
    if (r.pickupLat != null && r.pickupLng != null) lines.push(`🗺 <a href="${googleMapsUrl(r.pickupLat, r.pickupLng)}">Xaritada ochish</a>`);
  } else if (r.point) {
    lines.push(`🏭 ${esc(r.point.cityUz)}${r.point.address ? `, ${esc(r.point.address)}` : ''} · ${esc(r.point.workingHours)}`);
  }
  if (!opts.forCustomer && r.supervisor) lines.push(`🧑‍💼 Masul: ${esc(r.supervisor.name)}`);
  if (r.assignedDriver) lines.push(`🚛 Haydovchi: ${esc(r.assignedDriver.name)}${!opts.forCustomer ? ` · ${esc(displayPhone(r.assignedDriver.phone))}` : ''}`);
  lines.push(`🕒 ${formatDate(r.createdAt, l, true)}`);
  return lines.join('\n');
}

export function collectionHtml(c: RecycleCollection): string {
  const lines = [
    `⚖️ Haqiqiy og'irlik: <b>${c.actualWeight} kg</b>`,
  ];
  if (c.discountPercent > 0) lines.push(`➖ Chegirma: ${c.discountPercent}%${c.discountReason ? ` (${esc(c.discountReason)})` : ''} → ${c.effectiveWeight} kg`);
  lines.push(`💵 Narx: ${sum(c.pricePerKg)}/kg`, `💰 Jami: <b>${sum(c.totalAmount)}</b>`);
  return lines.join('\n');
}

// ─── Hayot sikli ─────────────────────────────────────────────────────────────

export async function onRequestCreated(r: RequestWithRefs): Promise<void> {
  const card = requestCardHtml(r);
  if (r.supervisor?.telegramId) {
    await notifySupervisor(r.supervisor.telegramId, `🆕 <b>Yangi ariza</b>\n${card}`, [[{ text: '🚛 Haydovchi tayinlash', callback_data: `assign_${r.id}` }, { text: '❌ Bekor', callback_data: `cancel_${r.id}` }]]);
  } else {
    await notifyHqAdmins(`🆕 <b>Yangi ariza (masul yo'q)</b>\n${card}\n\n⚠️ Punktga faol masul biriktirilmagan — admin paneldan yo'naltiring.`);
  }
  await notifyOpsChat([`♻️ Yangi makulatura arizasi #${r.id}`, `${r.name}, ${displayPhone(r.phone)}`, r.volume ? `~${r.volume} kg` : null, r.pickupType === 'pickup' ? `Olib ketish: ${r.address ?? ''}` : 'Bazaga olib keladi']);
  if (r.customerTgId) {
    const url = trackingUrl(r.accessToken, r.customerLang);
    await notifyCustomer(r.customerTgId, `✅ <b>Arizangiz qabul qilindi</b>\n${requestCardHtml(r, { forCustomer: true, locale: r.customerLang })}\n\nTez orada operator bog'lanadi.`, url ? [[{ text: '🔎 Arizani kuzatish', url }]] : undefined);
  }
}

export async function onDispatched(r: RequestWithRefs, note?: string): Promise<void> {
  if (!r.supervisor?.telegramId) return;
  await notifySupervisor(r.supervisor.telegramId, `📬 <b>Sizga ariza yo'naltirildi</b>${note ? `\n${esc(note)}` : ''}\n${requestCardHtml(r)}`, [[{ text: '🚛 Haydovchi tayinlash', callback_data: `assign_${r.id}` }]]);
}

export async function onAssigned(r: RequestWithRefs, previousDriver?: Driver | null): Promise<void> {
  const d = r.assignedDriver;
  if (d?.telegramId) {
    await notifyDriver(d.telegramId, `🆕 <b>Yangi topshiriq</b>\n${requestCardHtml(r)}`, [[{ text: '✅ Qabul qilaman', callback_data: `accept_${r.id}` }, { text: '❌ Rad etaman', callback_data: `reject_${r.id}` }]]);
  }
  if (previousDriver?.telegramId && previousDriver.id !== d?.id) {
    await notifyDriver(previousDriver.telegramId, `ℹ️ Ariza #${r.id} boshqa haydovchiga o'tkazildi.`);
  }
  if (r.customerTgId && d) {
    await notifyCustomer(r.customerTgId, `🚛 Ariza #${r.id}: haydovchi tayinlandi — <b>${esc(d.name)}</b>${d.vehicleInfo ? ` (${esc(d.vehicleInfo)})` : ''}.`);
  }
}

export async function onDriverAccepted(r: RequestWithRefs): Promise<void> {
  if (r.supervisor?.telegramId && r.assignedDriver) await notifySupervisor(r.supervisor.telegramId, `✅ Ariza #${r.id}: haydovchi <b>${esc(r.assignedDriver.name)}</b> qabul qildi.`);
}

export async function onDriverRejected(r: RequestWithRefs, driver: Driver, reason?: string): Promise<void> {
  const text = `❌ Ariza #${r.id}: haydovchi <b>${esc(driver.name)}</b> rad etdi${reason ? ` — ${esc(reason)}` : ''}. Boshqa haydovchi tayinlang.`;
  if (r.supervisor?.telegramId) await notifySupervisor(r.supervisor.telegramId, text, [[{ text: '🚛 Haydovchi tayinlash', callback_data: `assign_${r.id}` }]]);
  else await notifyHqAdmins(text);
}

export async function onDriverProgress(r: RequestWithRefs): Promise<void> {
  if (!r.customerTgId) return;
  const l = r.customerLang;
  const msg =
    r.status === 'en_route' ? { uz: "🚛 Haydovchi yo'lga chiqdi.", ru: '🚛 Водитель выехал.', en: '🚛 The driver is on the way.' }[l]
      : r.status === 'arrived' ? { uz: '📍 Haydovchi yetib keldi.', ru: '📍 Водитель прибыл.', en: '📍 The driver has arrived.' }[l]
        : null;
  if (msg) await notifyCustomer(r.customerTgId, `Ariza #${r.id}: ${msg}`);
}

export async function onCollected(r: RequestWithRefs, c: RecycleCollection): Promise<void> {
  const body = collectionHtml(c);
  if (r.customerTgId) {
    const url = trackingUrl(r.accessToken, r.customerLang);
    await notifyCustomer(r.customerTgId, `⚖️ <b>Ariza #${r.id}: tortish natijasi</b>\n${body}\n\nNatijani tasdiqlaysizmi?`, [
      [{ text: '✅ Tasdiqlayman', callback_data: `cust_ok_${r.id}` }, { text: '❌ Rozi emasman', callback_data: `cust_no_${r.id}` }],
      ...(url ? [[{ text: '🔎 Batafsil', url }]] : []),
    ]);
  }
  if (r.supervisor?.telegramId) {
    await notifySupervisor(r.supervisor.telegramId, `⚖️ <b>Ariza #${r.id} tortildi</b> (${esc(r.assignedDriver?.name ?? '')})\n${body}`, [[{ text: "💵 To'lovni belgilash", callback_data: `pay_${c.id}` }]]);
  }
}

export async function onCustomerDecision(r: RequestWithRefs, confirmed: boolean, comment?: string): Promise<void> {
  const text = confirmed
    ? `✅ Ariza #${r.id}: mijoz tortish natijasini <b>tasdiqladi</b>.`
    : `⚠️ Ariza #${r.id}: mijoz natijaga <b>rozi emas</b>${comment ? ` — ${esc(comment)}` : ''}. Qayta tortish yoki hal qilish kerak.`;
  if (r.supervisor?.telegramId) await notifySupervisor(r.supervisor.telegramId, text);
  if (r.assignedDriver?.telegramId) await notifyDriver(r.assignedDriver.telegramId, text);
  if (!confirmed) await notifyHqAdmins(text);
}

export async function onCompleted(r: RequestWithRefs, c?: RecycleCollection | null): Promise<void> {
  if (r.customerTgId) {
    const l = r.customerLang;
    const thanks = { uz: '🎉 Arizangiz yakunlandi. Tabiatni asraganingiz uchun rahmat!', ru: '🎉 Заявка завершена. Спасибо, что заботитесь о природе!', en: '🎉 Your request is complete. Thank you for caring about nature!' }[l];
    await notifyCustomer(r.customerTgId, `Ariza #${r.id}: ${thanks}${c ? `\n${collectionHtml(c)}` : ''}`);
  }
  if (r.assignedDriver?.telegramId) await notifyDriver(r.assignedDriver.telegramId, `✅ Ariza #${r.id} yakunlandi. Rahmat!`);
}

export async function onCancelled(r: RequestWithRefs, reason?: string): Promise<void> {
  const why = reason ? ` Sabab: ${esc(reason)}` : '';
  if (r.customerTgId) await notifyCustomer(r.customerTgId, `❌ Ariza #${r.id} bekor qilindi.${why}`);
  if (r.assignedDriver?.telegramId) await notifyDriver(r.assignedDriver.telegramId, `❌ Ariza #${r.id} bekor qilindi.${why}`);
  if (r.supervisor?.telegramId) await notifySupervisor(r.supervisor.telegramId, `❌ Ariza #${r.id} bekor qilindi.${why}`);
}

export async function onPaymentRecorded(r: RequestWithRefs, c: RecycleCollection): Promise<void> {
  if (r.assignedDriver?.telegramId && c.paymentToDriver != null) {
    await notifyDriver(r.assignedDriver.telegramId, `💵 Ariza #${r.id}: punkt sizga <b>${sum(c.paymentToDriver)}</b> to'ladi.`);
  }
}

/** Ariza bo'yicha shikoyat — masulga va (director darajasida) HQ adminlarga */
export async function onComplaint(r: RequestWithRefs, level: 'supervisor' | 'director', message: string): Promise<void> {
  const text = `📣 <b>Shikoyat (ariza #${r.id})</b>\n${esc(message)}\n\n${requestCardHtml(r)}`;
  const kb: InlineKeyboard = [[{ text: '✍️ Javob berish', callback_data: `complaint_${r.id}` }]];
  if (r.supervisor?.telegramId) await notifySupervisor(r.supervisor.telegramId, text, kb);
  if (level === 'director' || !r.supervisor?.telegramId) await notifyHqAdmins(text);
}
