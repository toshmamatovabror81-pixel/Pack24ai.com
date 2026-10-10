import 'server-only';
import { Prisma, type RecyclePoint, type Supervisor } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { createAccessRequest } from '@/lib/recycling/access';
import { acceptAtBase, recordPayment, recordWeighing } from '@/lib/recycling/collections';
import { driverTasks } from '@/lib/recycling/driverTasks';
import { logEvent } from '@/lib/recycling/events';
import { addExpense, addIntake, addPress, addSale, dailySummary, dateKey, dateLabel, JournalError, monthGrid, parseJournalDate, setDailyCash, todayTashkent, type DaySummary } from '@/lib/recycling/journal';
import { collectionHtml, requestCardHtml } from '@/lib/recycling/notifications';
import { assignDriver, REQUEST_INCLUDE, type Actor } from '@/lib/recycling/requests';
import { createDriver, resetDriverTelegram, StaffError, supervisorByTelegram, updateDriver } from '@/lib/recycling/staff';
import { ACTIVE_STATUSES, statusLabels } from '@/lib/recycling/statuses';
import { driverBalance, settleWithdrawal } from '@/lib/recycling/wallet';
import { esc, inline, keyboard, type InlineButton, type InlineKeyboard } from '../api';
import { idFrom, type Ctx } from '../router';
import { setSession } from '../session';
import {
  ask, BACK, cancelReasonStep, clearButtons, codeFrom, codeKnown, complaintHtml, contactKeyboard, driverLine, finishRegistration, ids, isSkip, kg, MONTHS_UZ, parseNum,
  notifiedByFoundation, pendingAccessRequest, phoneFrom, pointInfoHtml, pointRows, regFailText, resolveComplaints, sendLines, SKIP_ROW, sNum, sStr, sum, TODAY_ROW, todayRange, val, wdRows, when, withdrawalHtml, type Sess,
} from './shCommon';

/**
 * Masul boti oqimlari. Masul faqat o'z punkti (pointId) yoki o'ziga yo'naltirilgan arizalar/haydovchilar bilan ishlaydi.
 * Suhbat bosqichlari sessiyada: {step, ...}. Har bosqichda "⬅️ Bosh menyu" (inline `menu` yoki reply tugma) bilan chiqiladi.
 */

export type Sup = Supervisor & { point: RecyclePoint | null };
export const actorOf = (s: Sup): Actor => ({ kind: 'supervisor', id: s.id, name: s.name });

export const MENU = {
  requests: '📋 Arizalar', drivers: '🚛 Haydovchilar', payments: "💵 To'lovlar", journal: '📒 Jurnal',
  point: '🏭 Punkt', withdrawals: '💳 Yechib olish', complaints: '📣 Shikoyatlar', today: '📊 Bugun',
};
export const REG_REQUEST = "📝 Kirish so'rovi yuborish";
export const mainKeyboard = () => keyboard([[MENU.requests, MENU.drivers], [MENU.payments, MENU.journal], [MENU.point, MENU.withdrawals], [MENU.complaints, MENU.today]]);
export const guestKeyboard = () => keyboard([[REG_REQUEST], [BACK]]);

// ─── Doira (scope) ───────────────────────────────────────────────────────────

const reqScope = (s: Sup): Prisma.RecycleRequestWhereInput => (s.pointId ? { OR: [{ pointId: s.pointId }, { supervisorId: s.id }] } : { supervisorId: s.id });
const drvScope = (s: Sup): Prisma.DriverWhereInput => (s.pointId ? { OR: [{ pointId: s.pointId }, { supervisorId: s.id }] } : { supervisorId: s.id });
const REQ_INC = { ...REQUEST_INCLUDE, collections: { orderBy: { id: 'desc' }, take: 1 } } satisfies Prisma.RecycleRequestInclude;
type ReqRow = Prisma.RecycleRequestGetPayload<{ include: typeof REQ_INC }>;
const scopedRequest = (s: Sup, id: number) => prisma.recycleRequest.findFirst({ where: { id, ...reqScope(s) }, include: REQ_INC });
export const ownsRequest = async (s: Sup, id: number) => !!(await prisma.recycleRequest.findFirst({ where: { id, ...reqScope(s) }, select: { id: true } }));
const pointPrice = (s: Sup) => (s.point ? toNumber(s.point.pricePerKg) : 0);
const pairs = (buttons: InlineButton[]): InlineKeyboard => { const rows: InlineKeyboard = []; for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2)); return rows; };

// ─── Bosh menyu / ro'yxatdan o'tish ──────────────────────────────────────────

export async function showMenu(ctx: Ctx, sup: Sup, text?: string): Promise<void> {
  await ctx.clearSession();
  const p = sup.point;
  await ctx.reply(text ?? `👋 <b>${esc(sup.name)}</b>${p ? ` · 🏭 ${esc(p.cityUz)}` : ' · punkt biriktirilmagan'}\nKerakli bo'limni tanlang:`, { reply_markup: mainKeyboard() });
}

export async function showHelp(ctx: Ctx): Promise<void> {
  await ctx.reply([
    '<b>Boshqaruv boti — masul</b>',
    `${MENU.requests} — punkt arizalari: haydovchi tayinlash, bazada qabul, to'lov, bekor`,
    `${MENU.drivers} — haydovchilar ro'yxati, yangi haydovchi (kod bilan)`,
    `${MENU.payments} — tortilgan, to'lov kutayotgan arizalar`,
    `${MENU.journal} — kunlik jurnal: qabul, press, xarajat, sotuv, kassa`,
    `${MENU.point} — narx va qabul holati`,
    `${MENU.withdrawals} — haydovchilarning yechib olish so'rovlari`,
    `${MENU.complaints} — mijoz shikoyatlariga javob`,
    `${MENU.today} — bugungi ko'rsatkichlar`,
    "Rahbariyat huquqingiz ham bo'lsa: /hq — rahbariyat menyusi, /masul — shu menyu",
  ].join('\n'));
}

export async function startRegistration(ctx: Ctx): Promise<void> {
  await ctx.setSession({ step: 'reg_code' });
  await ctx.reply(
    "👋 Salom! Bu <b>Pack24 boshqaruv boti</b> (masullar va rahbariyat uchun).\n\nRo'yxatdan o'tish uchun rahbariyat bergan <b>5 raqamli kodni</b> yuboring.\nKodingiz bo'lmasa — kirish so'rovi yuboring.",
    { reply_markup: guestKeyboard() },
  );
}

/** Ro'yxatdan o'tmagan foydalanuvchi matni (kod / kirish so'rovi bosqichlari) */
const PENDING_TEXT = "⏳ <b>So'rovingiz allaqachon yuborilgan</b> va rahbariyat ko'rib chiqmoqda. Tasdiqlangach shu botda xabar olasiz — keyin /start bosing.";

