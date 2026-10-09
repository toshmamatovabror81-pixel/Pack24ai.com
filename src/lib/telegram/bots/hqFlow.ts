import 'server-only';
import type { BotAccessRequest, Driver, RecyclePoint, Supervisor, TelegramHqAdmin } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { approveAccessRequest, pendingAccessRequests, rejectAccessRequest } from '@/lib/recycling/access';
import { driverTasks } from '@/lib/recycling/driverTasks';
import { logEvent } from '@/lib/recycling/events';
import { financeOverview } from '@/lib/recycling/finance';
import { dateLabel } from '@/lib/recycling/journal';
import { requestCardHtml } from '@/lib/recycling/notifications';
import { dispatchToSupervisor, getRequest, type Actor } from '@/lib/recycling/requests';
import { createDriver, createSupervisor, hqAdminByTelegram, resetDriverTelegram, resetSupervisorTelegram, StaffError, updateDriver, updateSupervisor } from '@/lib/recycling/staff';
import { ACTIVE_STATUSES, statusLabels } from '@/lib/recycling/statuses';
import { addBonus, driverBalance, settleWithdrawal } from '@/lib/recycling/wallet';
import { esc, inline, keyboard, removeKeyboard, type InlineButton, type InlineKeyboard } from '../api';
import { hqAllowedIds } from '../bots';
import { idFrom, type Ctx } from '../router';
import {
  ask, cancelReasonStep, codeFrom, codeKnown, complaintHtml, contactKeyboard, driverLine, eventLine, finishRegistration, ids, isSkip, kg, parseNum, phone, phoneFrom,
  pointInfoHtml, pointRows, regFailText, resolveComplaints, sendLines, SKIP_ROW, sNum, sStr, sum, todayRange, wdRows, when, withdrawalHtml, yes, type Sess,
} from './shCommon';

/**
 * HQ admin boti oqimlari: barcha punktlar bo'yicha nazorat — masul/haydovchi yaratish, arizalarni masulga yo'naltirish,
 * kirish so'rovlari, yechib olish, hodisalar, shikoyatlar. Ruxsat: TelegramHqAdmin (faol) yoki HQ_ALLOWED_TELEGRAM_IDS.
 */

export type Hq = { admin: TelegramHqAdmin | null; name: string };
export const actorOf = (h: Hq): Actor => ({ kind: 'admin', id: h.admin?.id ?? 0, name: h.name });

export async function resolveHq(ctx: Ctx): Promise<Hq | null> {
  const admin = await hqAdminByTelegram(ctx.from.id);
  if (admin) return { admin, name: admin.name };
  if (hqAllowedIds().includes(String(ctx.from.id))) return { admin: null, name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'HQ' };
  return null;
}

export const MENU = {
  today: '📊 Bugun', requests: '📋 Arizalar', supervisors: '👥 Masullar', drivers: '🚛 Haydovchilar', points: '🏭 Punktlar',
  access: "📝 Kirish so'rovlari", withdrawals: '💳 Yechib olish', events: '🔔 Hodisalar', complaints: '📣 Shikoyatlar',
};
export const mainKeyboard = () => keyboard([[MENU.today, MENU.requests], [MENU.supervisors, MENU.drivers], [MENU.points, MENU.access], [MENU.withdrawals, MENU.events], [MENU.complaints]]);

const OPEN_STATUSES = [...ACTIVE_STATUSES, 'collected', 'confirmed', 'disputed'] as const;
const pairs = (buttons: InlineButton[]): InlineKeyboard => { const rows: InlineKeyboard = []; for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2)); return rows; };
const activePoints = () => prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });

// ─── Menyu / ruxsat ──────────────────────────────────────────────────────────

