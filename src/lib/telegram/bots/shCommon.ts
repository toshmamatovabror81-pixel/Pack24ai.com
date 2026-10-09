import 'server-only';
import type { BotEvent, Driver, DriverTransaction, EventSeverity, RecycleComplaint, RecyclePoint } from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayPhone, formatDate, formatPrice, normalizePhone, toNumber } from '@/lib/format';
import { logEvent } from '@/lib/recycling/events';
import { todayTashkent } from '@/lib/recycling/journal';
import { cancelRequest, type Actor } from '@/lib/recycling/requests';
import { registerByCode, type RegisterResult } from '@/lib/recycling/staff';
import { call, esc, keyboard, type InlineKeyboard, type ReplyKeyboard } from '../api';
import { notifyCustomer } from '../notify';
import type { Ctx } from '../router';

/**
 * Masul va HQ botlari uchun umumiy yordamchilar: matn formatlari, raqam o'qish,
 * sessiya bosqichlari, bekor qilish sabablari, kod + telefon bilan ro'yxatdan o'tish.
 */

export const BACK = '⬅️ Bosh menyu';
export const SKIP = "⏭ O'tkazib yuborish";
export const MENU_ROW = [{ text: BACK, callback_data: 'menu' }];
/** Bosqichdagi savolga javob sifatida qiymat yuboradigan tugma: val_<qiymat> → matn kiritilgandek ishlanadi */
export const val = (text: string, value: string | number) => ({ text, callback_data: `val_${String(value).slice(0, 50)}` });
export const SKIP_ROW = [val(SKIP, '-')];
export const TODAY_ROW = [val('📅 Bugun', 'bugun'), val('📅 Kecha', 'kecha')];

/** Suhbat bosqichi: {step, ...maydonlar} (bazadagi BotSession) */
export type Sess = { step: string } & Record<string, unknown>;
export const sNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
export const sStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const sum = (v: unknown) => formatPrice(v as number, "so'm");
export const kg = (v: unknown) => `${Math.round(toNumber(v as number) * 100) / 100} kg`;
export const yes = (b: unknown) => (b ? '✅' : '❌');
export const when = (d: Date | null | undefined) => (d ? formatDate(d, 'uz', true) : '—');
export const phone = (p: string) => esc(displayPhone(p));

/** "12 500", "12,5", "12.5" → son; manfiy yoki matn bo'lsa null */
export function parseNum(text: string): number | null {
  const t = text.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!t || t === '.') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}
export const isSkip = (text: string) => { const t = text.trim(); return !t || t === SKIP || t === '⏭' || t === '-'; };
export const codeFrom = (text: string) => { const c = text.replace(/\D/g, ''); return c.length === 5 ? c : null; };
export const phoneFrom = (text: string) => normalizePhone(text);

/** 'pick_12_5' → [12, 5] (prefiksdan keyingi raqamlar) */
export function ids(data: string, prefix: string): number[] {
  return data.slice(prefix.length).split('_').map((s) => Number(s)).filter((n) => Number.isSafeInteger(n) && n >= 0);
}

/** Bugungi Toshkent kuni: `day` — jurnal sanasi (UTC yarim tun), from/to — createdAt kabi vaqt maydonlari uchun haqiqiy oraliq */
export function todayRange(now = new Date()): { from: Date; to: Date; day: Date } {
  const day = todayTashkent(now);
  const from = new Date(day.getTime() - 5 * 3600_000);
  return { from, to: new Date(from.getTime() + 86_400_000), day };
}

export const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

export const driverStatusLabel: Record<Driver['status'], string> = { active: "Bo'sh", inactive: 'Bloklangan', on_route: "Yo'lda", busy: 'Band' };

export function driverLine(d: Driver): string {
  return [
    `${d.isOnline ? '🟢' : '⚪'} <b>${esc(d.name)}</b> · ${phone(d.phone)}`,
    d.vehicleInfo ? `🚚 ${esc(d.vehicleInfo)}` : null,
    `${driverStatusLabel[d.status]} · Telegram ${yes(d.telegramId)}${d.registrationCode ? ` · kod <code>${d.registrationCode}</code>` : ''}`,
  ].filter(Boolean).join('\n');
}