export async function guestText(ctx: Ctx, s: Sess | null, text: string): Promise<void> {
  if (text === REG_REQUEST) {
    // Takroriy so'rov: kutilayotgani bo'lsa qayta yaratmaymiz
    if (await pendingAccessRequest('supervisor', String(ctx.from.id))) { await ctx.clearSession(); await ctx.reply(PENDING_TEXT, { reply_markup: guestKeyboard() }); return; }
    await ctx.setSession({ step: 'acc_name' });
    await ctx.reply("📝 <b>Kirish so'rovi</b>\nIsmingiz va familiyangizni yozing:", { reply_markup: guestKeyboard() });
    return;
  }
  switch (s?.step) {
    case 'reg_code': {
      const code = codeFrom(text);
      if (!code) { await ctx.reply("❌ Kod 5 ta raqamdan iborat bo'lishi kerak. Qaytadan yuboring:"); return; }
      // Kod mavjudligi telefon so'ralishidan oldin tekshiriladi (foydalanuvchi bekorga raqam ulashmasin)
      if (!(await codeKnown('supervisor', code))) {
        // Rahbariyat kodi: shu botda, lekin HQ roli sessiyasida davom etadi (handlers.ts keyingi kontaktni HQ oqimiga beradi)
        if (await codeKnown('hq', code)) {
          await ctx.clearSession();
          await setSession('hq', ctx.from.id, { step: 'reg_contact', code });
          await ctx.reply('📱 Endi telefon raqamingizni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
          return;
        }
        await ctx.reply(regFailText.code, { reply_markup: guestKeyboard() });
        return;
      }
      await ctx.setSession({ step: 'reg_contact', code });
      await ctx.reply('📱 Endi telefon raqamingizni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
      return;
    }
    case 'reg_contact':
      await ctx.reply('📱 Raqamni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
      return;
    case 'acc_name': {
      const name = text.trim().slice(0, 100);
      if (name.length < 2) { await ctx.reply('❌ Ism kamida 2 ta harf. Qaytadan yozing:'); return; }
      await ctx.setSession({ step: 'acc_contact', name });
      await ctx.reply('📱 Telefon raqamingizni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
      return;
    }
    case 'acc_contact':
      await ctx.reply('📱 Raqamni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
      return;
    case 'acc_point':
      await ctx.reply('🏭 Punktni yuqoridagi tugmalardan tanlang.');
      return;
    default:
      await startRegistration(ctx);
  }
}

/** Kontakt: kod bilan ro'yxatdan o'tish yoki kirish so'rovi uchun telefon */
export async function guestContact(ctx: Ctx, s: Sess | null): Promise<void> {
  if (s?.step === 'reg_contact') {
    const out = await finishRegistration(ctx, 'supervisor', sStr(s.code));
    if (out.ok) {
      const sup = await supervisorByTelegram(ctx.from.id);
      if (sup) { await showMenu(ctx, sup, `✅ <b>Xush kelibsiz, ${esc(sup.name)}!</b>${sup.point ? `\n🏭 Punkt: ${esc(sup.point.cityUz)}` : ''}\nKerakli bo'limni tanlang:`); return; }
    } else {
      // Begona kontakt / kontaktsiz xabar: kod sessiyada qoladi — keyingi to'g'ri kontakt bilan davom etadi
      if (out.reason === 'self' || out.reason === 'nocontact') await ctx.setSession({ step: 'reg_contact', code: sStr(s.code) });
      else if (out.reason === 'code') await ctx.setSession({ step: 'reg_code' });
      else await ctx.clearSession();
      await ctx.reply(regFailText[out.reason], { reply_markup: out.reason === 'code' ? guestKeyboard() : out.reason === 'self' || out.reason === 'nocontact' ? contactKeyboard() : guestKeyboard() });
      return;
    }
  }
  if (s?.step === 'acc_contact') {
    const c = ctx.message?.contact;
    if (!c || c.user_id !== ctx.from.id) { await ctx.reply(regFailText.self, { reply_markup: contactKeyboard() }); return; }
    const ph = phoneFrom(c.phone_number);
    if (!ph) { await ctx.reply("❌ Telefon raqami noto'g'ri formatda.", { reply_markup: contactKeyboard() }); return; }
    const points = await prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });
    await ctx.setSession({ step: 'acc_point', name: sStr(s.name), phone: ph });
    if (!points.length) { await guestPointPick(ctx, { step: 'acc_point', name: sStr(s.name), phone: ph }, null); return; }
    await ctx.reply('🏭 Qaysi punktda ishlaysiz?', { reply_markup: { inline_keyboard: [...pointRows(points, 'accpt_'), [{ text: '🤷 Bilmayman', callback_data: 'accpt_0' }]] } });
    return;
  }
  await startRegistration(ctx);
}

/** accpt_<pointId>: kirish so'rovi yakuni */
export async function guestPointPick(ctx: Ctx, s: Sess | null, pointId: number | null): Promise<void> {
  if (s?.step !== 'acc_point') { await ctx.answer("Avval /start bosing", true); return; }
  const telegramName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  // createAccessRequest mavjud kutilayotgan so'rovni jimgina qaytaradi — foydalanuvchiga buni aniq aytamiz
  if (await pendingAccessRequest('supervisor', String(ctx.from.id), sStr(s.phone))) { await ctx.clearSession(); await ctx.edit(PENDING_TEXT); return; }
  try {
    await createAccessRequest({ role: 'supervisor', name: sStr(s.name), phone: sStr(s.phone), telegramId: String(ctx.from.id), telegramName, requestedPointId: pointId || null });
  } catch (e) {
    if (e instanceof StaffError) { await ctx.clearSession(); await ctx.edit(`❌ ${esc(e.message)}`); return; }
    throw e;
  }
  await ctx.clearSession();
  await ctx.edit("✅ <b>So'rov yuborildi.</b> Rahbariyat tasdiqlagach shu botda xabar olasiz — keyin /start bosing.");
}

// ─── Arizalar ────────────────────────────────────────────────────────────────

function requestRows(r: ReqRow): InlineKeyboard {
  const id = r.id;
  const cid = r.collections[0]?.id;
  const cancel = { text: '❌ Bekor', callback_data: `cancel_${id}` };
  const pay = cid ? { text: "💵 To'lov", callback_data: `pay_${cid}` } : null;
  switch (r.status) {
    case 'new_': case 'dispatched': {
      const assign = { text: '🚛 Tayinlash', callback_data: `assign_${id}` };
      const base = { text: '🏭 Bazada qabul', callback_data: `base_${id}` };
      return [r.pickupType === 'base' ? [base, assign] : [assign, base], [cancel]];
    }
    case 'assigned': return [[{ text: '🔁 Boshqa haydovchi', callback_data: `assign_${id}` }, cancel]];
    case 'en_route': case 'arrived': case 'collecting': return [[cancel]];
    case 'collected': case 'confirmed': return pay ? [[pay]] : [];
    case 'disputed': return [[...(pay ? [pay] : []), { text: '⚖️ Qayta tortish', callback_data: `reweigh_${id}` }]];
    default: return [];
  }
}

const OPEN_STATUSES = [...ACTIVE_STATUSES, 'collected', 'confirmed', 'disputed'] as const;
const PAGE = 15;

/** Faol arizalar — eng yangisi birinchi, 15 tadan sahifalab (reqpg_<n>) */
export async function showRequests(ctx: Ctx, sup: Sup, page = 0): Promise<void> {
  const where: Prisma.RecycleRequestWhereInput = { ...reqScope(sup), status: { in: [...OPEN_STATUSES] } };
  const total = await prisma.recycleRequest.count({ where });
  if (!total) { await ctx.reply("📭 Hozircha faol arizalar yo'q."); return; }
  const pages = Math.ceil(total / PAGE);
  const p = Math.min(Math.max(0, page), pages - 1);
  const list = await prisma.recycleRequest.findMany({ where, include: REQ_INC, orderBy: { createdAt: 'desc' }, skip: p * PAGE, take: PAGE });
  const range = pages > 1 ? ` · ${p * PAGE + 1}–${p * PAGE + list.length} (eng yangisi birinchi)` : '';
  await ctx.reply(`📋 <b>Faol arizalar:</b> ${total} ta${range}`);
  for (const r of list) await ctx.reply(requestCardHtml(r), { reply_markup: inline(requestRows(r)) });
  if (pages > 1) {
    const nav: InlineButton[] = [];
    if (p > 0) nav.push({ text: '⬅️ Oldingi', callback_data: `reqpg_${p - 1}` });
    if (p < pages - 1) nav.push({ text: `➡️ Keyingi ${Math.min(PAGE, total - (p + 1) * PAGE)} ta`, callback_data: `reqpg_${p + 1}` });
    await ctx.reply(`📄 Sahifa ${p + 1}/${pages}`, { reply_markup: inline([nav]) });
  }
}

/** assign_<id>: punkt haydovchilari ro'yxati */
export async function startAssign(ctx: Ctx, sup: Sup, requestId: number | null): Promise<void> {
  const r = requestId ? await scopedRequest(sup, requestId) : null;
  if (!r) { await ctx.answer('Ariza topilmadi yoki sizga tegishli emas', true); return; }
  if (!['new_', 'dispatched', 'assigned'].includes(r.status)) { await ctx.answer(`Bu holatda tayinlab bo'lmaydi (${statusLabels.uz[r.status]})`, true); return; }
  const drivers = await prisma.driver.findMany({ where: { ...drvScope(sup), status: { not: 'inactive' } }, orderBy: [{ isOnline: 'desc' }, { name: 'asc' }], take: 30 });
  if (!drivers.length) { await ask(ctx, `🚛 Faol haydovchi yo'q. "${MENU.drivers}" → "➕ Haydovchi qo'shish".`); return; }
  const rows = drivers.map((d) => [{
    text: `${d.isOnline ? '🟢' : '⚪'} ${d.name}${d.status === 'busy' || d.status === 'on_route' ? ' (band)' : ''}${r.assignedDriverId === d.id ? ' ✔' : ''}`,
    callback_data: `pick_${r.id}_${d.id}`,
  }]);
  await ask(ctx, `🚛 <b>Ariza #${r.id}</b> (${esc(r.name)}) uchun haydovchini tanlang:`, rows);
}

/** pick_<reqId>_<driverId> */
export async function pickDriver(ctx: Ctx, sup: Sup): Promise<void> {
  const [reqId, drvId] = ids(ctx.data, 'pick_');
  const r = reqId && drvId ? await scopedRequest(sup, reqId) : null;
  if (!r) { await ctx.answer('Ariza topilmadi', true); return; }
  // Tugma ikki marta bosilsa (edit kelguncha) haydovchiga topshiriq qayta yuborilmasin
  if (r.assignedDriverId === drvId && r.status === 'assigned') {
    await ctx.answer('Allaqachon tayinlangan');
    await ctx.edit(`✅ Ariza #${r.id}: <b>${esc(r.assignedDriver?.name ?? '')}</b> tayinlangan.`);
    return;
  }
  await clearButtons(ctx);
  const updated = await assignDriver(reqId, drvId, actorOf(sup));
  await ctx.edit(`✅ Ariza #${updated.id}: <b>${esc(updated.assignedDriver?.name ?? '')}</b> tayinlandi. Haydovchiga topshiriq yuborildi.`);
}

/** Bazada qabul faqat hali tortilmagan arizalar uchun (tortilgan bo'lsa — to'lov belgilanadi) */
const BASE_STATUSES = ['new_', 'dispatched', 'assigned', 'en_route'] as const;
function baseBlockedReason(r: ReqRow): string | null {
  if (r.collections.length || ['arrived', 'collecting', 'collected', 'confirmed', 'disputed'].includes(r.status)) return "Ariza allaqachon tortilgan — to'lovni belgilang";
  if (!(BASE_STATUSES as readonly string[]).includes(r.status)) return 'Ariza allaqachon yakunlangan';
  return null;
}

/** base_<id>: mijoz bazaga olib kelgan — og'irlik → narx → acceptAtBase */
export async function startBase(ctx: Ctx, sup: Sup, requestId: number | null): Promise<void> {
  const r = requestId ? await scopedRequest(sup, requestId) : null;
  if (!r) { await ctx.answer('Ariza topilmadi yoki sizga tegishli emas', true); return; }
  const blocked = baseBlockedReason(r);
  if (blocked) { await ctx.answer(blocked, true); return; }
  await ctx.setSession({ step: 'base_weight', requestId: r.id });
  await ask(ctx, `🏭 <b>Ariza #${r.id}</b> — ${esc(r.name)}\nBazada qabul: tortilgan og'irlikni kiriting (kg):`);
}

/** pay_<collectionId>: to'lovni belgilash */
export async function startPay(ctx: Ctx, sup: Sup, collectionId: number | null): Promise<void> {
  const c = collectionId ? await prisma.recycleCollection.findUnique({ where: { id: collectionId }, include: { request: { include: REQUEST_INCLUDE } } }) : null;
  if (!c || (c.request.supervisorId !== sup.id && c.request.pointId !== sup.pointId)) { await ctx.answer('Hisob topilmadi yoki sizga tegishli emas', true); return; }
  const r = c.request;
  if (r.supervisorId !== sup.id) { await ask(ctx, `⚠️ Ariza #${r.id} boshqa masulga (${esc(r.supervisor?.name ?? '—')}) biriktirilgan — to'lovni u belgilaydi.`); return; }
  if (c.paymentStatus !== 'pending' && r.status === 'completed') { await ask(ctx, `ℹ️ Ariza #${r.id} bo'yicha to'lov allaqachon belgilangan: ${esc(c.paidBy ?? '')}, ${when(c.paidAt)}.`); return; }
  const earn = await prisma.driverTransaction.aggregate({ where: { collectionId: c.id, type: 'earning' }, _sum: { amount: true } });
  const total = toNumber(c.totalAmount);
  const earning = toNumber(earn._sum.amount);
  await ctx.setSession({ step: 'pay_cust', collectionId: c.id, requestId: r.id, total, earning });
  await ask(ctx, `${requestCardHtml(r)}\n\n${collectionHtml(c)}\n\n💵 <b>Mijozga qancha to'landi?</b> (so'm)`, [[val(`💰 Jami: ${sum(total)}`, total), val('0', 0)]]);
}

/** reweigh_<id>: bahsli ariza — masul qayta tortadi */
export async function startReweigh(ctx: Ctx, sup: Sup, requestId: number | null): Promise<void> {
  const r = requestId ? await scopedRequest(sup, requestId) : null;
  if (!r) { await ctx.answer('Ariza topilmadi yoki sizga tegishli emas', true); return; }
  if (!['arrived', 'collecting', 'collected', 'disputed'].includes(r.status)) { await ctx.answer("Bu holatda tortish kiritib bo'lmaydi", true); return; }
  if (!r.assignedDriverId) { await ctx.answer('Arizaga haydovchi tayinlanmagan', true); return; }
  await ctx.setSession({ step: 'rw_weight', requestId: r.id });
  await ask(ctx, `⚖️ <b>Ariza #${r.id}</b> — qayta tortish\nHaqiqiy og'irlik (kg)?`);
}

// ─── Haydovchilar ────────────────────────────────────────────────────────────

export async function showDrivers(ctx: Ctx, sup: Sup): Promise<void> {
  const list = await prisma.driver.findMany({ where: drvScope(sup), orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 40 });
  const rows = pairs(list.map((d) => ({ text: `${d.status === 'inactive' ? '⛔' : d.isOnline ? '🟢' : '⚪'} ${d.name}`, callback_data: `drv_${d.id}` })));
  rows.push([{ text: "➕ Haydovchi qo'shish", callback_data: 'drvnew' }]);
  if (!list.length) { await ctx.reply("🚛 Hozircha haydovchilar yo'q.", { reply_markup: inline(rows) }); return; }
  await sendLines(ctx, [`🚛 <b>Haydovchilar:</b> ${list.length} ta (tafsilot — tugmada)`, ...list.map(driverLine)], { rows });
}

const scopedDriver = (sup: Sup, id: number | null) => (id ? prisma.driver.findFirst({ where: { id, ...drvScope(sup) } }) : Promise.resolve(null));

export async function showDriver(ctx: Ctx, sup: Sup, id: number | null): Promise<void> {
  const d = await scopedDriver(sup, id);
  if (!d) { await ctx.answer('Haydovchi topilmadi', true); return; }
  const [tasks, bal] = await Promise.all([driverTasks(d.id), driverBalance(d.id)]);
  const lines = [
    driverLine(d),
    `💰 Balans: <b>${sum(bal.balance)}</b> (daromad ${sum(bal.earned)}, yechilgan ${sum(bal.withdrawn)}, kutilmoqda ${sum(bal.pending)})`,
    `🕒 Oxirgi faollik: ${when(d.lastSeenAt)}`,
    tasks.length ? `📋 Faol topshiriqlar:\n${tasks.map((t) => `• #${t.id} ${statusLabels.uz[t.status]} — ${esc(t.name)}`).join('\n')}` : "📋 Faol topshiriq yo'q",
  ];
  const rows: InlineKeyboard = [[
    { text: '🔄 Telegramni uzish', callback_data: `drvtg_${d.id}` },
    d.status === 'inactive' ? { text: '✅ Faollashtirish', callback_data: `drvact_${d.id}` } : { text: '⛔ Bloklash', callback_data: `drvblock_${d.id}` },
  ]];
  await ctx.reply(lines.join('\n'), { reply_markup: inline(rows) });
}

export async function driverAction(ctx: Ctx, sup: Sup, kind: 'tg' | 'block' | 'act', id: number | null): Promise<void> {
  const d = await scopedDriver(sup, id);
  if (!d) { await ctx.answer('Haydovchi topilmadi', true); return; }
  if (kind === 'tg') {
    const code = await resetDriverTelegram(d.id);
    await logEvent({ sourceBot: 'supervisor', eventType: 'driver_telegram_reset', title: `${d.name}: Telegram uzildi`, message: sup.name, driverId: d.id, supervisorId: sup.id, pointId: d.pointId });
    await ctx.edit(`🔄 <b>${esc(d.name)}</b>: Telegram uzildi.\n🔑 Yangi kod: <code>${code}</code>\nHaydovchi botga /start → kod → raqamini ulashadi.`);
    return;
  }
  if (kind === 'block') {
    const tasks = await driverTasks(d.id);
    await updateDriver(d.id, { status: 'inactive' });
    await logEvent({ sourceBot: 'supervisor', eventType: 'driver_blocked', severity: 'warning', title: `${d.name} bloklandi`, message: sup.name, driverId: d.id, supervisorId: sup.id, pointId: d.pointId });
    await ctx.edit(`⛔ <b>${esc(d.name)}</b> bloklandi.${tasks.length ? `\n⚠️ Faol topshiriqlari bor: ${tasks.map((t) => `#${t.id}`).join(', ')} — boshqa haydovchiga tayinlang.` : ''}`);
    return;
  }
  await updateDriver(d.id, { status: 'active' });
  await logEvent({ sourceBot: 'supervisor', eventType: 'driver_activated', severity: 'success', title: `${d.name} faollashtirildi`, message: sup.name, driverId: d.id, supervisorId: sup.id, pointId: d.pointId });
  await ctx.edit(`✅ <b>${esc(d.name)}</b> faollashtirildi.`);
}

export async function startDriverAdd(ctx: Ctx): Promise<void> {
  await ctx.setSession({ step: 'da_name' });
  await ask(ctx, '➕ <b>Yangi haydovchi</b>\nIsmi va familiyasi?');
}

// ─── To'lovlar ───────────────────────────────────────────────────────────────

export async function showPayments(ctx: Ctx, sup: Sup): Promise<void> {
  const list = await prisma.recycleCollection.findMany({
    where: { paymentStatus: 'pending', request: { ...reqScope(sup), status: { in: ['collected', 'confirmed', 'disputed'] } } },
    include: { request: { include: REQUEST_INCLUDE } }, orderBy: { id: 'asc' }, take: 15,
  });
  if (!list.length) { await ctx.reply("💵 To'lov kutayotgan hisoblar yo'q."); return; }
  await ctx.reply(`💵 <b>To'lov kutmoqda:</b> ${list.length} ta`);
  for (const c of list) await ctx.reply(`${requestCardHtml(c.request)}\n\n${collectionHtml(c)}`, { reply_markup: inline([[{ text: "💵 To'lovni belgilash", callback_data: `pay_${c.id}` }]]) });
}

// ─── Jurnal ──────────────────────────────────────────────────────────────────

const journalRows: InlineKeyboard = [
  [{ text: '➕ Qabul', callback_data: 'jr_intake' }, { text: '➕ Press', callback_data: 'jr_press' }],
  [{ text: '➕ Xarajat', callback_data: 'jr_expense' }, { text: '➕ Sotuv', callback_data: 'jr_sale' }],
  [{ text: '🏦 Kassa ochilish', callback_data: 'jr_cash' }],
  [{ text: '📅 Boshqa kun', callback_data: 'jr_day' }, { text: '📆 Oy', callback_data: 'jr_month' }],
];

function summaryHtml(d: DaySummary, point: string | null): string {
  return [
    `📒 <b>Jurnal</b> — ${dateLabel(d.date)}${point ? ` · 🏭 ${esc(point)}` : ''}`,
    `🏦 Kassa ochilish: ${d.opening == null ? '— (kiritilmagan)' : sum(d.opening)}`,
    `📥 Qabul: ${kg(d.intakeKg)} · ${sum(d.intakeSum)}${d.intakeCount ? ` (${d.intakeCount} ta)` : ''}`,
    `🧱 Press: ${kg(d.pressedKg)} · ${d.bales} toy`,
    `💸 Xarajat: ${sum(d.expense)} · Avans: ${sum(d.advance)}`,
    `📤 Sotuv: ${kg(d.salesKg)} · ${sum(d.salesSum)}${d.salesCount ? ` (${d.salesCount} ta)` : ''}`,
    `🏁 Kassa yakuni: ${d.closing == null ? '—' : `<b>${sum(d.closing)}</b>`}`,
  ].join('\n');
}

export async function showJournal(ctx: Ctx, sup: Sup, date: Date = todayTashkent()): Promise<void> {
  const d = await dailySummary({ supervisorId: sup.id }, date);
  await ctx.reply(summaryHtml(d, sup.point?.cityUz ?? null), { reply_markup: inline(journalRows) });
}

/** jr_<kind>: jurnal amali boshlanishi */
export async function journalAction(ctx: Ctx, sup: Sup, kind: string): Promise<void> {
  if (kind === 'month') { await showMonth(ctx, sup); return; }
  const first: Record<string, string> = { intake: 'ji_date', press: 'jp_date', expense: 'je_date', sale: 'js_date', cash: 'jc_date', day: 'jd_date' };
  const step = first[kind];
  if (!step) { await ctx.answer('Noma\'lum amal', true); return; }
  const titles: Record<string, string> = { intake: '📥 Qabul', press: '🧱 Press', expense: '💸 Xarajat / avans', sale: '📤 Sotuv', cash: '🏦 Kassa ochilish', day: '📅 Kun xulosasi' };
  await ctx.setSession({ step });
  await ask(ctx, `${titles[kind]}\n📅 Sana? (bugun, kecha yoki DD.MM)`, [TODAY_ROW]);
}

export async function showMonth(ctx: Ctx, sup: Sup): Promise<void> {
  const today = todayTashkent();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const days = await monthGrid({ supervisorId: sup.id }, y, m);
  const used = days.filter((d) => d.intakeCount || d.pressedKg || d.bales || d.expense || d.advance || d.salesCount || d.opening != null);
  const title = `📆 <b>${MONTHS_UZ[m - 1]} ${y}</b>`;
  if (!used.length) { await ctx.reply(`${title}: jurnalda yozuv yo'q.`); return; }
  const t = used.reduce((a, d) => ({ ik: a.ik + d.intakeKg, is: a.is + d.intakeSum, pk: a.pk + d.pressedKg, b: a.b + d.bales, e: a.e + d.expense + d.advance, sk: a.sk + d.salesKg, ss: a.ss + d.salesSum }), { ik: 0, is: 0, pk: 0, b: 0, e: 0, sk: 0, ss: 0 });
  const lines = used.map((d) =>
    `<b>${String(d.date.getUTCDate()).padStart(2, '0')}</b> · 📥 ${kg(d.intakeKg)} / ${sum(d.intakeSum)} · 🧱 ${kg(d.pressedKg)} / ${d.bales} toy · 💸 ${sum(d.expense + d.advance)} · 📤 ${kg(d.salesKg)} / ${sum(d.salesSum)}${d.closing != null ? ` · 🏁 ${sum(d.closing)}` : ''}`,
  );
  await sendLines(ctx, [`${title} — ${used.length} kun yozuvi`, ...lines, `<b>Jami:</b> 📥 ${kg(t.ik)} / ${sum(t.is)} · 🧱 ${kg(t.pk)} / ${t.b} toy · 💸 ${sum(t.e)} · 📤 ${kg(t.sk)} / ${sum(t.ss)}`], { sep: '\n' });
}

// ─── Punkt ───────────────────────────────────────────────────────────────────

export async function showPoint(ctx: Ctx, sup: Sup, edit = false): Promise<void> {
  const p = sup.pointId ? await prisma.recyclePoint.findUnique({ where: { id: sup.pointId } }) : null;
  if (!p) { await ctx.reply("🏭 Sizga punkt biriktirilmagan. Rahbariyat bilan bog'laning."); return; }
  const [drivers, online] = await Promise.all([
    prisma.driver.count({ where: { ...drvScope(sup), status: { not: 'inactive' } } }),
    prisma.driver.count({ where: { ...drvScope(sup), status: { not: 'inactive' }, isOnline: true } }),
  ]);
  const html = pointInfoHtml(p, [`🚛 Haydovchilar: ${drivers} (onlayn ${online})`]);
  const rows: InlineKeyboard = [[
    { text: p.isAccepting ? "🔴 To'xtatish" : '🟢 Qabul qilamiz', callback_data: 'pt_toggle' },
    { text: "💰 Narxni o'zgartirish", callback_data: 'pt_price' },
  ]];
  if (edit) await ctx.edit(html, rows);
  else await ctx.reply(html, { reply_markup: inline(rows) });
}

export async function togglePoint(ctx: Ctx, sup: Sup): Promise<void> {
  const p = sup.pointId ? await prisma.recyclePoint.findUnique({ where: { id: sup.pointId } }) : null;
  if (!p) { await ctx.answer('Punkt biriktirilmagan', true); return; }
  const on = !p.isAccepting;
  await prisma.recyclePoint.update({ where: { id: p.id }, data: { isAccepting: on } });
  await logEvent({ sourceBot: 'supervisor', eventType: on ? 'point_accepting_on' : 'point_accepting_off', severity: on ? 'success' : 'warning', title: `${p.cityUz}: qabul ${on ? 'ochildi' : "to'xtatildi"}`, message: sup.name, pointId: p.id, supervisorId: sup.id });
  await ctx.answer(on ? '🟢 Qabul ochildi' : "🔴 Qabul to'xtatildi");
  await showPoint(ctx, sup, true);
}

export async function startPointPrice(ctx: Ctx, sup: Sup): Promise<void> {
  if (!sup.point) { await ctx.answer('Punkt biriktirilmagan', true); return; }
  await ctx.setSession({ step: 'pt_price' });
  await ask(ctx, `💰 Hozirgi narx: <b>${sum(sup.point.pricePerKg)}/kg</b>\nYangi narxni yozing (so'm/kg):`);
}

// ─── Yechib olish ────────────────────────────────────────────────────────────

/** Punkt haydovchilarining so'rovlari (o'z haydovchilari + punktdagi boshqa masul haydovchilari) */
export async function showWithdrawals(ctx: Ctx, sup: Sup): Promise<void> {
  const list = await prisma.driverTransaction.findMany({ where: { type: 'withdrawal', status: 'pending', driver: drvScope(sup) }, include: { driver: { include: { supervisor: true } } }, orderBy: { id: 'asc' }, take: 20 });
  if (!list.length) { await ctx.reply("💳 Kutilayotgan yechib olish so'rovlari yo'q."); return; }
  await ctx.reply(`💳 <b>Yechib olish so'rovlari:</b> ${list.length} ta`);
  for (const t of list) {
    const other = t.driver.supervisorId !== sup.id ? `\n🧑‍💼 Masuli: ${t.driver.supervisor ? esc(t.driver.supervisor.name) : "yo'q"}` : '';
    await ctx.reply(withdrawalHtml(t) + other, { reply_markup: inline(wdRows(t.id)) });
  }
}

export async function settle(ctx: Ctx, sup: Sup, ok: boolean, id: number | null): Promise<void> {
  const tx = id ? await prisma.driverTransaction.findFirst({ where: { id, type: 'withdrawal', driver: drvScope(sup) }, include: { driver: true } }) : null;
  if (!tx) { await ctx.answer("So'rov topilmadi yoki sizning punktingizda emas", true); return; }
  const own = tx.driver.supervisorId === sup.id;
  // settleWithdrawal supervisorId berilsa faqat o'z haydovchisini qabul qiladi; punktdagi boshqa masul haydovchisi uchun supervisorId'siz yopiladi
  const t = await settleWithdrawal(tx.id, ok ? 'completed' : 'failed', own ? { name: sup.name, supervisorId: sup.id } : { name: sup.name });
  if (!own) {
    await logEvent({ sourceBot: 'supervisor', eventType: ok ? 'withdrawal_paid' : 'withdrawal_rejected', severity: 'info', title: `Yechib olish: punkt masuli ${ok ? "to'ladi" : 'rad etdi'}`, message: `${tx.driver.name} (${sum(t.amount)}) · ${sup.name} — haydovchi boshqa masulga biriktirilgan`, driverId: tx.driverId, supervisorId: sup.id, pointId: sup.pointId });
  }
  await ctx.edit(`${ok ? "✅ To'landi" : '❌ Rad etildi'}: <b>${sum(t.amount)}</b> · ${esc(tx.driver.name)} · ${when(new Date())}`);
}

// ─── Shikoyatlar ─────────────────────────────────────────────────────────────

/** Masul darajasidagi shikoyatlar — javob tugmasi bilan; direktorga ko'tarilganlar faqat ma'lumot uchun */
export async function showComplaints(ctx: Ctx, sup: Sup): Promise<void> {
  const list = await prisma.recycleComplaint.findMany({ where: { status: { in: ['open', 'in_progress'] }, request: reqScope(sup) }, orderBy: [{ level: 'asc' }, { id: 'asc' }], take: 15 });
  if (!list.length) { await ctx.reply("📣 Ochiq shikoyatlar yo'q."); return; }
  const mine = list.filter((c) => c.level === 'supervisor').length;
  await ctx.reply(`📣 <b>Ochiq shikoyatlar:</b> ${list.length} ta${mine < list.length ? ` (${list.length - mine} tasi direktor darajasida — HQ javob beradi)` : ''}`);
  for (const c of list) {
    if (c.level === 'director') { await ctx.reply(`${complaintHtml(c)}\n⬆️ <i>Direktor darajasiga ko'tarilgan — HQ ko'rib chiqmoqda.</i>`); continue; }
    await ctx.reply(complaintHtml(c), { reply_markup: inline([[{ text: '✍️ Javob berish', callback_data: `complaint_${c.requestId}` }]]) });
  }
}

export async function startComplaintReply(ctx: Ctx, sup: Sup, requestId: number | null): Promise<void> {
  if (!requestId || !(await ownsRequest(sup, requestId))) { await ctx.answer('Ariza topilmadi yoki sizga tegishli emas', true); return; }
  const open = await prisma.recycleComplaint.findMany({ where: { requestId, status: { in: ['open', 'in_progress'] } }, select: { level: true } });
  if (!open.length) { await ask(ctx, `ℹ️ Ariza #${requestId} bo'yicha ochiq shikoyat yo'q.`); return; }
  if (!open.some((c) => c.level === 'supervisor')) { await ask(ctx, `⬆️ Ariza #${requestId} shikoyati <b>direktor darajasiga</b> ko'tarilgan — unga HQ javob beradi.`); return; }
  await ctx.setSession({ step: 'cmp_reply', requestId });
  await ask(ctx, `✍️ <b>Ariza #${requestId}</b> shikoyatiga javob yozing (mijozga yuboriladi):`);
}

// ─── Bugun ───────────────────────────────────────────────────────────────────

export async function showToday(ctx: Ctx, sup: Sup): Promise<void> {
  const { from, to, day } = todayRange();
  const scope = reqScope(sup);
  const range = { gte: from, lt: to };
  const [created, queued, inProgress, completed, cancelled, weighed, online, total, pendingPay] = await Promise.all([
    prisma.recycleRequest.count({ where: { ...scope, createdAt: range } }),
    prisma.recycleRequest.count({ where: { ...scope, status: { in: ['new_', 'dispatched'] } } }),
    prisma.recycleRequest.count({ where: { ...scope, status: { in: ['assigned', 'en_route', 'arrived', 'collecting', 'collected', 'confirmed', 'disputed'] } } }),
    prisma.recycleRequest.count({ where: { ...scope, status: 'completed', completedAt: range } }),
    prisma.recycleRequest.count({ where: { ...scope, status: 'cancelled', cancelledAt: range } }),
    prisma.recycleCollection.aggregate({ where: { collectedAt: range, request: scope }, _sum: { actualWeight: true, totalAmount: true }, _count: true }),
    prisma.driver.count({ where: { ...drvScope(sup), status: { not: 'inactive' }, isOnline: true } }),
    prisma.driver.count({ where: { ...drvScope(sup), status: { not: 'inactive' } } }),
    prisma.recycleCollection.count({ where: { paymentStatus: 'pending', request: { ...scope, status: { in: ['collected', 'confirmed', 'disputed'] } } } }),
  ]);
  await ctx.reply([
    `📊 <b>Bugun</b> — ${dateLabel(day)}${sup.point ? ` · 🏭 ${esc(sup.point.cityUz)}` : ''}`,
    `🆕 Yangi arizalar: <b>${created}</b> (navbatda: ${queued})`,
    `⚙️ Jarayonda: <b>${inProgress}</b>`,
    `🏁 Yakunlangan: <b>${completed}</b> · ❌ Bekor: ${cancelled}`,
    `⚖️ Tortildi: <b>${kg(weighed._sum.actualWeight ?? 0)}</b> · ${sum(weighed._sum.totalAmount)} (${weighed._count} ta)`,
    `💵 To'lov kutmoqda: ${pendingPay} ta`,
    `🚛 Onlayn haydovchilar: <b>${online}</b> / ${total}`,
  ].join('\n'));
}

// ─── Suhbat bosqichlari ──────────────────────────────────────────────────────

const sessDate = (s: Sess) => new Date(`${sStr(s.date)}T00:00:00Z`);

/** Sana bosqichi: matn → sana, keyingi bosqichga o'tadi */
async function dateStep(ctx: Ctx, s: Sess, text: string, next: string, prompt: string, rows: InlineKeyboard = []): Promise<void> {
  const d = parseJournalDate(text);
  if (!d) { await ask(ctx, '❌ Sana tushunarsiz. Namuna: bugun, kecha, 05.10 yoki 05.10.2026', [TODAY_ROW]); return; }
  await ctx.setSession({ ...s, step: next, date: dateKey(d) });
  await ask(ctx, `📅 ${dateLabel(d)}\n${prompt}`, rows);
}

/** Musbat son bosqichi (0 ruxsat etilsa allowZero) */
async function numStep(ctx: Ctx, s: Sess, text: string, field: string, next: string, prompt: string, opts: { rows?: InlineKeyboard; allowZero?: boolean; max?: number } = {}): Promise<boolean> {
  const v = parseNum(text);
  if (v == null || (!opts.allowZero && v <= 0) || (opts.max != null && v > opts.max)) {
    await ask(ctx, `❌ Raqam kiriting${opts.allowZero ? ' (0 bo\'lishi mumkin)' : ' (0 dan katta)'}${opts.max != null ? `, ko'pi bilan ${opts.max}` : ''}:`);
    return false;
  }
  await ctx.setSession({ ...s, step: next, [field]: v });
  await ask(ctx, prompt, opts.rows ?? []);
  return true;
}

const stdPriceRow = (sup: Sup) => (pointPrice(sup) > 0 ? [[val(`✅ Standart: ${sum(pointPrice(sup))}/kg`, pointPrice(sup))]] : []);

export async function handleStep(ctx: Ctx, sup: Sup, s: Sess, rawText: string): Promise<void> {
  const text = rawText.trim();
  const actor = actorOf(sup);
  switch (s.step) {
    // ── bekor qilish sababi
    case 'cancel_reason':
      if (!(await ownsRequest(sup, sNum(s.requestId)))) { await ctx.clearSession(); await ctx.reply('❌ Ariza topilmadi.'); return; }
      await cancelReasonStep(ctx, actor, sNum(s.requestId), text);
      return;

    // ── bazada qabul
    case 'base_weight':
      await numStep(ctx, s, text, 'weight', 'base_price', `💵 Narx (so'm/kg)?`, { rows: stdPriceRow(sup), max: 100_000 });
      return;
    case 'base_price': {
      const price = parseNum(text);
      if (price == null || price <= 0) { await ask(ctx, "❌ Narxni raqam bilan yozing (so'm/kg):", stdPriceRow(sup)); return; }
      // Savol-javob orasida holat o'zgargan bo'lishi mumkin (haydovchi tortib qo'ygan) — qayta tekshiramiz
      const cur = await scopedRequest(sup, sNum(s.requestId));
      const blocked = cur ? baseBlockedReason(cur) : 'Ariza topilmadi';
      if (blocked) { await ctx.clearSession(); await ctx.reply(`❌ ${esc(blocked)}.`, { reply_markup: mainKeyboard() }); return; }
      const r = await acceptAtBase({ requestId: sNum(s.requestId), weightKg: sNum(s.weight), pricePerKg: price, actor, supervisorId: sup.id });
      // Poydevor acceptAtBase jurnal yozuvini aniq vaqt bilan yozadi; jurnal sanasi UTC yarim tun bo'lishi kerak (dailySummary/monthGrid)
      await prisma.recycleManualIntake.updateMany({ where: { supervisorId: sup.id, note: { startsWith: `Ariza #${r.id},` }, date: { not: todayTashkent() } }, data: { date: todayTashkent() } });
      await ctx.clearSession();
      await ctx.reply(`✅ <b>Ariza #${r.id} bazada qabul qilindi.</b>\n${kg(sNum(s.weight))} × ${sum(price)} = <b>${sum(Math.round(sNum(s.weight) * price))}</b>\nJurnalga qabul yozuvi qo'shildi.`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── to'lov
    case 'pay_cust': {
      const v = parseNum(text);
      if (v == null) { await ask(ctx, "❌ Summani raqam bilan yozing (so'm):", [[val(`💰 Jami: ${sum(s.total)}`, sNum(s.total)), val('0', 0)]]); return; }
      await ctx.setSession({ ...s, step: 'pay_drv', toCustomer: v });
      await ask(ctx, `🚛 <b>Haydovchiga qancha to'landi?</b> (so'm)`, [[val(`Daromad bo'yicha: ${sum(s.earning)}`, sNum(s.earning)), val('0', 0)]]);
      return;
    }
    case 'pay_drv': {
      const v = parseNum(text);
      if (v == null) { await ask(ctx, "❌ Summani raqam bilan yozing (so'm):", [[val(`Daromad bo'yicha: ${sum(s.earning)}`, sNum(s.earning)), val('0', 0)]]); return; }
      await ctx.setSession({ ...s, step: 'pay_confirm', toDriver: v });
      await ask(ctx, `Ariza #${sNum(s.requestId)} to'lovi:\n👤 Mijozga: <b>${sum(s.toCustomer)}</b>\n🚛 Haydovchiga: <b>${sum(v)}</b>\n\nTasdiqlaysizmi?`, [[val('✅ Tasdiqlash', 'ha'), val('❌ Bekor', 'yoq')]]);
      return;
    }
    case 'pay_confirm': {
      const t = text.toLowerCase();
      if (['yoq', "yo'q", 'bekor', '-'].includes(t)) { await showMenu(ctx, sup, "↩️ To'lov belgilanmadi."); return; }
      if (!['ha', '+', 'ok', 'tasdiqlayman'].includes(t)) { await ask(ctx, 'Tasdiqlaysizmi?', [[val('✅ Tasdiqlash', 'ha'), val('❌ Bekor', 'yoq')]]); return; }
      const { request, collection } = await recordPayment({ collectionId: sNum(s.collectionId), paymentToCustomer: sNum(s.toCustomer), paymentToDriver: sNum(s.toDriver), actor });
      await ctx.clearSession();
      await ctx.reply(`✅ <b>Ariza #${request.id} yakunlandi.</b>\n👤 Mijozga: ${sum(collection.paymentToCustomer)}\n🚛 Haydovchiga: ${sum(collection.paymentToDriver)}`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── qayta tortish
    case 'rw_weight':
      await numStep(ctx, s, text, 'weight', 'rw_discount', '➖ Chegirma foizi (0–100)?', { rows: [[val('0%', 0), val('5%', 5), val('10%', 10), val('20%', 20)]], max: 100_000 });
      return;
    case 'rw_discount': {
      const d = parseNum(text);
      if (d == null || d > 100) { await ask(ctx, '❌ Chegirma 0 dan 100 gacha foiz:', [[val('0%', 0), val('5%', 5), val('10%', 10), val('20%', 20)]]); return; }
      const { request, collection } = await recordWeighing({ requestId: sNum(s.requestId), actualWeight: sNum(s.weight), discountPercent: d, actor, notes: `Qayta tortildi: ${sup.name}` });
      await ctx.clearSession();
      // onCollected shu chatga hisobni "To'lov" tugmasi bilan yuborgan bo'lsa, qisqa tasdiq kifoya
      const body = notifiedByFoundation(ctx, request) ? '' : `\n${collectionHtml(collection)}`;
      await ctx.reply(`✅ <b>Ariza #${request.id} qayta tortildi.</b>${body}\n${request.customerTgId ? "Mijozga tasdiqlash so'rovi yuborildi." : 'Mijoz botga ulanmagan — natijani telefon orqali kelishing.'}`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── haydovchi qo'shish
    case 'da_name': {
      const name = text.slice(0, 100);
      if (name.length < 2) { await ask(ctx, '❌ Ism kamida 2 ta harf. Qaytadan yozing:'); return; }
      await ctx.setSession({ step: 'da_phone', name });
      await ask(ctx, '📞 Telefon raqami? (namuna: +998 90 123 45 67)');
      return;
    }
    case 'da_phone': {
      const ph = phoneFrom(text);
      if (!ph) { await ask(ctx, "❌ Telefon noto'g'ri. Namuna: +998 90 123 45 67"); return; }
      await ctx.setSession({ ...s, step: 'da_vehicle', phone: ph });
      await ask(ctx, '🚚 Mashinasi (rusumi, davlat raqami)?', [SKIP_ROW]);
      return;
    }
    case 'da_vehicle': {
      const vehicleInfo = isSkip(text) ? null : text.slice(0, 120);
      try {
        const d = await createDriver({ name: sStr(s.name), phone: sStr(s.phone), supervisorId: sup.id, pointId: sup.pointId, vehicleInfo, invitedBySupervisorId: sup.id });
        await logEvent({ sourceBot: 'supervisor', eventType: 'driver_created', severity: 'success', title: `Yangi haydovchi: ${d.name}`, message: `${sup.name} qo'shdi`, driverId: d.id, supervisorId: sup.id, pointId: d.pointId });
        await ctx.clearSession();
        await ctx.reply(`✅ <b>Haydovchi qo'shildi:</b> ${esc(d.name)}\n🔑 Kod: <code>${d.registrationCode}</code>\n\nHaydovchi <b>haydovchi botiga</b> /start bosadi → shu kodni yuboradi → raqamini ulashadi.`, { reply_markup: mainKeyboard() });
      } catch (e) {
        if (!(e instanceof StaffError)) throw e;
        await ctx.clearSession();
        await ctx.reply(`❌ ${esc(e.message)}`, { reply_markup: mainKeyboard() });
      }
      return;
    }

    // ── jurnal: qabul
    case 'ji_date': await dateStep(ctx, s, text, 'ji_kg', "⚖️ Qabul qilingan og'irlik (kg)?"); return;
    case 'ji_kg': await numStep(ctx, s, text, 'kg', 'ji_price', "💵 Narx (so'm/kg)?", { rows: stdPriceRow(sup), max: 1_000_000 }); return;
    case 'ji_price': await numStep(ctx, s, text, 'price', 'ji_note', '📝 Izoh (kimdan, qanday material)?', { rows: [SKIP_ROW], max: 1_000_000 }); return;
    case 'ji_note': {
      const date = sessDate(s);
      await addIntake(sup.id, { date, weightKg: sNum(s.kg), pricePerKg: sNum(s.price), note: isSkip(text) ? null : text });
      await ctx.clearSession();
      await ctx.reply(`✅ Qabul yozildi: ${kg(sNum(s.kg))} × ${sum(s.price)} = <b>${sum(Math.round(sNum(s.kg) * sNum(s.price)))}</b> (${dateLabel(date)})`);
      await showJournal(ctx, sup, date);
      return;
    }
    // ── jurnal: press
    case 'jp_date': await dateStep(ctx, s, text, 'jp_kg', "🧱 Preslangan og'irlik (kg)?"); return;
    case 'jp_kg': await numStep(ctx, s, text, 'kg', 'jp_bales', '📦 Toylar soni?', { max: 1_000_000 }); return;
    case 'jp_bales': await numStep(ctx, s, text, 'bales', 'jp_ops', '👷 Operatorlar (ismlar)?', { rows: [SKIP_ROW], allowZero: true, max: 100_000 }); return;
    case 'jp_ops': {
      const date = sessDate(s);
      await addPress(sup.id, { date, pressedKg: sNum(s.kg), baleCount: sNum(s.bales), operators: isSkip(text) ? null : text });
      await ctx.clearSession();
      await ctx.reply(`✅ Press yozildi: ${kg(sNum(s.kg))}, ${sNum(s.bales)} toy (${dateLabel(date)})`);
      await showJournal(ctx, sup, date);
      return;
    }
    // ── jurnal: xarajat / avans
    case 'je_date': await dateStep(ctx, s, text, 'je_expense', "💸 Xarajat summasi (so'm)? 0 bo'lishi mumkin", [[val('0', 0)]]); return;
    case 'je_expense': await numStep(ctx, s, text, 'expense', 'je_advance', "💳 Avans summasi (so'm)? 0 bo'lishi mumkin", { rows: [[val('0', 0)]], allowZero: true }); return;
    case 'je_advance': await numStep(ctx, s, text, 'advance', 'je_comment', '📝 Izoh (nimaga, kimga)?', { rows: [SKIP_ROW], allowZero: true }); return;
    case 'je_comment': {
      const date = sessDate(s);
      try {
        await addExpense(sup.id, { date, expenseAmount: sNum(s.expense), advanceAmount: sNum(s.advance), comment: isSkip(text) ? null : text });
      } catch (e) {
        if (!(e instanceof JournalError)) throw e;
        await ctx.clearSession();
        await ctx.reply(`❌ ${esc(e.message)}`);
        return;
      }
      await ctx.clearSession();
      await ctx.reply(`✅ Yozildi: xarajat ${sum(s.expense)}, avans ${sum(s.advance)} (${dateLabel(date)})`);
      await showJournal(ctx, sup, date);
      return;
    }
    // ── jurnal: sotuv
    case 'js_date': await dateStep(ctx, s, text, 'js_customer', '🏷 Xaridor (firma yoki ism)?'); return;
    case 'js_customer': {
      const customer = text.slice(0, 150);
      if (customer.length < 2) { await ask(ctx, '❌ Xaridor nomi kamida 2 ta harf:'); return; }
      await ctx.setSession({ ...s, step: 'js_kg', customer });
      await ask(ctx, "⚖️ Sotilgan og'irlik (kg)?");
      return;
    }
    case 'js_kg': await numStep(ctx, s, text, 'kg', 'js_price', "💵 Narx (so'm/kg)?", { max: 10_000_000 }); return;
    case 'js_price': await numStep(ctx, s, text, 'price', 'js_bales', '📦 Toylar soni?', { rows: [SKIP_ROW], max: 100_000_000 }); return;
    case 'js_bales': {
      const bales = isSkip(text) ? 0 : parseNum(text);
      if (bales == null) { await ask(ctx, '❌ Toylar sonini raqam bilan yozing:', [SKIP_ROW]); return; }
      await ctx.setSession({ ...s, step: 'js_vehicle', bales });
      await ask(ctx, '🚚 Mashina turi va davlat raqami?', [SKIP_ROW]);
      return;
    }
    case 'js_vehicle': {
      const date = sessDate(s);
      const [vehicleType, plateNumber] = isSkip(text) ? [null, null] : (() => { const parts = text.split(/\s+/); return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [text, null]; })();
      await addSale(sup.id, { date, customerName: sStr(s.customer), weightKg: sNum(s.kg), pricePerKg: sNum(s.price), baleCount: sNum(s.bales), vehicleType, plateNumber });
      await ctx.clearSession();
      await ctx.reply(`✅ Sotuv yozildi: ${esc(sStr(s.customer))} — ${kg(sNum(s.kg))} × ${sum(s.price)} = <b>${sum(Math.round(sNum(s.kg) * sNum(s.price)))}</b> (${dateLabel(date)})`);
      await showJournal(ctx, sup, date);
      return;
    }
    // ── jurnal: kassa ochilish
    case 'jc_date': await dateStep(ctx, s, text, 'jc_sum', "🏦 Kassa ochilish summasi (so'm)?"); return;
    case 'jc_sum': {
      const v = parseNum(text);
      if (v == null) { await ask(ctx, "❌ Summani raqam bilan yozing (so'm):"); return; }
      const date = sessDate(s);
      await setDailyCash(sup.id, { date, openingBalance: v });
      await ctx.clearSession();
      await ctx.reply(`✅ Kassa ochilishi: <b>${sum(v)}</b> (${dateLabel(date)})`);
      await showJournal(ctx, sup, date);
      return;
    }
    // ── jurnal: boshqa kun
    case 'jd_date': {
      const d = parseJournalDate(text);
      if (!d) { await ask(ctx, '❌ Sana tushunarsiz. Namuna: kecha, 05.10 yoki 05.10.2026', [TODAY_ROW]); return; }
      await ctx.clearSession();
      await showJournal(ctx, sup, d);
      return;
    }

    // ── punkt narxi
    case 'pt_price': {
      const v = parseNum(text);
      if (v == null || v <= 0 || v > 1_000_000) { await ask(ctx, "❌ Narxni raqam bilan yozing (so'm/kg):"); return; }
      const p = sup.pointId ? await prisma.recyclePoint.findUnique({ where: { id: sup.pointId } }) : null;
      if (!p) { await ctx.clearSession(); await ctx.reply('❌ Punkt topilmadi.'); return; }
      const old = toNumber(p.pricePerKg);
      await prisma.recyclePoint.update({ where: { id: p.id }, data: { pricePerKg: v } });
      await logEvent({ sourceBot: 'supervisor', eventType: 'point_price_changed', severity: 'warning', title: `${p.cityUz}: narx ${old} → ${v} so'm/kg`, message: `O'zgartirdi: ${sup.name}`, pointId: p.id, supervisorId: sup.id, notifyHq: true });
      await ctx.clearSession();
      await ctx.reply(`✅ Narx yangilandi: <b>${sum(v)}/kg</b> (avval ${sum(old)}/kg). Rahbariyatga xabar yuborildi.`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── shikoyatga javob
    case 'cmp_reply': {
      const response = text.slice(0, 1000);
      if (response.length < 2) { await ask(ctx, '❌ Javob matnini yozing (kamida 2 ta belgi):'); return; }
      const requestId = sNum(s.requestId);
      if (!(await ownsRequest(sup, requestId))) { await ctx.clearSession(); await ctx.reply('❌ Ariza topilmadi.'); return; }
      const n = await resolveComplaints(requestId, response, { name: sup.name, source: 'supervisor', level: 'supervisor' });
      await ctx.clearSession();
      await ctx.reply(n ? `✅ Javob yuborildi, ${n} ta shikoyat yopildi.` : "ℹ️ Masul darajasida ochiq shikoyat topilmadi (direktorga ko'tarilgan bo'lsa — HQ javob beradi).", { reply_markup: mainKeyboard() });
      return;
    }

    default:
      await showMenu(ctx, sup, '🤔 Bosqich tugagan. Menyudan tanlang:');
  }
}

/** Ro'yxatdan o'tgan masul uchun inline `accpt_` bosilsa (eski xabar) */
export const accptIgnore = (ctx: Ctx) => ctx.answer("Siz allaqachon ro'yxatdan o'tgansiz", true);

export { idFrom };