export async function showMenu(ctx: Ctx, hq: Hq, text?: string): Promise<void> {
  await ctx.clearSession();
  if (hq.admin) await prisma.telegramHqAdmin.update({ where: { id: hq.admin.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  await ctx.reply(text ?? `🏢 <b>Pack24 HQ</b> · ${esc(hq.name)}\nKerakli bo'limni tanlang:`, { reply_markup: mainKeyboard() });
}

export async function showHelp(ctx: Ctx): Promise<void> {
  await ctx.reply([
    '<b>HQ admin boti</b>',
    `${MENU.today} — barcha punktlar bo'yicha bugungi ko'rsatkichlar`,
    `${MENU.requests} — masulsiz yoki 24 soat qimirlamagan arizalar: masulga yo'naltirish`,
    `${MENU.supervisors} / ${MENU.drivers} — ro'yxat, qo'shish (kod), Telegramni uzish, bloklash, bonus`,
    `${MENU.points} — narx, haydovchi stavkasi, qabul holati`,
    `${MENU.access} — botdan kelgan kirish so'rovlarini tasdiqlash`,
    `${MENU.withdrawals} — yechib olish so'rovlari`,
    `${MENU.events} (/events) — yangi hodisalar`,
    `${MENU.complaints} — shikoyatlarga javob, direktorga ko'tarish`,
  ].join('\n'));
}

const DENY = "⛔ Bu bot faqat <b>Pack24 rahbariyati</b> uchun.\nKodingiz bo'lsa — 5 raqamli kodni yuboring.";

export async function guestStart(ctx: Ctx): Promise<void> {
  await ctx.setSession({ step: 'reg_code' });
  await ctx.reply(DENY, { reply_markup: removeKeyboard });
}

/** Ruxsatsiz foydalanuvchi: faqat kod bilan ro'yxatdan o'tish bosqichlari */
export async function guestText(ctx: Ctx, s: Sess | null, text: string): Promise<void> {
  if (s?.step === 'reg_code') {
    const code = codeFrom(text);
    if (!code) { await ctx.reply(DENY); return; }
    // Kod mavjudligi telefon so'ralishidan oldin tekshiriladi
    if (!(await codeKnown('hq', code))) { await ctx.reply(regFailText.code); return; }
    await ctx.setSession({ step: 'reg_contact', code });
    await ctx.reply('📱 Telefon raqamingizni tugma orqali ulashing:', { reply_markup: contactKeyboard() });
    return;
  }
  if (s?.step === 'reg_contact') { await ctx.reply('📱 Raqamni tugma orqali ulashing:', { reply_markup: contactKeyboard() }); return; }
  await guestStart(ctx);
}

export async function guestContact(ctx: Ctx, s: Sess | null): Promise<void> {
  if (s?.step !== 'reg_contact') { await guestStart(ctx); return; }
  const out = await finishRegistration(ctx, 'hq', sStr(s.code));
  if (out.ok) {
    const hq = await resolveHq(ctx);
    if (hq) { await showMenu(ctx, hq, `✅ <b>Xush kelibsiz, ${esc(hq.name)}!</b>\nKerakli bo'limni tanlang:`); return; }
  } else {
    // Begona kontakt: kod sessiyada qoladi — keyingi to'g'ri kontakt bilan davom etadi
    const again = out.reason === 'self' || out.reason === 'nocontact';
    await ctx.setSession(again ? { step: 'reg_contact', code: sStr(s.code) } : { step: 'reg_code' });
    await ctx.reply(regFailText[out.reason], { reply_markup: again ? contactKeyboard() : removeKeyboard });
  }
}

// ─── Bugun ───────────────────────────────────────────────────────────────────

export async function showToday(ctx: Ctx): Promise<void> {
  const { from, to, day } = todayRange();
  const range = { gte: from, lt: to };
  const [created, active, completed, noSup, online, drivers, weighed, fin, access, events, complaints, wd] = await Promise.all([
    prisma.recycleRequest.count({ where: { createdAt: range } }),
    prisma.recycleRequest.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
    prisma.recycleRequest.count({ where: { status: 'completed', completedAt: range } }),
    prisma.recycleRequest.count({ where: { status: 'new_' } }),
    prisma.driver.count({ where: { status: { not: 'inactive' }, isOnline: true } }),
    prisma.driver.count({ where: { status: { not: 'inactive' } } }),
    prisma.recycleCollection.aggregate({ where: { collectedAt: range }, _sum: { actualWeight: true, totalAmount: true }, _count: true }),
    financeOverview({ from, to }),
    prisma.botAccessRequest.count({ where: { status: 'pending' } }),
    prisma.botEvent.count({ where: { status: 'new_' } }),
    prisma.recycleComplaint.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.driverTransaction.count({ where: { type: 'withdrawal', status: 'pending' } }),
  ]);
  const byPoint = fin.byPoint.filter((p) => p.requests || p.kg).map((p) => `• ${esc(p.name)}: ${p.requests} ariza · ${kg(p.kg)} · ${sum(p.amount)}`);
  await ctx.reply([
    `📊 <b>Bugun</b> — ${dateLabel(day)} · barcha punktlar`,
    `🆕 Yangi arizalar: <b>${created}</b> · ⚙️ Jarayonda: <b>${active}</b> · 🏁 Yakunlangan: <b>${completed}</b>`,
    `⚠️ Masul biriktirilmagan: <b>${noSup}</b>`,
    `⚖️ Tortildi: <b>${kg(weighed._sum.actualWeight ?? 0)}</b> · ${sum(weighed._sum.totalAmount)} (${weighed._count} ta)`,
    `💵 Mijozlarga: ${sum(fin.collections.paidToCustomer)} · Haydovchilarga: ${sum(fin.collections.paidToDriver)}`,
    `📒 Jurnal: qabul ${kg(fin.journal.intakeKg)} / ${sum(fin.journal.intakeSum)} · sotuv ${kg(fin.journal.salesKg)} / ${sum(fin.journal.salesSum)}`,
    `🚛 Onlayn haydovchilar: <b>${online}</b> / ${drivers}`,
    `📝 Kirish so'rovlari: ${access} · 🔔 Yangi hodisalar: ${events} · 📣 Shikoyatlar: ${complaints} · 💳 Yechib olish: ${wd}`,
    ...(byPoint.length ? ['', '🏭 <b>Punktlar bo\'yicha (bugun):</b>', ...byPoint] : []),
  ].join('\n'));
}

// ─── Arizalar: masulsiz yoki qotib qolgan ────────────────────────────────────

export async function showRequests(ctx: Ctx): Promise<void> {
  const stale = new Date(Date.now() - 24 * 3600_000);
  const where = { OR: [{ status: 'new_' as const }, { status: { in: ACTIVE_STATUSES }, updatedAt: { lt: stale } }] };
  const [list, total] = await Promise.all([
    prisma.recycleRequest.findMany({ where, include: { point: true, supervisor: true, assignedDriver: true }, orderBy: { createdAt: 'asc' }, take: 15 }),
    prisma.recycleRequest.count({ where }),
  ]);
  if (!list.length) { await ctx.reply("✅ Masulsiz yoki 24 soatdan beri qimirlamagan arizalar yo'q."); return; }
  await ctx.reply(`📋 <b>E'tibor talab qiladigan arizalar:</b> ${total} ta${total > list.length ? ` (eng eski ${list.length} tasi)` : ''}`);
  for (const r of list) {
    const hours = Math.floor((Date.now() - r.updatedAt.getTime()) / 3600_000);
    const flag = r.status === 'new_' ? '⚠️ Masul biriktirilmagan' : `⏳ ${hours} soatdan beri harakat yo'q`;
    await ctx.reply(`${flag}\n${requestCardHtml(r)}`, { reply_markup: inline([[{ text: '➡️ Masulga', callback_data: `disp_${r.id}` }, { text: '❌ Bekor', callback_data: `cancel_${r.id}` }]]) });
  }
}

/** disp_<id>: masullar ro'yxati (shu punktniki birinchi) */
export async function startDispatch(ctx: Ctx, requestId: number | null): Promise<void> {
  const r = requestId ? await getRequest(requestId) : null;
  if (!r) { await ctx.answer('Ariza topilmadi', true); return; }
  if (r.status === 'completed' || r.status === 'cancelled') { await ctx.answer('Ariza allaqachon yakunlangan', true); return; }
  const sups = await prisma.supervisor.findMany({ where: { isActive: true }, include: { point: true }, orderBy: [{ pointId: 'asc' }, { name: 'asc' }], take: 40 });
  if (!sups.length) { await ask(ctx, `👥 Faol masul yo'q. "${MENU.supervisors}" → "➕ Masul qo'shish".`); return; }
  const sorted = [...sups].sort((a, b) => Number(b.pointId === r.pointId) - Number(a.pointId === r.pointId));
  const rows = sorted.map((s) => [{
    text: `${s.pointId === r.pointId ? '⭐ ' : ''}${s.name} · ${s.point?.cityUz ?? 'punktsiz'}${s.telegramId ? '' : ' (TG ❌)'}${r.supervisorId === s.id ? ' ✔' : ''}`,
    callback_data: `sup_${r.id}_${s.id}`,
  }]);
  await ask(ctx, `➡️ <b>Ariza #${r.id}</b> (${esc(r.name)}, ${esc(r.point?.cityUz ?? '')}) ni qaysi masulga yo'naltiramiz?`, rows);
}

/** sup_<reqId>_<supId> */
export async function pickSupervisor(ctx: Ctx, hq: Hq): Promise<void> {
  const [reqId, supId] = ids(ctx.data, 'sup_');
  if (!reqId || !supId) { await ctx.answer('Xato', true); return; }
  const u = await dispatchToSupervisor(reqId, supId, actorOf(hq));
  await ctx.edit(`✅ Ariza #${u.id} → <b>${esc(u.supervisor?.name ?? '')}</b>${u.supervisor?.telegramId ? ' (botda xabar yuborildi)' : " (masul botga ulanmagan — admin paneldan ko'radi)"}`);
}

// ─── Masullar ────────────────────────────────────────────────────────────────

type SupRow = Supervisor & { point: RecyclePoint | null };
const supLine = (s: SupRow) =>
  `${s.isActive ? '✅' : '⛔'} <b>${esc(s.name)}</b> · ${phone(s.phone)}\n🏭 ${s.point ? esc(s.point.cityUz) : "punkt yo'q"} · Telegram ${yes(s.telegramId)}${s.registrationCode ? ` · kod <code>${s.registrationCode}</code>` : ''}`;

export async function showSupervisors(ctx: Ctx): Promise<void> {
  const list = await prisma.supervisor.findMany({ include: { point: true }, orderBy: [{ isActive: 'desc' }, { pointId: 'asc' }, { name: 'asc' }], take: 40 });
  const rows = pairs(list.map((s) => ({ text: `${s.isActive ? '' : '⛔ '}${s.name}`, callback_data: `supv_${s.id}` })));
  rows.push([{ text: "➕ Masul qo'shish", callback_data: 'supnew' }]);
  if (!list.length) { await ctx.reply("👥 Hozircha masullar yo'q.", { reply_markup: inline(rows) }); return; }
  await sendLines(ctx, [`👥 <b>Masullar:</b> ${list.length} ta (tafsilot — tugmada)`, ...list.map(supLine)], { rows });
}

export async function showSupervisor(ctx: Ctx, id: number | null): Promise<void> {
  const s = id ? await prisma.supervisor.findUnique({ where: { id }, include: { point: true } }) : null;
  if (!s) { await ctx.answer('Masul topilmadi', true); return; }
  const [active, drivers, latest] = await Promise.all([
    prisma.recycleRequest.count({ where: { supervisorId: s.id, status: { in: [...OPEN_STATUSES] } } }),
    prisma.driver.findMany({ where: { supervisorId: s.id, status: { not: 'inactive' } }, select: { name: true, isOnline: true }, take: 20 }),
    prisma.recycleRequest.findMany({ where: { supervisorId: s.id, status: { in: [...OPEN_STATUSES] } }, orderBy: { createdAt: 'asc' }, take: 5, select: { id: true, status: true, name: true } }),
  ]);
  const lines = [
    supLine(s),
    `📋 Faol arizalar: <b>${active}</b>${latest.length ? `\n${latest.map((r) => `• #${r.id} ${statusLabels.uz[r.status]} — ${esc(r.name)}`).join('\n')}${active > latest.length ? '\n• …' : ''}` : ''}`,
    `🚛 Haydovchilar: <b>${drivers.length}</b>${drivers.length ? ` — ${drivers.map((d) => `${d.isOnline ? '🟢' : '⚪'} ${esc(d.name)}`).join(', ')}` : ''}`,
    `🕒 Ro'yxatdan o'tgan: ${when(s.registeredAt)}`,
  ];
  const rows: InlineKeyboard = [[
    { text: '🔄 Telegramni uzish', callback_data: `suptg_${s.id}` },
    s.isActive ? { text: '⛔ Bloklash', callback_data: `supblock_${s.id}` } : { text: '✅ Faollashtirish', callback_data: `supact_${s.id}` },
  ]];
  await ctx.reply(lines.join('\n'), { reply_markup: inline(rows) });
}

export async function supervisorAction(ctx: Ctx, hq: Hq, kind: 'tg' | 'block' | 'act', id: number | null): Promise<void> {
  const s = id ? await prisma.supervisor.findUnique({ where: { id } }) : null;
  if (!s) { await ctx.answer('Masul topilmadi', true); return; }
  if (kind === 'tg') {
    const code = await resetSupervisorTelegram(s.id);
    await logEvent({ sourceBot: 'pack24admin', eventType: 'supervisor_telegram_reset', title: `${s.name}: Telegram uzildi`, message: hq.name, supervisorId: s.id, pointId: s.pointId });
    await ctx.edit(`🔄 <b>${esc(s.name)}</b>: Telegram uzildi.\n🔑 Yangi kod: <code>${code}</code>\nMasul botga /start → kod → raqamini ulashadi.`);
    return;
  }
  await updateSupervisor(s.id, { isActive: kind === 'act' });
  await logEvent({ sourceBot: 'pack24admin', eventType: kind === 'act' ? 'supervisor_activated' : 'supervisor_blocked', severity: kind === 'act' ? 'success' : 'warning', title: `${s.name} ${kind === 'act' ? 'faollashtirildi' : 'bloklandi'}`, message: hq.name, supervisorId: s.id, pointId: s.pointId });
  await ctx.edit(kind === 'act' ? `✅ <b>${esc(s.name)}</b> faollashtirildi.` : `⛔ <b>${esc(s.name)}</b> bloklandi. Uning yangi arizalari HQ ga tushadi.`);
}

export async function startSupervisorAdd(ctx: Ctx): Promise<void> {
  await ctx.setSession({ step: 'sa_name' });
  await ask(ctx, '➕ <b>Yangi masul</b>\nIsmi va familiyasi?');
}

// ─── Haydovchilar ────────────────────────────────────────────────────────────

type DrvRow = Driver & { point: RecyclePoint | null; supervisor: Supervisor | null };

export async function showDrivers(ctx: Ctx): Promise<void> {
  const list: DrvRow[] = await prisma.driver.findMany({ include: { point: true, supervisor: true }, orderBy: [{ pointId: 'asc' }, { status: 'asc' }, { name: 'asc' }], take: 60 });
  const rows = pairs(list.map((d) => ({ text: `${d.status === 'inactive' ? '⛔' : d.isOnline ? '🟢' : '⚪'} ${d.name}`, callback_data: `hqdrv_${d.id}` })));
  rows.push([{ text: "➕ Haydovchi qo'shish", callback_data: 'drvnew' }]);
  if (!list.length) { await ctx.reply("🚛 Hozircha haydovchilar yo'q.", { reply_markup: inline(rows) }); return; }
  const lines: string[] = [`🚛 <b>Haydovchilar:</b> ${list.length} ta (tafsilot — tugmada)`];
  let group = '';
  for (const d of list) {
    const g = d.point ? d.point.cityUz : 'Punktsiz';
    if (g !== group) { group = g; lines.push(`🏭 <b>${esc(g)}</b>`); }
    lines.push(`${driverLine(d)}\n🧑‍💼 ${d.supervisor ? esc(d.supervisor.name) : "masul yo'q"}`);
  }
  await sendLines(ctx, lines, { rows });
}

export async function showDriver(ctx: Ctx, id: number | null): Promise<void> {
  const d = id ? await prisma.driver.findUnique({ where: { id }, include: { point: true, supervisor: true } }) : null;
  if (!d) { await ctx.answer('Haydovchi topilmadi', true); return; }
  const [tasks, bal] = await Promise.all([driverTasks(d.id), driverBalance(d.id)]);
  const lines = [
    driverLine(d),
    `🏭 ${d.point ? esc(d.point.cityUz) : "punkt yo'q"} · 🧑‍💼 ${d.supervisor ? esc(d.supervisor.name) : "masul yo'q"}`,
    `💰 Balans: <b>${sum(bal.balance)}</b> (daromad ${sum(bal.earned)}, yechilgan ${sum(bal.withdrawn)}, kutilmoqda ${sum(bal.pending)})`,
    `🕒 Oxirgi faollik: ${when(d.lastSeenAt)}`,
    tasks.length ? `📋 Faol topshiriqlar:\n${tasks.map((t) => `• #${t.id} ${statusLabels.uz[t.status]} — ${esc(t.name)}`).join('\n')}` : "📋 Faol topshiriq yo'q",
  ];
  const rows: InlineKeyboard = [
    [{ text: '🎁 Bonus', callback_data: `bonus_${d.id}` }],
    [
      { text: '🔄 Telegramni uzish', callback_data: `hqdrvtg_${d.id}` },
      d.status === 'inactive' ? { text: '✅ Faollashtirish', callback_data: `hqdrvact_${d.id}` } : { text: '⛔ Bloklash', callback_data: `hqdrvblock_${d.id}` },
    ],
  ];
  await ctx.reply(lines.join('\n'), { reply_markup: inline(rows) });
}

export async function driverAction(ctx: Ctx, hq: Hq, kind: 'tg' | 'block' | 'act', id: number | null): Promise<void> {
  const d = id ? await prisma.driver.findUnique({ where: { id } }) : null;
  if (!d) { await ctx.answer('Haydovchi topilmadi', true); return; }
  if (kind === 'tg') {
    const code = await resetDriverTelegram(d.id);
    await logEvent({ sourceBot: 'pack24admin', eventType: 'driver_telegram_reset', title: `${d.name}: Telegram uzildi`, message: hq.name, driverId: d.id, supervisorId: d.supervisorId, pointId: d.pointId });
    await ctx.edit(`🔄 <b>${esc(d.name)}</b>: Telegram uzildi.\n🔑 Yangi kod: <code>${code}</code>\nHaydovchi botga /start → kod → raqamini ulashadi.`);
    return;
  }
  if (kind === 'block') {
    const tasks = await driverTasks(d.id);
    await updateDriver(d.id, { status: 'inactive' });
    await logEvent({ sourceBot: 'pack24admin', eventType: 'driver_blocked', severity: 'warning', title: `${d.name} bloklandi`, message: hq.name, driverId: d.id, supervisorId: d.supervisorId, pointId: d.pointId });
    await ctx.edit(`⛔ <b>${esc(d.name)}</b> bloklandi.${tasks.length ? `\n⚠️ Faol topshiriqlari bor: ${tasks.map((t) => `#${t.id}`).join(', ')} — masul boshqa haydovchiga tayinlasin.` : ''}`);
    return;
  }
  await updateDriver(d.id, { status: 'active' });
  await logEvent({ sourceBot: 'pack24admin', eventType: 'driver_activated', severity: 'success', title: `${d.name} faollashtirildi`, message: hq.name, driverId: d.id, supervisorId: d.supervisorId, pointId: d.pointId });
  await ctx.edit(`✅ <b>${esc(d.name)}</b> faollashtirildi.`);
}

export async function startBonus(ctx: Ctx, id: number | null): Promise<void> {
  const d = id ? await prisma.driver.findUnique({ where: { id }, select: { id: true, name: true } }) : null;
  if (!d) { await ctx.answer('Haydovchi topilmadi', true); return; }
  await ctx.setSession({ step: 'bonus_sum', driverId: d.id, driverName: d.name });
  await ask(ctx, `🎁 <b>${esc(d.name)}</b> uchun bonus summasi (so'm)?`);
}

export async function startDriverAdd(ctx: Ctx): Promise<void> {
  await ctx.setSession({ step: 'hd_name' });
  await ask(ctx, '➕ <b>Yangi haydovchi</b>\nIsmi va familiyasi?');
}

// ─── Punktlar ────────────────────────────────────────────────────────────────

const pointRowsFor = (p: RecyclePoint): InlineKeyboard => [
  [{ text: '💰 Narx', callback_data: `ptprice_${p.id}` }, { text: '🚚 Stavka', callback_data: `ptrate_${p.id}` }],
  [{ text: p.isAccepting ? "🔴 Qabulni to'xtatish" : '🟢 Qabulni ochish', callback_data: `pttoggle_${p.id}` }],
];

async function pointHtml(p: RecyclePoint): Promise<string> {
  const [sups, drivers, online] = await Promise.all([
    prisma.supervisor.count({ where: { pointId: p.id, isActive: true } }),
    prisma.driver.count({ where: { pointId: p.id, status: { not: 'inactive' } } }),
    prisma.driver.count({ where: { pointId: p.id, status: { not: 'inactive' }, isOnline: true } }),
  ]);
  return pointInfoHtml(p, [`🧑‍💼 Masullar: ${sups} · 🚛 Haydovchilar: ${drivers} (onlayn ${online})`]);
}

export async function showPoints(ctx: Ctx): Promise<void> {
  const points = await prisma.recyclePoint.findMany({ orderBy: { id: 'asc' } });
  if (!points.length) { await ctx.reply("🏭 Punktlar yo'q — admin paneldan qo'shing."); return; }
  for (const p of points) await ctx.reply(await pointHtml(p), { reply_markup: inline(pointRowsFor(p)) });
}

export async function togglePoint(ctx: Ctx, hq: Hq, id: number | null): Promise<void> {
  const p = id ? await prisma.recyclePoint.findUnique({ where: { id } }) : null;
  if (!p) { await ctx.answer('Punkt topilmadi', true); return; }
  const on = !p.isAccepting;
  const u = await prisma.recyclePoint.update({ where: { id: p.id }, data: { isAccepting: on } });
  await logEvent({ sourceBot: 'pack24admin', eventType: on ? 'point_accepting_on' : 'point_accepting_off', severity: on ? 'success' : 'warning', title: `${p.cityUz}: qabul ${on ? 'ochildi' : "to'xtatildi"}`, message: hq.name, pointId: p.id });
  await ctx.answer(on ? '🟢 Qabul ochildi' : "🔴 Qabul to'xtatildi");
  await ctx.edit(await pointHtml(u), pointRowsFor(u));
}

export async function startPointEdit(ctx: Ctx, field: 'price' | 'rate', id: number | null): Promise<void> {
  const p = id ? await prisma.recyclePoint.findUnique({ where: { id } }) : null;
  if (!p) { await ctx.answer('Punkt topilmadi', true); return; }
  await ctx.setSession({ step: field === 'price' ? 'pt_price' : 'pt_rate', pointId: p.id });
  await ask(ctx, field === 'price'
    ? `💰 <b>${esc(p.cityUz)}</b> — hozirgi narx: <b>${sum(p.pricePerKg)}/kg</b>\nYangi narxni yozing (so'm/kg):`
    : `🚚 <b>${esc(p.cityUz)}</b> — hozirgi haydovchi stavkasi: <b>${sum(p.driverRatePerKg)}/kg</b>\nYangi stavkani yozing (so'm/kg):`);
}

// ─── Kirish so'rovlari ───────────────────────────────────────────────────────

type AccessRow = BotAccessRequest & { requestedPoint: RecyclePoint | null; requestedSupervisor: Supervisor | null };
const accessHtml = (r: AccessRow) => [
  `📝 <b>${r.role === 'driver' ? 'Haydovchi' : 'Masul'} kirish so'rovi #${r.id}</b>`,
  `👤 ${esc(r.name)} · ${phone(r.phone)}${r.telegramName ? ` · TG: ${esc(r.telegramName)}` : ''}`,
  `🏭 ${r.requestedPoint ? esc(r.requestedPoint.cityUz) : 'punkt tanlanmagan'}${r.requestedSupervisor ? ` · 🧑‍💼 ${esc(r.requestedSupervisor.name)}` : ''}`,
  r.vehicleInfo ? `🚚 ${esc(r.vehicleInfo)}` : null,
  `🕒 ${when(r.createdAt)}`,
].filter(Boolean).join('\n');
const accessRows = (id: number): InlineKeyboard => [[{ text: '✅ Tasdiqlash', callback_data: `acc_ok_${id}` }, { text: '❌ Rad etish', callback_data: `acc_no_${id}` }]];

export async function showAccess(ctx: Ctx): Promise<void> {
  const list = await pendingAccessRequests();
  if (!list.length) { await ctx.reply("📝 Kutilayotgan kirish so'rovlari yo'q. ✅"); return; }
  await ctx.reply(`📝 <b>Kirish so'rovlari:</b> ${list.length} ta`);
  for (const r of list) await ctx.reply(accessHtml(r), { reply_markup: inline(accessRows(r.id)) });
}

/** acc_ok_<id> yoki accpt_<id>_<pointId>: punkt bo'lmasa avval punkt so'raladi; accpt_<id>_0 — aniq punktsiz tasdiqlash */
export async function approveAccess(ctx: Ctx, hq: Hq, id: number | null, pointId?: number): Promise<void> {
  const req = id ? await prisma.botAccessRequest.findUnique({ where: { id }, include: { requestedPoint: true, requestedSupervisor: true } }) : null;
  if (!req) { await ctx.answer("So'rov topilmadi", true); return; }
  if (req.status !== 'pending') { await ctx.answer("So'rov allaqachon ko'rib chiqilgan", true); await ctx.edit(`${accessHtml(req)}\n\nℹ️ Allaqachon ${req.status === 'approved' ? 'tasdiqlangan' : 'rad etilgan'}.`); return; }
  const explicitNone = pointId === 0;
  const pid = explicitNone ? null : (pointId ?? req.requestedPointId ?? req.requestedSupervisor?.pointId ?? null);
  if (pid && !(await prisma.recyclePoint.findFirst({ where: { id: pid, status: 'active' }, select: { id: true } }))) { await ctx.answer('Punkt topilmadi yoki faol emas', true); return; }
  if (!pid && !explicitNone) {
    const points = await activePoints();
    if (points.length) { await ask(ctx, `🏭 <b>${esc(req.name)}</b> (${req.role === 'driver' ? 'haydovchi' : 'masul'}) uchun punktni tanlang:`, [...pointRows(points, `accpt_${req.id}_`), [{ text: '🤷 Punktsiz tasdiqlash', callback_data: `accpt_${req.id}_0` }]]); return; }
  }
  try {
    await approveAccessRequest(req.id, { name: hq.name, hqAdminId: hq.admin?.id ?? null }, explicitNone ? { pointId: null } : pid ? { pointId: pid } : {});
  } catch (e) {
    if (e instanceof StaffError) { await ctx.edit(`${accessHtml(req)}\n\n❌ ${esc(e.message)}`); return; }
    throw e;
  }
  const point = pid ? await prisma.recyclePoint.findUnique({ where: { id: pid }, select: { cityUz: true } }) : null;
  await ctx.edit(`${accessHtml(req)}\n\n✅ <b>Tasdiqlandi</b> (${esc(hq.name)})${point ? ` · 🏭 ${esc(point.cityUz)}` : ' · punktsiz'}. Foydalanuvchiga botda xabar yuborildi.`);
}

export async function startReject(ctx: Ctx, id: number | null): Promise<void> {
  const req = id ? await prisma.botAccessRequest.findUnique({ where: { id } }) : null;
  if (!req) { await ctx.answer("So'rov topilmadi", true); return; }
  if (req.status !== 'pending') { await ctx.answer("So'rov allaqachon ko'rib chiqilgan", true); return; }
  await ctx.setSession({ step: 'acc_reject', id: req.id, name: req.name });
  await ask(ctx, `❌ <b>${esc(req.name)}</b> so'rovini rad etish sababi (foydalanuvchiga yuboriladi):`, [SKIP_ROW]);
}

// ─── Yechib olish ────────────────────────────────────────────────────────────

export async function showWithdrawals(ctx: Ctx): Promise<void> {
  const list = await prisma.driverTransaction.findMany({ where: { type: 'withdrawal', status: 'pending' }, include: { driver: { include: { supervisor: true, point: true } } }, orderBy: { id: 'asc' }, take: 20 });
  if (!list.length) { await ctx.reply("💳 Kutilayotgan yechib olish so'rovlari yo'q."); return; }
  await ctx.reply(`💳 <b>Yechib olish so'rovlari:</b> ${list.length} ta`);
  for (const t of list) {
    await ctx.reply(`${withdrawalHtml(t)}\n🏭 ${t.driver.point ? esc(t.driver.point.cityUz) : '—'} · 🧑‍💼 ${t.driver.supervisor ? esc(t.driver.supervisor.name) : "masul yo'q"}`, { reply_markup: inline(wdRows(t.id)) });
  }
}

export async function settle(ctx: Ctx, hq: Hq, ok: boolean, id: number | null): Promise<void> {
  if (!id) { await ctx.answer("So'rov topilmadi", true); return; }
  const t = await settleWithdrawal(id, ok ? 'completed' : 'failed', { name: hq.name });
  await ctx.edit(`${ok ? "✅ To'landi" : '❌ Rad etildi'}: <b>${sum(t.amount)}</b> · ${esc(hq.name)} · ${when(new Date())}`);
}

// ─── Hodisalar ───────────────────────────────────────────────────────────────

export async function showEvents(ctx: Ctx): Promise<void> {
  const [list, total] = await Promise.all([
    prisma.botEvent.findMany({ where: { status: 'new_' }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.botEvent.count({ where: { status: 'new_' } }),
  ]);
  if (!list.length) { await ctx.reply("🔔 Yangi hodisalar yo'q. ✅"); return; }
  await sendLines(ctx, [`🔔 <b>Yangi hodisalar:</b> ${total} ta${total > list.length ? ' (oxirgi 10 tasi)' : ''}`, ...list.map(eventLine)], { rows: [[{ text: "✅ Hammasini ko'rildi", callback_data: 'ev_seen' }]] });
}

export async function markAllSeen(ctx: Ctx): Promise<void> {
  const { count } = await prisma.botEvent.updateMany({ where: { status: 'new_' }, data: { status: 'processed', processedAt: new Date() } });
  await ctx.edit(`✅ ${count} ta hodisa ko'rildi deb belgilandi.`);
}

// ─── Shikoyatlar ─────────────────────────────────────────────────────────────

export async function showComplaints(ctx: Ctx): Promise<void> {
  const list = await prisma.recycleComplaint.findMany({ where: { status: { in: ['open', 'in_progress'] } }, include: { request: { select: { point: { select: { cityUz: true } }, supervisor: { select: { name: true } } } } }, orderBy: [{ level: 'desc' }, { id: 'asc' }], take: 15 });
  if (!list.length) { await ctx.reply("📣 Ochiq shikoyatlar yo'q. ✅"); return; }
  await ctx.reply(`📣 <b>Ochiq shikoyatlar:</b> ${list.length} ta`);
  for (const c of list) {
    const rows: InlineKeyboard = [[{ text: '✍️ Javob berish', callback_data: `complaint_${c.requestId}` }]];
    if (c.level === 'supervisor') rows.push([{ text: '⬆️ Direktorga', callback_data: `cmpdir_${c.id}` }]);
    await ctx.reply(`${complaintHtml(c)}\n🏭 ${esc(c.request.point.cityUz)} · 🧑‍💼 ${c.request.supervisor ? esc(c.request.supervisor.name) : "masul yo'q"}`, { reply_markup: inline(rows) });
  }
}

export async function startComplaintReply(ctx: Ctx, requestId: number | null): Promise<void> {
  const open = requestId ? await prisma.recycleComplaint.count({ where: { requestId, status: { in: ['open', 'in_progress'] } } }) : 0;
  if (!open) { await ctx.answer("Bu ariza bo'yicha ochiq shikoyat yo'q", true); return; }
  await ctx.setSession({ step: 'cmp_reply', requestId });
  await ask(ctx, `✍️ <b>Ariza #${requestId}</b> shikoyatiga javob yozing (mijozga yuboriladi):`);
}

export async function escalate(ctx: Ctx, hq: Hq, complaintId: number | null): Promise<void> {
  const c = complaintId ? await prisma.recycleComplaint.findUnique({ where: { id: complaintId }, include: { request: { select: { pointId: true, supervisorId: true } } } }) : null;
  if (!c) { await ctx.answer('Shikoyat topilmadi', true); return; }
  if (c.level === 'director') { await ctx.answer('Allaqachon direktor darajasida', true); return; }
  await prisma.recycleComplaint.update({ where: { id: c.id }, data: { level: 'director', status: c.status === 'open' ? 'in_progress' : c.status } });
  await logEvent({ sourceBot: 'pack24admin', eventType: 'complaint_escalated', severity: 'warning', title: `Shikoyat #${c.id} direktorga ko'tarildi`, message: `Ariza #${c.requestId} · ${hq.name}`, requestId: c.requestId, pointId: c.request.pointId, supervisorId: c.request.supervisorId });
  await ctx.edit(`⬆️ Shikoyat #${c.id} (ariza #${c.requestId}) <b>direktor darajasiga</b> ko'tarildi. Javob berish: "${MENU.complaints}".`);
}

// ─── Suhbat bosqichlari ──────────────────────────────────────────────────────

/** sapt_<pointId> / hdpt_<pointId> / hdsup_<supId>: qo'shish oqimidagi tanlovlar (0 — yo'q) */
export async function stepPick(ctx: Ctx, hq: Hq, prefix: 'sapt_' | 'hdpt_' | 'hdsup_'): Promise<void> {
  const s = await ctx.session<Sess>();
  const raw = ctx.data.slice(prefix.length);
  const v = raw === '0' ? 0 : idFrom(ctx.data, prefix);
  if (!s?.step || v == null) { await ctx.answer('Bosqich tugagan — menyudan qayta boshlang', true); return; }
  // Eski/soxta tugma: punkt faol bo'lishi, masul tanlangan punktga tegishli bo'lishi shart
  if ((prefix === 'sapt_' || prefix === 'hdpt_') && v && !(await prisma.recyclePoint.findFirst({ where: { id: v, status: 'active' }, select: { id: true } }))) { await ctx.answer('Punkt topilmadi yoki faol emas', true); return; }
  if (prefix === 'hdsup_' && v && !(await prisma.supervisor.findFirst({ where: { id: v, isActive: true, pointId: sNum(s.pointId) || null }, select: { id: true } }))) { await ctx.answer('Bu masul tanlangan punktda emas', true); return; }
  if (prefix === 'sapt_' && s.step === 'sa_point') {
    try {
      const sup = await createSupervisor({ name: sStr(s.name), phone: sStr(s.phone), pointId: v || null });
      const point = v ? await prisma.recyclePoint.findUnique({ where: { id: v }, select: { cityUz: true } }) : null;
      await logEvent({ sourceBot: 'pack24admin', eventType: 'supervisor_created', severity: 'success', title: `Yangi masul: ${sup.name}`, message: `${hq.name} qo'shdi${point ? ` · ${point.cityUz}` : ''}`, supervisorId: sup.id, pointId: sup.pointId });
      await ctx.clearSession();
      await ctx.edit(`✅ <b>Masul qo'shildi:</b> ${esc(sup.name)}${point ? ` · 🏭 ${esc(point.cityUz)}` : ''}\n🔑 Kod: <code>${sup.registrationCode}</code>\n\nMasul <b>masul botiga</b> /start bosadi → shu kodni yuboradi → raqamini ulashadi.`);
    } catch (e) {
      if (!(e instanceof StaffError)) throw e;
      await ctx.clearSession();
      await ctx.edit(`❌ ${esc(e.message)}`);
    }
    return;
  }
  if (prefix === 'hdpt_' && s.step === 'hd_point') {
    const sups = v ? await prisma.supervisor.findMany({ where: { pointId: v, isActive: true }, orderBy: { name: 'asc' } }) : [];
    if (!sups.length) {
      await ctx.setSession({ ...s, step: 'hd_vehicle', pointId: v, supervisorId: 0 });
      await ctx.edit(`🏭 Punkt tanlandi${v ? '' : ' (punktsiz)'}. Masul yo'q — haydovchi masulsiz yaratiladi.`);
      await ask(ctx, '🚚 Mashinasi (rusumi, davlat raqami)?', [SKIP_ROW]);
      return;
    }
    await ctx.setSession({ ...s, step: 'hd_sup', pointId: v });
    await ctx.edit('🏭 Punkt tanlandi.');
    await ask(ctx, '🧑‍💼 Qaysi masul ostida ishlaydi?', [...sups.map((x) => [{ text: `${x.name}${x.telegramId ? '' : ' (TG ❌)'}`, callback_data: `hdsup_${x.id}` }]), [{ text: '🤷 Masulsiz', callback_data: 'hdsup_0' }]]);
    return;
  }
  if (prefix === 'hdsup_' && s.step === 'hd_sup') {
    await ctx.setSession({ ...s, step: 'hd_vehicle', supervisorId: v });
    await ctx.edit(v ? '🧑‍💼 Masul tanlandi.' : '🧑‍💼 Masulsiz.');
    await ask(ctx, '🚚 Mashinasi (rusumi, davlat raqami)?', [SKIP_ROW]);
    return;
  }
  await ctx.answer('Bu tugma hozirgi bosqichga mos emas', true);
}

export async function handleStep(ctx: Ctx, hq: Hq, s: Sess, rawText: string): Promise<void> {
  const text = rawText.trim();
  switch (s.step) {
    case 'cancel_reason':
      await cancelReasonStep(ctx, actorOf(hq), sNum(s.requestId), text);
      return;

    // ── masul qo'shish
    case 'sa_name': {
      const name = text.slice(0, 100);
      if (name.length < 2) { await ask(ctx, '❌ Ism kamida 2 ta harf. Qaytadan yozing:'); return; }
      await ctx.setSession({ step: 'sa_phone', name });
      await ask(ctx, '📞 Telefon raqami? (namuna: +998 90 123 45 67)');
      return;
    }
    case 'sa_phone': {
      const ph = phoneFrom(text);
      if (!ph) { await ask(ctx, "❌ Telefon noto'g'ri. Namuna: +998 90 123 45 67"); return; }
      const points = await activePoints();
      await ctx.setSession({ ...s, step: 'sa_point', phone: ph });
      await ask(ctx, '🏭 Qaysi punktga biriktiramiz?', [...pointRows(points, 'sapt_'), [{ text: '🤷 Punktsiz', callback_data: 'sapt_0' }]]);
      return;
    }
    case 'sa_point':
      await ask(ctx, '🏭 Punktni yuqoridagi tugmalardan tanlang.');
      return;

    // ── haydovchi qo'shish
    case 'hd_name': {
      const name = text.slice(0, 100);
      if (name.length < 2) { await ask(ctx, '❌ Ism kamida 2 ta harf. Qaytadan yozing:'); return; }
      await ctx.setSession({ step: 'hd_phone', name });
      await ask(ctx, '📞 Telefon raqami? (namuna: +998 90 123 45 67)');
      return;
    }
    case 'hd_phone': {
      const ph = phoneFrom(text);
      if (!ph) { await ask(ctx, "❌ Telefon noto'g'ri. Namuna: +998 90 123 45 67"); return; }
      const points = await activePoints();
      await ctx.setSession({ ...s, step: 'hd_point', phone: ph });
      await ask(ctx, '🏭 Qaysi punktda ishlaydi?', [...pointRows(points, 'hdpt_'), [{ text: '🤷 Punktsiz', callback_data: 'hdpt_0' }]]);
      return;
    }
    case 'hd_point': case 'hd_sup':
      await ask(ctx, 'Yuqoridagi tugmalardan tanlang.');
      return;
    case 'hd_vehicle': {
      const vehicleInfo = isSkip(text) ? null : text.slice(0, 120);
      try {
        const d = await createDriver({ name: sStr(s.name), phone: sStr(s.phone), pointId: sNum(s.pointId) || null, supervisorId: sNum(s.supervisorId) || null, vehicleInfo });
        await logEvent({ sourceBot: 'pack24admin', eventType: 'driver_created', severity: 'success', title: `Yangi haydovchi: ${d.name}`, message: `${hq.name} qo'shdi`, driverId: d.id, supervisorId: d.supervisorId, pointId: d.pointId });
        await ctx.clearSession();
        await ctx.reply(`✅ <b>Haydovchi qo'shildi:</b> ${esc(d.name)}\n🔑 Kod: <code>${d.registrationCode}</code>\n\nHaydovchi <b>haydovchi botiga</b> /start bosadi → shu kodni yuboradi → raqamini ulashadi.`, { reply_markup: mainKeyboard() });
      } catch (e) {
        if (!(e instanceof StaffError)) throw e;
        await ctx.clearSession();
        await ctx.reply(`❌ ${esc(e.message)}`, { reply_markup: mainKeyboard() });
      }
      return;
    }

    // ── bonus
    case 'bonus_sum': {
      const v = parseNum(text);
      if (v == null || v <= 0 || v > 100_000_000) { await ask(ctx, "❌ Summani raqam bilan yozing (so'm):"); return; }
      await ctx.setSession({ ...s, step: 'bonus_reason', amount: v });
      await ask(ctx, `📝 ${sum(v)} — sababi (haydovchiga ko'rinadi)?`);
      return;
    }
    case 'bonus_reason': {
      const reason = text.slice(0, 200);
      if (reason.length < 2) { await ask(ctx, '❌ Sababni yozing (kamida 2 ta belgi):'); return; }
      const t = await addBonus(sNum(s.driverId), sNum(s.amount), reason, hq.name);
      await logEvent({ sourceBot: 'pack24admin', eventType: 'driver_bonus', severity: 'success', title: `Bonus: ${sStr(s.driverName)} — ${sum(t.amount)}`, message: `${hq.name}: ${reason}`, driverId: sNum(s.driverId) });
      await ctx.clearSession();
      await ctx.reply(`🎁 <b>${esc(sStr(s.driverName))}</b> ga bonus: <b>${sum(t.amount)}</b> — ${esc(reason)}. Haydovchiga xabar yuborildi.`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── punkt narxi / stavkasi
    case 'pt_price': case 'pt_rate': {
      const v = parseNum(text);
      if (v == null || v <= 0 || v > 1_000_000) { await ask(ctx, "❌ Raqam bilan yozing (so'm/kg):"); return; }
      const p = await prisma.recyclePoint.findUnique({ where: { id: sNum(s.pointId) } });
      if (!p) { await ctx.clearSession(); await ctx.reply('❌ Punkt topilmadi.'); return; }
      const isPrice = s.step === 'pt_price';
      const old = toNumber(isPrice ? p.pricePerKg : p.driverRatePerKg);
      await prisma.recyclePoint.update({ where: { id: p.id }, data: isPrice ? { pricePerKg: v } : { driverRatePerKg: v } });
      await logEvent({ sourceBot: 'pack24admin', eventType: isPrice ? 'point_price_changed' : 'point_rate_changed', severity: 'warning', title: `${p.cityUz}: ${isPrice ? 'narx' : 'haydovchi stavkasi'} ${old} → ${v} so'm/kg`, message: `O'zgartirdi: ${hq.name}`, pointId: p.id });
      await ctx.clearSession();
      await ctx.reply(`✅ <b>${esc(p.cityUz)}</b>: ${isPrice ? 'narx' : 'haydovchi stavkasi'} <b>${sum(v)}/kg</b> (avval ${sum(old)}/kg).`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── kirish so'rovini rad etish
    case 'acc_reject': {
      const reason = isSkip(text) ? undefined : text.slice(0, 300);
      try {
        await rejectAccessRequest(sNum(s.id), { name: hq.name, hqAdminId: hq.admin?.id ?? null }, reason);
      } catch (e) {
        if (!(e instanceof StaffError)) throw e;
        await ctx.clearSession();
        await ctx.reply(`❌ ${esc(e.message)}`, { reply_markup: mainKeyboard() });
        return;
      }
      await ctx.clearSession();
      await ctx.reply(`❌ <b>${esc(sStr(s.name))}</b> so'rovi rad etildi${reason ? `: ${esc(reason)}` : ''}. Foydalanuvchiga xabar yuborildi.`, { reply_markup: mainKeyboard() });
      return;
    }

    // ── shikoyatga javob
    case 'cmp_reply': {
      const response = text.slice(0, 1000);
      if (response.length < 2) { await ask(ctx, '❌ Javob matnini yozing (kamida 2 ta belgi):'); return; }
      const n = await resolveComplaints(sNum(s.requestId), response, { name: hq.name, source: 'pack24admin' });
      await ctx.clearSession();
      await ctx.reply(n ? `✅ Javob yuborildi, ${n} ta shikoyat yopildi.` : 'ℹ️ Ochiq shikoyat topilmadi.', { reply_markup: mainKeyboard() });
      return;
    }

    default:
      await showMenu(ctx, hq, '🤔 Bosqich tugagan. Menyudan tanlang:');
  }
}