export function pointInfoHtml(p: RecyclePoint, extra: (string | null)[] = []): string {
  return [
    `🏭 <b>${esc(p.cityUz)}</b> (${esc(p.regionUz)})`,
    p.address ? `📍 ${esc(p.address)}` : null,
    `📞 ${esc(p.phone)} · 🕒 ${esc(p.workingHours)}`,
    `💵 Narx: <b>${sum(p.pricePerKg)}/kg</b> · 🚚 Haydovchi stavkasi: ${sum(p.driverRatePerKg)}/kg`,
    `${p.isAccepting ? '🟢 Qabul qilinmoqda' : "🔴 Qabul to'xtatilgan"}${p.status !== 'active' ? ' · rejalashtirilgan' : ''}`,
    ...extra,
  ].filter(Boolean).join('\n');
}

export const sevIcon: Record<EventSeverity, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '🚨' };
export const eventLine = (e: BotEvent) =>
  `${sevIcon[e.severity]} <b>${esc(e.title)}</b>\n${esc(e.message.slice(0, 160))}${e.message.length > 160 ? '…' : ''}\n<i>${when(e.createdAt)}</i>`;

const complaintStatus: Record<RecycleComplaint['status'], string> = { open: 'ochiq', in_progress: 'jarayonda', resolved: 'hal qilindi', closed: 'yopiq' };
export function complaintHtml(c: RecycleComplaint): string {
  return [
    `📣 <b>Shikoyat #${c.id}</b> · ariza #${c.requestId} · ${c.level === 'director' ? '⬆️ direktor' : 'masul'} · ${complaintStatus[c.status]}`,
    `👤 ${esc(c.fromName)} · ${phone(c.fromPhone)}`,
    `💬 ${esc(c.message)}`,
    `🕒 ${when(c.createdAt)}`,
  ].join('\n');
}

export function withdrawalHtml(t: DriverTransaction & { driver: { name: string; phone: string } }): string {
  return `💳 <b>${sum(t.amount)}</b> — ${esc(t.driver.name)} (${phone(t.driver.phone)})\n${esc(t.description ?? '')} · ${when(t.createdAt)}`;
}
export const wdRows = (id: number): InlineKeyboard => [[{ text: "✅ To'landi", callback_data: `wd_ok_${id}` }, { text: '❌ Rad', callback_data: `wd_no_${id}` }]];

export const pointRows = (points: Pick<RecyclePoint, 'id' | 'cityUz' | 'regionUz'>[], prefix: string): InlineKeyboard =>
  points.map((p) => [{ text: `🏭 ${p.cityUz} (${p.regionUz})`, callback_data: `${prefix}${p.id}` }]);

export const contactKeyboard = (): ReplyKeyboard => keyboard([[{ text: '📱 Raqamni ulashish', request_contact: true }], [BACK]], { one_time_keyboard: true });

/** Savol: inline tugmalar + "Bosh menyu" */
export const ask = (ctx: Ctx, html: string, rows: InlineKeyboard = []) => ctx.reply(html, { reply_markup: { inline_keyboard: [...rows, MENU_ROW] } });

/** Bosilgan xabardan inline tugmalarni olib tashlash (ikki marta bosilmasin); xato bo'lsa jim o'tadi */
export async function clearButtons(ctx: Ctx): Promise<void> {
  const m = ctx.callback?.message;
  if (!m) return;
  await call(ctx.token, 'editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: m.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
}

/** Uzun ro'yxatlarni bir nechta xabarga bo'lib yuborish (4096 belgi chegarasi); tugmalar oxirgi xabarda */
export async function sendLines(ctx: Ctx, lines: string[], opts: { sep?: string; rows?: InlineKeyboard; limit?: number } = {}): Promise<void> {
  const sep = opts.sep ?? '\n\n';
  const limit = opts.limit ?? 3500;
  const chunks: string[] = [];
  let cur = '';
  for (const l of lines) {
    if (cur && cur.length + sep.length + l.length > limit) { chunks.push(cur); cur = l; } else cur = cur ? cur + sep + l : l;
  }
  if (cur) chunks.push(cur);
  for (let i = 0; i < chunks.length; i += 1) {
    const last = i === chunks.length - 1;
    await ctx.reply(chunks[i], last && opts.rows?.length ? { reply_markup: { inline_keyboard: opts.rows } } : {});
  }
}

// ─── Bekor qilish (cancel_<id> → cres_<id>_<n> → cancelRequest) ─────────────

export const CANCEL_REASONS: Record<number, string> = { 1: 'Mijoz rad etdi', 2: "Mijoz topilmadi / aloqa yo'q" };
export const cancelRows = (id: number): InlineKeyboard => [
  [{ text: '🙅 Mijoz rad etdi', callback_data: `cres_${id}_1` }, { text: '📵 Topilmadi', callback_data: `cres_${id}_2` }],
  [{ text: '✍️ Boshqa sabab', callback_data: `cres_${id}_3` }],
];

/** cancel_<id>: sabab so'raladi (`allowed` — ariza shu foydalanuvchiga tegishlimi) */
export async function cancelPrompt(ctx: Ctx, requestId: number, allowed: boolean): Promise<void> {
  if (!allowed) { await ctx.answer('Ariza topilmadi yoki sizga tegishli emas', true); return; }
  await ask(ctx, `❌ <b>Ariza #${requestId}</b> ni bekor qilish sababi:`, cancelRows(requestId));
}

/** cres_<id>_<n>: 1/2 — tayyor sabab, 3 — matn so'raladi (step cancel_reason) */
export async function cancelReasonCallback(ctx: Ctx, actor: Actor, isAllowed: (id: number) => Promise<boolean>): Promise<void> {
  const [id, n] = ids(ctx.data, 'cres_');
  if (!id || !(await isAllowed(id))) { await ctx.answer('Ariza topilmadi', true); return; }
  if (n === 3) {
    await ctx.setSession({ step: 'cancel_reason', requestId: id });
    await ask(ctx, `✍️ Ariza #${id}: bekor qilish sababini yozing:`);
    return;
  }
  const reason = CANCEL_REASONS[n] ?? 'Sabab ko\'rsatilmagan';
  const r = await cancelRequest(id, actor, reason);
  // Poydevor onCancelled arizaning masuliga o'zi xabar yuboradi — shu chat bo'lsa faqat tugmalarni olib tashlaymiz
  if (notifiedByFoundation(ctx, r)) { await clearButtons(ctx); await ctx.answer('Bekor qilindi'); return; }
  await ctx.edit(`❌ Ariza #${r.id} bekor qilindi. Sabab: ${esc(reason)}`);
}

/** Poydevor (onCancelled/onCollected) arizaning masuliga o'zi xabar yuboradi — shu chat bo'lsa takrorlamaymiz */
export const notifiedByFoundation = (ctx: Ctx, r: { supervisor?: { telegramId: string | null } | null }) => r.supervisor?.telegramId === String(ctx.from.id);

export async function cancelReasonStep(ctx: Ctx, actor: Actor, requestId: number, text: string): Promise<void> {
  const reason = text.trim().slice(0, 300);
  if (reason.length < 2) { await ask(ctx, 'Sababni yozing (kamida 2 ta belgi):'); return; }
  const r = await cancelRequest(requestId, actor, reason);
  await ctx.clearSession();
  if (!notifiedByFoundation(ctx, r)) await ctx.reply(`❌ Ariza #${r.id} bekor qilindi. Sabab: ${esc(reason)}`);
}

// ─── Shikoyatga javob (masul yoki HQ) ────────────────────────────────────────

/**
 * Ariza bo'yicha ochiq shikoyatlarga javob: resolved + mijozga xabar. Qaytaradi: yopilgan shikoyatlar soni.
 * `level` berilsa faqat shu darajadagi shikoyatlar yopiladi (masul direktorga ko'tarilganini yopa olmaydi).
 */
export async function resolveComplaints(requestId: number, response: string, by: { name: string; source: 'supervisor' | 'pack24admin'; level?: 'supervisor' | 'director' }): Promise<number> {
  const r = await prisma.recycleRequest.findUnique({ where: { id: requestId }, select: { customerTgId: true, pointId: true, supervisorId: true } });
  if (!r) return 0;
  const { count } = await prisma.recycleComplaint.updateMany({
    where: { requestId, status: { in: ['open', 'in_progress'] }, ...(by.level ? { level: by.level } : {}) },
    data: { response, respondedBy: by.name, status: 'resolved', resolvedAt: new Date() },
  });
  if (count) {
    await logEvent({ sourceBot: by.source, eventType: 'complaint_resolved', severity: 'success', title: `Ariza #${requestId}: shikoyatga javob berildi`, message: `${by.name}: ${response}`, requestId, pointId: r.pointId, supervisorId: r.supervisorId });
    if (r.customerTgId) await notifyCustomer(r.customerTgId, `📣 <b>Ariza #${requestId} bo'yicha shikoyatingizga javob:</b>\n${esc(response)}\n\n— ${esc(by.name)}`);
  }
  return count;
}

// ─── Kod + telefon bilan ro'yxatdan o'tish (masul / HQ) ───────────────────────

export type RegOutcome = RegisterResult | { ok: false; reason: 'self' | 'nocontact' };

/** Kod bosqichida tekshiruv: shunday kod bormi (telefon so'ralishidan oldin; telefon oshkor qilinmaydi) */
export async function codeKnown(role: 'supervisor' | 'hq', code: string): Promise<boolean> {
  const row = role === 'supervisor'
    ? await prisma.supervisor.findUnique({ where: { registrationCode: code }, select: { id: true } })
    : await prisma.telegramHqAdmin.findUnique({ where: { registrationCode: code }, select: { id: true } });
  return !!row;
}

/** Shu Telegram yoki telefon uchun kutilayotgan kirish so'rovi (takroriy so'rov oldini olish) */
export async function pendingAccessRequest(role: 'supervisor' | 'driver', telegramId: string, phone?: string | null): Promise<{ id: number; createdAt: Date } | null> {
  const p = phone ? normalizePhone(phone) : null;
  return prisma.botAccessRequest.findFirst({
    where: { role, status: 'pending', OR: [{ telegramId }, ...(p ? [{ phone: p }] : [])] },
    select: { id: true, createdAt: true },
  });
}

/** Kontakt xabarini tekshirib (faqat o'z raqami), kod bilan Telegram'ni bog'laydi */
export async function finishRegistration(ctx: Ctx, role: 'supervisor' | 'hq', code: string): Promise<RegOutcome> {
  const c = ctx.message?.contact;
  if (!c) return { ok: false, reason: 'nocontact' };
  if (c.user_id !== ctx.from.id) return { ok: false, reason: 'self' };
  const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  return registerByCode(role, code, c.phone_number, { id: ctx.from.id, name });
}

export const regFailText: Record<Exclude<RegOutcome, { ok: true }>['reason'], string> = {
  code: "❌ Kod noto'g'ri. 5 raqamli kodni qaytadan yuboring.",
  phone: '❌ Telefon raqami kodga mos kelmadi. Rahbaringizdan tekshirib, qaytadan /start bosing.',
  taken: "❌ Bu Telegram hisobi boshqa foydalanuvchiga bog'langan.",
  inactive: "❌ Hisob faol emas. Rahbaringiz bilan bog'laning.",
  self: "❌ Faqat o'z raqamingizni ulashing (tugma orqali).",
  nocontact: '❌ Raqamni tugma orqali ulashing.',
};
