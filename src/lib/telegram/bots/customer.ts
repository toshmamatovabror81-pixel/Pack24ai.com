import 'server-only';
import type { Prisma, RecycleCollection, RecyclePoint, RecycleRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayPhone, formatDate, formatPrice, normalizePhone } from '@/lib/format';
import { pickText } from '@/lib/i18n/config';
import { customerDecision } from '@/lib/recycling/collections';
import { formatKm, nearestPoint } from '@/lib/recycling/geo';
import { requestCardHtml, trackingUrl, type RequestWithRefs } from '@/lib/recycling/notifications';
import { cancelRequest, createRequest, getRequest, ownsRequest, pickPoint, REQUEST_INCLUDE, RequestError, requestByToken } from '@/lib/recycling/requests';
import { ACTIVE_STATUSES, isMaterial, materialLabels, MATERIALS, pickupTypeLabels, statusLabels, TERMINAL_STATUSES } from '@/lib/recycling/statuses';
import { getSettings } from '@/lib/settings';
import { esc, keyboard, type InlineKeyboard, type ReplyButton, type ReplyMarkup } from '../api';
import { storeTelegramPhoto } from '../photos';
import { createBot, idFrom, type Ctx } from '../router';
import { chunk, commandArg, parseNumber, tgName } from './cdCommon';
import {
  BACK_TEXTS, CANCEL_TEXTS, isCustLang, menuTexts, prevStep, SKIP_COMMENT_TEXTS, SKIP_TEXTS, T, VOLUME_OPTIONS,
  type CustDraft, type CustLang, type CustSession, type CustStep, type CustTexts,
} from './customerFlow';

/**
 * Mijoz boti (@Pack24AI_bot): ariza oqimi, mening arizalarim, punktlar, narxlar, aloqa. Tillar: uz, ru.
 * Suhbat holati bazada (BotSession): {lang, step, draft}. Til har doim saqlanadi, step/draft oqim tugaganda tozalanadi.
 */
export const bot = createBot('customer');

const TOTAL_STEPS = 7;
const me = (ctx: Ctx) => String(ctx.from.id);
/** Summa va kg yorlig'i tilga qarab */
const money = (v: unknown, lang: CustLang) => formatPrice(v as number, lang === 'ru' ? 'сум' : "so'm");
const kg = (lang: CustLang) => (lang === 'ru' ? 'кг' : 'kg');

// ─── Sessiya ─────────────────────────────────────────────────────────────────

async function load(ctx: Ctx): Promise<CustSession> {
  const s = await ctx.session<CustSession>();
  return s && isCustLang(s.lang) ? s : { lang: 'uz' };
}
const save = (ctx: Ctx, s: CustSession) => ctx.setSession(s);
/** Oqimni tozalash: faqat til qoladi */
const reset = (ctx: Ctx, lang: CustLang) => ctx.setSession<CustSession>({ lang });

// ─── Klaviaturalar ───────────────────────────────────────────────────────────

const menuKb = (lang: CustLang) => {
  const m = T[lang].menu;
  return keyboard([[m.request], [m.myRequests, m.points], [m.prices, m.contact], [m.lang]]);
};
const navKb = (lang: CustLang, extra: (string | ReplyButton)[][] = [], withBack = true) =>
  keyboard([...extra, withBack ? [T[lang].back, T[lang].cancel] : [T[lang].cancel]], { one_time_keyboard: true });
const navInline = (lang: CustLang, withBack = true): InlineKeyboard[number] => [
  ...(withBack ? [{ text: T[lang].back, callback_data: 'nav_back' }] : []),
  { text: T[lang].cancel, callback_data: 'nav_cancel' },
];
const langInline: InlineKeyboard = [[{ text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' }, { text: '🇷🇺 Русский', callback_data: 'lang_ru' }]];

async function showMenu(ctx: Ctx, lang: CustLang, text?: string) {
  await ctx.reply(text ?? T[lang].menuTitle, { reply_markup: menuKb(lang) });
}
const askLang = (ctx: Ctx) => ctx.reply(T.uz.langPrompt, { reply_markup: { inline_keyboard: langInline } });

// ─── Punkt ko'rinishi ────────────────────────────────────────────────────────

const pointName = (p: RecyclePoint, lang: CustLang) => (lang === 'ru' ? p.cityRu || p.cityUz : p.cityUz);
const pointRegion = (p: RecyclePoint, lang: CustLang) => (lang === 'ru' ? p.regionRu || p.regionUz : p.regionUz);
function pointHtml(p: RecyclePoint, lang: CustLang): string {
  const L = T[lang];
  const lines = [`🏭 <b>${esc(pointName(p, lang))}</b> · ${esc(pointRegion(p, lang))}`];
  if (p.address) lines.push(`📍 ${esc(p.address)}`);
  lines.push(`${L.hours} ${esc(p.workingHours)}`, `☎️ ${esc(displayPhone(p.phone))}`, `💵 ${money(p.pricePerKg, lang)}/${kg(lang)}`);
  if (!p.isAccepting) lines.push(lang === 'ru' ? '⏸ Сейчас приём приостановлен' : "⏸ Hozir qabul to'xtatilgan");
  return lines.join('\n');
}
const activePoints = () => prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });
/** Ariza uchun tanlanadigan punktlar: qabul qilayotganlar; bo'lmasa barcha faol punktlar (pickPoint kabi) */
async function pointsForChoice() {
  const points = await activePoints();
  const accepting = points.filter((p) => p.isAccepting);
  return accepting.length ? accepting : points;
}
const pointButton = (p: RecyclePoint, lang: CustLang) =>
  `🏭 ${pointName(p, lang)}${p.address ? ` · ${p.address}` : ''}${p.isAccepting ? '' : ` ${T[lang].pointPaused}`}`.slice(0, 60);

// ─── Ariza oqimi ─────────────────────────────────────────────────────────────

/** Qadamga o'tish: sessiyani saqlab, qadam savolini yuboradi */
async function gotoStep(ctx: Ctx, s: CustSession, step: CustStep) {
  s.step = step;
  s.draft ??= {};
  await save(ctx, s);
  const L = T[s.lang];
  const d = s.draft;
  switch (step) {
    case 'phone':
      return ctx.reply(`${L.stepOf(1, TOTAL_STEPS)} ${L.askPhone}`, { reply_markup: navKb(s.lang, [[{ text: L.sharePhone, request_contact: true }]], false) });
    case 'name':
      return ctx.reply(`${L.stepOf(2, TOTAL_STEPS)} ${L.askName}`, {
        reply_markup: { inline_keyboard: [[{ text: L.nameButton(tgName(ctx.from)), callback_data: 'name_use' }], navInline(s.lang)] },
      });
    case 'material':
      return ctx.reply(`${L.stepOf(3, TOTAL_STEPS)} ${L.askMaterial}`, {
        reply_markup: { inline_keyboard: [...chunk(MATERIALS.map((m) => ({ text: materialLabels[s.lang][m], callback_data: `mat_${m}` })), 2), navInline(s.lang)] },
      });
    case 'volume':
      return ctx.reply(`${L.stepOf(4, TOTAL_STEPS)} ${L.askVolume}`, {
        reply_markup: { inline_keyboard: [VOLUME_OPTIONS.map((v) => ({ text: `${v} ${kg(s.lang)}`, callback_data: `vol_${v}` })), [{ text: L.volOther, callback_data: 'vol_other' }], navInline(s.lang)] },
      });
    case 'volume_custom':
      return ctx.reply(L.askVolumeCustom, { reply_markup: navKb(s.lang) });
    case 'pickup':
      return ctx.reply(`${L.stepOf(5, TOTAL_STEPS)} ${L.askPickup}`, {
        reply_markup: { inline_keyboard: [[{ text: L.pickupBase, callback_data: 'pt_base' }], [{ text: L.pickupPickup, callback_data: 'pt_pickup' }], navInline(s.lang)] },
      });
    case 'point': {
      const points = await pointsForChoice();
      return ctx.reply(`${L.stepOf(6, TOTAL_STEPS)} ${L.askPoint}`, {
        reply_markup: { inline_keyboard: [...points.map((p) => [{ text: pointButton(p, s.lang), callback_data: `point_${p.id}` }]), navInline(s.lang)] },
      });
    }
    case 'location':
      return ctx.reply(`${L.stepOf(6, TOTAL_STEPS)} ${L.askLocation}`, { reply_markup: navKb(s.lang, [[{ text: L.shareLocation, request_location: true }]]) });
    case 'photo':
      return ctx.reply(`${L.stepOf(7, TOTAL_STEPS)} ${L.askPhoto}`, { reply_markup: navKb(s.lang, [[L.skip]]) });
    case 'sending':
    case 'confirm':
      s.step = 'confirm';
      await save(ctx, s);
      return ctx.reply(await summaryHtml(s.lang, d), {
        reply_markup: { inline_keyboard: [[{ text: L.send, callback_data: 'req_send' }], [{ text: L.restart, callback_data: 'req_restart' }], navInline(s.lang)] },
      });
    case 'dispute':
      // E'tiroz izohi: ariza tanlanmagan bo'lsa — menyu
      if (!s.disputeId) return cancelFlow(ctx, s);
      return ctx.reply(L.askDisputeComment(s.disputeId), { reply_markup: keyboard([[L.skipComment], [L.cancel]], { one_time_keyboard: true }) });
    default:
      return;
  }
}

async function summaryHtml(lang: CustLang, d: CustDraft): Promise<string> {
  const L = T[lang];
  const S = L.sum;
  const lines = [L.confirmTitle, `${S.phone}: ${esc(displayPhone(d.phone ?? ''))}`, `${S.name}: ${esc(d.name ?? '')}`];
  if (d.material) lines.push(`${S.material}: ${esc(materialLabels[lang][d.material])}`);
  lines.push(`${S.volume}: ${d.volume ? `~${d.volume} ${kg(lang)}` : S.notSet}`);
  lines.push(`${S.pickup}: ${esc(pickupTypeLabels[lang][d.pickupType ?? 'base'])}`);
  if (d.pickupType === 'pickup') {
    if (d.lat != null && d.lng != null) lines.push(`${S.location}: ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`);
    if (d.address) lines.push(`${S.address}: ${esc(d.address)}`);
  }
  if (d.pointName) lines.push(`${S.point}: ${esc(d.pointName)}${d.km != null ? ` (~${formatKm(d.km)} km)` : ''}`);
  lines.push(`${S.photo}: ${d.photoUrl ? S.yes : S.no}`);
  return lines.join('\n');
}

/** Oqimni boshlash */
async function startFlow(ctx: Ctx, s: CustSession) {
  s.draft = {};
  await gotoStep(ctx, s, 'phone');
}

/** Oqimni bekor qilish → bosh menyu */
async function cancelFlow(ctx: Ctx, s: CustSession) {
  const L = T[s.lang];
  const text = s.step === 'dispute' ? L.disputeCancelled : s.step ? L.flowCancelled : undefined;
  await reset(ctx, s.lang);
  await showMenu(ctx, s.lang, text);
}

/** Orqaga: oldingi qadam (yo'q bo'lsa — menyu) */
async function goBack(ctx: Ctx, s: CustSession) {
  const prev = s.step ? prevStep(s.step, s.draft ?? {}) : null;
  if (!prev) return cancelFlow(ctx, s);
  await gotoStep(ctx, s, prev);
}

/** Pickup turi tanlangach: base → punkt (bitta bo'lsa avtomatik), pickup → joylashuv */
async function afterPickupType(ctx: Ctx, s: CustSession) {
  const d = s.draft!;
  if (d.pickupType === 'pickup') return gotoStep(ctx, s, 'location');
  const points = await pointsForChoice();
  if (points.length > 1) return gotoStep(ctx, s, 'point');
  const p = points[0];
  if (p) { d.pointId = p.id; d.pointName = pointName(p, s.lang); d.km = null; }
  await gotoStep(ctx, s, 'photo');
}

/**
 * "Yuborish" qadamini atomik band qilish: sessiya step hali 'confirm' bo'lsa 'sending' ga o'tkazadi.
 * Ikki parallel bosishdan faqat bittasi o'tadi (ikkinchisi uchun count = 0).
 */
async function claimSending(ctx: Ctx, s: CustSession): Promise<boolean> {
  const { count } = await prisma.botSession.updateMany({
    where: { bot: ctx.kind, telegramId: me(ctx), data: { path: ['step'], equals: 'confirm' } },
    data: { data: { ...s, step: 'sending' } as unknown as Prisma.InputJsonValue },
  });
  return count > 0;
}

/** Yakuniy yuborish */
async function submit(ctx: Ctx, s: CustSession) {
  const L = T[s.lang];
  const d = s.draft ?? {};
  if (!d.phone || !d.name || !d.pickupType) return startFlow(ctx, s);
  if (!(await claimSending(ctx, s))) return ctx.answer(L.stale, true);
  s.step = 'sending';
  const active = await prisma.recycleRequest.count({ where: { customerTgId: me(ctx), status: { in: ACTIVE_STATUSES } } });
  if (active >= 5) {
    await ctx.answer(L.tooMany, true);
    await reset(ctx, s.lang);
    await ctx.edit(await summaryHtml(s.lang, d));
    return showMenu(ctx, s.lang, L.tooMany);
  }
  try {
    const { request, token } = await createRequest({
      name: d.name, phone: d.phone, pointId: d.pointId ?? null, material: d.material ?? null, volume: d.volume ?? null,
      pickupType: d.pickupType,
      pickupLocationMode: d.pickupType === 'pickup' ? (d.lat != null ? 'gps' : 'text') : null,
      address: d.address ?? null, pickupLat: d.lat ?? null, pickupLng: d.lng ?? null, photoUrl: d.photoUrl ?? null,
      customerTgId: me(ctx), customerLang: s.lang, source: 'bot',
    });
    await reset(ctx, s.lang);
    await ctx.edit(`${await summaryHtml(s.lang, d)}\n\n${L.sent}`);
    const lines = [L.created(request.id)];
    const url = trackingUrl(token, s.lang);
    if (url) lines.push(L.trackLine(url));
    if (request.point) lines.push(L.pointLine(esc(pointName(request.point, s.lang)), request.point.address ? esc(request.point.address) : null, esc(request.point.workingHours), esc(displayPhone(request.point.phone))));
    lines.push('', L.afterCreate);
    await ctx.reply(lines.join('\n'), { reply_markup: menuKb(s.lang) });
  } catch (e) {
    if (!(e instanceof RequestError)) {
      // Kutilmagan xato: 'sending' da qolib ketmasin
      await reset(ctx, s.lang);
      throw e;
    }
    const min = (await getSettings()).recyclingPickupMinKg;
    const msg = e.code === 'min_volume' ? L.errors.min_volume(min) : e.code === 'phone' || e.code === 'name' || e.code === 'point' || e.code === 'location' ? L.errors[e.code] : L.errors.unknown;
    await ctx.answer(msg, true);
    if (e.code === 'min_volume') return gotoStep(ctx, s, 'pickup');
    if (e.code === 'location') return gotoStep(ctx, s, 'location');
    if (e.code === 'phone') return gotoStep(ctx, s, 'phone');
    if (e.code === 'name') return gotoStep(ctx, s, 'name');
    await reset(ctx, s.lang);
    await showMenu(ctx, s.lang, msg);
  }
}

// ─── Mening arizalarim ───────────────────────────────────────────────────────

type ReqFull = RequestWithRefs & { collections?: RecycleCollection[] };

/** Mijoz bekor qila olmaydigan holat uchun sabab matni (bekor qilish mumkin bo'lsa null) */
function cancelBlocked(L: CustTexts, status: RecycleRequestStatus): string | null {
  if (['new_', 'dispatched', 'assigned'].includes(status)) return null;
  if (TERMINAL_STATUSES.includes(status)) return L.alreadyFinished;
  if (['collected', 'confirmed', 'disputed'].includes(status)) return L.cantCancelWeighed;
  return L.cantCancel;
}

function requestButtons(r: ReqFull, lang: CustLang): InlineKeyboard {
  const L = T[lang];
  const rows: InlineKeyboard = [];
  if (['new_', 'dispatched', 'assigned'].includes(r.status)) rows.push([{ text: L.cancelReq, callback_data: `cust_cancel_${r.id}` }]);
  if (r.status === 'collected') rows.push([{ text: L.confirmWeigh, callback_data: `cust_ok_${r.id}` }, { text: L.disputeWeigh, callback_data: `cust_no_${r.id}` }]);
  const url = trackingUrl(r.accessToken, lang);
  if (url) rows.push([{ text: L.trackBtn, url }]);
  rows.push([{ text: L.toList, callback_data: 'cust_list' }]);
  return rows;
}

function collectionLines(c: RecycleCollection, lang: CustLang): string {
  const L = T[lang];
  const lines = [L.weighTitle, `⚖️ ${L.weigh.actual}: <b>${c.actualWeight} ${kg(lang)}</b>`];
  if (c.discountPercent > 0) lines.push(`➖ ${L.weigh.discount}: ${c.discountPercent}%${c.discountReason ? ` (${esc(c.discountReason)})` : ''} → ${c.effectiveWeight} ${kg(lang)}`);
  lines.push(`💵 ${L.weigh.price}: ${money(c.pricePerKg, lang)}/${kg(lang)}`, `💰 ${L.weigh.total}: <b>${money(c.totalAmount, lang)}</b>`);
  return lines.join('\n');
}

function requestDetailHtml(r: ReqFull, lang: CustLang): string {
  const parts = [requestCardHtml(r, { forCustomer: true, locale: lang })];
  const c = r.collections?.[0];
  if (c && ['collected', 'confirmed', 'disputed', 'completed'].includes(r.status)) parts.push('', collectionLines(c, lang));
  return parts.join('\n');
}

const findOwn = (ctx: Ctx, id: number) =>
  prisma.recycleRequest.findFirst({ where: { id, customerTgId: me(ctx) }, include: { ...REQUEST_INCLUDE, collections: { orderBy: { id: 'desc' }, take: 1 } } });

async function listRequests(ctx: Ctx, lang: CustLang, edit = false) {
  const L = T[lang];
  const rows = await prisma.recycleRequest.findMany({ where: { customerTgId: me(ctx) }, orderBy: { id: 'desc' }, take: 10 });
  if (!rows.length) {
    if (edit) await ctx.edit(L.myRequestsEmpty);
    else await ctx.reply(L.myRequestsEmpty, { reply_markup: menuKb(lang) });
    return;
  }
  const text = [L.myRequestsTitle, ...rows.map((r) => `#${r.id} · ${esc(statusLabels[lang][r.status])} · ${formatDate(r.createdAt, lang)}${r.volume ? ` · ~${r.volume} ${kg(lang)}` : ''}`)].join('\n');
  const kb = chunk(rows.map((r) => ({ text: L.view(r.id), callback_data: `cust_view_${r.id}` })), 3);
  if (edit) await ctx.edit(text, kb);
  else await ctx.reply(text, { reply_markup: { inline_keyboard: kb } });
}

async function showRequest(ctx: Ctx, lang: CustLang, r: ReqFull, edit: boolean) {
  const html = requestDetailHtml(r, lang);
  if (edit) await ctx.edit(html, requestButtons(r, lang));
  else await ctx.reply(html, { reply_markup: { inline_keyboard: requestButtons(r, lang) } });
}

/**
 * /start <token>: kuzatuv sahifasidan kelgan — arizani shu Telegram'ga bog'laymiz.
 * Natija: 'linked' (bog'landi yoki allaqachon o'ziniki), 'foreign' (boshqa hisobniki), 'none' (token noto'g'ri).
 */
async function linkByToken(ctx: Ctx, token: string, existing: CustSession | null): Promise<{ status: 'linked' | 'foreign' | 'none'; lang: CustLang }> {
  const fallback = existing?.lang ?? 'uz';
  const r = await requestByToken(token);
  if (!r) return { status: 'none', lang: fallback };
  // Yangi foydalanuvchi uchun til — arizada tanlangan til (en bo'lsa uz)
  const lang: CustLang = existing?.lang ?? (r.customerLang === 'ru' ? 'ru' : 'uz');
  const id = me(ctx);
  if (!r.customerTgId) {
    await prisma.recycleRequest.update({ where: { id: r.id }, data: { customerTgId: id } });
    r.customerTgId = id;
  } else if (r.customerTgId !== id) {
    await ctx.reply(T[lang].linkedOther);
    return { status: 'foreign', lang };
  }
  await ctx.reply(`${T[lang].linked}\n\n${requestDetailHtml(r, lang)}`, { reply_markup: { inline_keyboard: requestButtons(r, lang) } });
  return { status: 'linked', lang };
}

// ─── Ma'lumot bo'limlari ─────────────────────────────────────────────────────

async function showPoints(ctx: Ctx, lang: CustLang) {
  const L = T[lang];
  const points = await activePoints();
  if (!points.length) return ctx.reply(L.pointsEmpty, { reply_markup: menuKb(lang) });
  await ctx.reply([L.pointsTitle, '', points.map((p) => pointHtml(p, lang)).join('\n\n'), '', L.pointsHint].join('\n'), {
    reply_markup: keyboard([[{ text: L.findNearest, request_location: true }], [L.back]], { one_time_keyboard: true }),
  });
  for (const p of points.slice(0, 5)) if (p.lat != null && p.lng != null) await ctx.sendLocation(p.lat, p.lng);
}

/** Eng yaqin punkt; kb === null bo'lsa joriy klaviatura o'zgarmaydi (oqim o'rtasida), bo'lmasa bosh menyu */
async function showNearest(ctx: Ctx, lang: CustLang, lat: number, lng: number, kb: ReplyMarkup | null = menuKb(lang)) {
  const L = T[lang];
  const reply_markup = kb ?? undefined;
  const near = nearestPoint(await activePoints(), lat, lng);
  if (!near) return ctx.reply(L.pointsEmpty, { reply_markup });
  await ctx.reply(`${L.nearest(esc(pointName(near.point, lang)), formatKm(near.km))}\n\n${pointHtml(near.point, lang)}`, { reply_markup });
  if (near.point.lat != null && near.point.lng != null) await ctx.sendLocation(near.point.lat, near.point.lng);
}

async function showPrices(ctx: Ctx, lang: CustLang) {
  const L = T[lang];
  const [points, settings] = await Promise.all([activePoints(), getSettings()]);
  const lines = [L.pricesTitle, ''];
  if (points.length) lines.push(...points.map((p) => L.priceLine(esc(pointName(p, lang)), money(p.pricePerKg, lang))));
  else lines.push(L.pointsEmpty);
  lines.push('', L.minBase(settings.recyclingMinKg), L.minPickup(settings.recyclingPickupMinKg), '', `<i>${L.priceNote}</i>`);
  await ctx.reply(lines.join('\n'), { reply_markup: menuKb(lang) });
}

async function showContact(ctx: Ctx, lang: CustLang) {
  const L = T[lang];
  const s = await getSettings();
  const C = L.contact;
  const lines = [L.contactTitle, ''];
  if (s.phone) lines.push(`${C.phone} <a href="tel:+${esc(s.phone)}">${esc(displayPhone(s.phone))}</a>`);
  if (s.phone2) lines.push(`${C.phone} <a href="tel:+${esc(s.phone2)}">${esc(displayPhone(s.phone2))}</a>`);
  const address = pickText(s.address, lang);
  if (address) lines.push(`${C.address} ${esc(address)}`);
  const hours = pickText(s.workHours, lang);
  if (hours) lines.push(`${C.hours} ${esc(hours)}`);
  if (s.email) lines.push(`${C.email} ${esc(s.email)}`);
  if (s.telegramBot) lines.push(`${C.bot} @${esc(s.telegramBot.replace(/^@/, ''))}`);
  await ctx.reply(lines.join('\n'), { reply_markup: menuKb(lang) });
}

// ─── Buyruqlar va menyu ──────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const raw = await ctx.session<CustSession>();
  const existing = raw && isCustLang(raw.lang) ? raw : null;
  const arg = commandArg(ctx.text);
  if (arg) {
    const link = await linkByToken(ctx, arg, existing);
    if (link.status === 'linked') {
      // Til arizadan olindi — til tanlashsiz to'g'ridan-to'g'ri menyu
      await reset(ctx, link.lang);
      return showMenu(ctx, link.lang, existing ? undefined : T[link.lang].hello(esc(ctx.from.first_name)));
    }
  }
  const lang = existing?.lang ?? 'uz';
  await reset(ctx, lang);
  if (!existing) return askLang(ctx);
  await showMenu(ctx, lang, T[lang].hello(esc(ctx.from.first_name)));
});

bot.command('help', async (ctx) => {
  const s = await load(ctx);
  await ctx.reply(T[s.lang].help, { reply_markup: menuKb(s.lang) });
});

bot.command('requests', async (ctx) => {
  const s = await load(ctx);
  await reset(ctx, s.lang);
  await listRequests(ctx, s.lang);
});

/** Menyu tugmasi oqim o'rtasida bosilsa — oqim tozalanadi */
const menu = (h: (ctx: Ctx, lang: CustLang) => Promise<unknown>) => async (ctx: Ctx) => {
  const s = await load(ctx);
  if (s.step) await reset(ctx, s.lang);
  await h(ctx, s.lang);
};

bot.hears(menuTexts('request'), async (ctx) => startFlow(ctx, await load(ctx)));
bot.hears(menuTexts('myRequests'), menu((ctx, lang) => listRequests(ctx, lang)));
bot.hears(menuTexts('points'), menu((ctx, lang) => showPoints(ctx, lang)));
bot.hears(menuTexts('prices'), menu((ctx, lang) => showPrices(ctx, lang)));
bot.hears(menuTexts('contact'), menu((ctx, lang) => showContact(ctx, lang)));
bot.hears(menuTexts('lang'), menu((ctx) => askLang(ctx)));
bot.hears(BACK_TEXTS, async (ctx) => goBack(ctx, await load(ctx)));
bot.hears(CANCEL_TEXTS, async (ctx) => cancelFlow(ctx, await load(ctx)));

// ─── Kontakt / joylashuv / rasm ──────────────────────────────────────────────

bot.contact(async (ctx) => {
  const s = await load(ctx);
  const L = T[s.lang];
  // Boshqa qadamda kelgan kontakt: joriy savolni qayta ko'rsatamiz (jim qolmaymiz)
  if (s.step !== 'phone') return s.step ? gotoStep(ctx, s, s.step) : showMenu(ctx, s.lang, L.unknown);
  const phone = normalizePhone(ctx.message?.contact?.phone_number ?? '');
  if (!phone) return ctx.reply(L.badPhone);
  s.draft = { ...s.draft, phone };
  await gotoStep(ctx, s, 'name');
});

bot.location(async (ctx) => {
  const s = await load(ctx);
  const loc = ctx.message?.location;
  if (!loc) return;
  if (s.step !== 'location') {
    if (!s.step) return showNearest(ctx, s.lang, loc.latitude, loc.longitude);
    // Oqim o'rtasida: eng yaqin punktni ko'rsatib, joriy qadamda qolamiz
    await showNearest(ctx, s.lang, loc.latitude, loc.longitude, null);
    return gotoStep(ctx, s, s.step);
  }
  const d = (s.draft ??= {});
  d.lat = loc.latitude;
  d.lng = loc.longitude;
  d.address = undefined;
  const picked = await pickPoint(loc.latitude, loc.longitude);
  if (picked) {
    const p = await prisma.recyclePoint.findUnique({ where: { id: picked.point.id } });
    d.pointId = picked.point.id;
    d.pointName = p ? pointName(p, s.lang) : undefined;
    d.km = picked.km;
    if (p && picked.km != null) await ctx.reply(T[s.lang].nearest(esc(pointName(p, s.lang)), formatKm(picked.km)));
  }
  await gotoStep(ctx, s, 'photo');
});

bot.photo(async (ctx) => {
  const s = await load(ctx);
  if (!ctx.message?.photo?.length) return;
  // Rasm faqat rasm/xulosa qadamida qabul qilinadi; boshqa qadamda joriy savol qaytariladi
  if (s.step !== 'photo' && s.step !== 'confirm') return s.step ? gotoStep(ctx, s, s.step) : showMenu(ctx, s.lang, T[s.lang].unknown);
  const url = await storeTelegramPhoto(ctx.token, ctx.message.photo, 'recycling');
  s.draft = { ...s.draft, photoUrl: url };
  await ctx.reply(url ? T[s.lang].photoSaved : T[s.lang].photoFail);
  await gotoStep(ctx, s, 'confirm');
});

// ─── Matn: suhbat qadamlari ──────────────────────────────────────────────────

bot.text(async (ctx) => {
  const s = await load(ctx);
  const L = T[s.lang];
  const text = ctx.text;
  if (!s.step) return showMenu(ctx, s.lang, L.unknown);
  const d = (s.draft ??= {});
  switch (s.step) {
    case 'phone': {
      const phone = normalizePhone(text);
      if (!phone) return ctx.reply(L.badPhone);
      d.phone = phone;
      return gotoStep(ctx, s, 'name');
    }
    case 'name': {
      const name = text.trim().slice(0, 100);
      if (name.length < 2) return ctx.reply(L.badName);
      d.name = name;
      return gotoStep(ctx, s, 'material');
    }
    case 'volume':
    case 'volume_custom': {
      const n = parseNumber(text);
      if (!n || n > 100_000) return ctx.reply(L.badVolume);
      d.volume = Math.round(n);
      return gotoStep(ctx, s, 'pickup');
    }
    case 'location': {
      const address = text.slice(0, 500);
      if (address.length < 5) return ctx.reply(L.badAddress);
      d.address = address;
      d.lat = undefined;
      d.lng = undefined;
      d.km = null;
      const picked = await pickPoint();
      if (picked) {
        const p = await prisma.recyclePoint.findUnique({ where: { id: picked.point.id } });
        d.pointId = picked.point.id;
        d.pointName = p ? pointName(p, s.lang) : undefined;
      }
      return gotoStep(ctx, s, 'photo');
    }
    case 'photo':
      if (SKIP_TEXTS.includes(text)) { d.photoUrl = null; return gotoStep(ctx, s, 'confirm'); }
      return gotoStep(ctx, s, 'photo');
    case 'dispute': {
      const id = s.disputeId;
      if (!id) return cancelFlow(ctx, s);
      const comment = SKIP_COMMENT_TEXTS.includes(text) ? undefined : text.slice(0, 500);
      await reset(ctx, s.lang);
      try {
        await customerDecision(id, { telegramId: me(ctx) }, false, comment);
        return showMenu(ctx, s.lang, L.disputeSent(id));
      } catch (e) {
        if (!(e instanceof RequestError)) throw e;
        return showMenu(ctx, s.lang, e.code === 'status' ? L.cantDecide : L.notFound);
      }
    }
    default:
      // inline tanlov kutilayotgan qadamlar (material, pickup, point, confirm): savolni qayta ko'rsatamiz
      return gotoStep(ctx, s, s.step);
  }
});

// ─── Callback'lar ────────────────────────────────────────────────────────────

bot.callback('lang_', async (ctx) => {
  const lang = ctx.data.slice(5);
  if (!isCustLang(lang)) return;
  await reset(ctx, lang);
  await ctx.edit(T[lang].langSet);
  await showMenu(ctx, lang, T[lang].hello(esc(ctx.from.first_name)));
});

bot.callback('nav_back', async (ctx) => { await ctx.edit(ctx.message?.text ? esc(ctx.message.text) : '…'); await goBack(ctx, await load(ctx)); });
bot.callback('nav_cancel', async (ctx) => { await ctx.edit(ctx.message?.text ? esc(ctx.message.text) : '…'); await cancelFlow(ctx, await load(ctx)); });

/** Inline qadam callback'i: faqat kutilayotgan qadamda ishlaydi (eski tugmalar e'tiborsiz) */
const stepCb = (step: CustStep | CustStep[], h: (ctx: Ctx, s: CustSession) => Promise<unknown>) => async (ctx: Ctx) => {
  const s = await load(ctx);
  const steps = Array.isArray(step) ? step : [step];
  if (!s.step || !steps.includes(s.step)) return ctx.answer(T[s.lang].stale, true);
  s.draft ??= {};
  await h(ctx, s);
};

bot.callback('name_use', stepCb('name', async (ctx, s) => {
  s.draft!.name = tgName(ctx.from).slice(0, 100) || ctx.from.first_name;
  await ctx.edit(`${T[s.lang].sum.name}: ${esc(s.draft!.name)}`);
  await gotoStep(ctx, s, 'material');
}));

bot.callback('mat_', stepCb('material', async (ctx, s) => {
  const m = ctx.data.slice(4);
  if (!isMaterial(m)) return;
  s.draft!.material = m;
  await ctx.edit(`${T[s.lang].sum.material}: ${esc(materialLabels[s.lang][m])}`);
  await gotoStep(ctx, s, 'volume');
}));

bot.callback('vol_', stepCb('volume', async (ctx, s) => {
  const v = ctx.data.slice(4);
  if (v === 'other') { await ctx.edit(T[s.lang].askVolume); return gotoStep(ctx, s, 'volume_custom'); }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return;
  s.draft!.volume = n;
  await ctx.edit(`${T[s.lang].sum.volume}: ~${n} ${kg(s.lang)}`);
  await gotoStep(ctx, s, 'pickup');
}));

bot.callback('pt_', stepCb('pickup', async (ctx, s) => {
  const L = T[s.lang];
  const d = s.draft!;
  const kind = ctx.data.slice(3);
  if (kind === 'fixvol') { await ctx.edit(L.askPickup); return gotoStep(ctx, s, 'volume'); }
  if (kind === 'pickup') {
    const min = (await getSettings()).recyclingPickupMinKg;
    if (d.volume != null && d.volume < min) {
      return ctx.edit(L.pickupMinWarn(min, d.volume), [[{ text: L.pickupBase, callback_data: 'pt_base' }], [{ text: L.fixVolume, callback_data: 'pt_fixvol' }], navInline(s.lang)]);
    }
    d.pickupType = 'pickup';
  } else if (kind === 'base') {
    d.pickupType = 'base';
    d.lat = undefined; d.lng = undefined; d.address = undefined; d.km = null;
  } else return;
  await ctx.edit(`${L.sum.pickup}: ${esc(pickupTypeLabels[s.lang][d.pickupType])}`);
  await afterPickupType(ctx, s);
}));

bot.callback('point_', stepCb('point', async (ctx, s) => {
  const id = idFrom(ctx.data, 'point_');
  const p = id ? await prisma.recyclePoint.findFirst({ where: { id, status: 'active' } }) : null;
  if (!p) return ctx.answer(T[s.lang].notFound, true);
  s.draft!.pointId = p.id;
  s.draft!.pointName = pointName(p, s.lang);
  s.draft!.km = null;
  await ctx.edit(`${T[s.lang].sum.point}: ${esc(pointName(p, s.lang))}`);
  await gotoStep(ctx, s, 'photo');
}));

bot.callback('req_send', stepCb('confirm', (ctx, s) => submit(ctx, s)));
bot.callback('req_restart', stepCb('confirm', async (ctx, s) => {
  await ctx.edit(T[s.lang].restart);
  await startFlow(ctx, s);
}));

// Mening arizalarim
bot.callback('cust_list', async (ctx) => listRequests(ctx, (await load(ctx)).lang, true));

bot.callback('cust_view_', async (ctx) => {
  const s = await load(ctx);
  const id = idFrom(ctx.data, 'cust_view_');
  const r = id ? await findOwn(ctx, id) : null;
  if (!r) return ctx.answer(T[s.lang].notFound, true);
  await showRequest(ctx, s.lang, r, true);
});

bot.callback('cust_cancel_', async (ctx) => {
  const s = await load(ctx);
  const L = T[s.lang];
  const id = idFrom(ctx.data, 'cust_cancel_');
  const r = id ? await getRequest(id) : null;
  if (!r || !ownsRequest(r, { telegramId: me(ctx) })) return ctx.answer(L.notFound, true);
  const blocked = cancelBlocked(L, r.status);
  if (blocked) {
    // Eskirgan tugma: sababini aytamiz va kartani joriy holat bilan yangilaymiz
    await ctx.answer(blocked, true);
    const fresh = await findOwn(ctx, r.id);
    if (fresh) await showRequest(ctx, s.lang, fresh, true);
    return;
  }
  try {
    const updated = await cancelRequest(r.id, { kind: 'customer', name: r.name });
    await ctx.answer(L.cancelledOk(r.id));
    await showRequest(ctx, s.lang, updated, true);
  } catch (e) {
    if (!(e instanceof RequestError)) throw e;
    if (e.code !== 'status') return ctx.answer(L.notFound, true);
    // Poyga: holat shu orada o'zgargan — yangi holatga qarab sabab
    const fresh = await findOwn(ctx, r.id);
    await ctx.answer(fresh ? cancelBlocked(L, fresh.status) ?? L.cantCancel : L.notFound, true);
    if (fresh) await showRequest(ctx, s.lang, fresh, true);
  }
});

bot.callback('cust_ok_', async (ctx) => {
  const s = await load(ctx);
  const L = T[s.lang];
  const id = idFrom(ctx.data, 'cust_ok_');
  if (!id) return;
  try {
    await customerDecision(id, { telegramId: me(ctx) }, true);
    const r = await findOwn(ctx, id);
    await ctx.edit(`${r ? requestDetailHtml(r, s.lang) : ''}\n\n${L.confirmedOk(id)}`, r ? requestButtons(r, s.lang) : undefined);
  } catch (e) {
    if (!(e instanceof RequestError)) throw e;
    await ctx.answer(e.code === 'status' ? L.cantDecide : L.notFound, true);
  }
});

bot.callback('cust_no_', async (ctx) => {
  const s = await load(ctx);
  const L = T[s.lang];
  const id = idFrom(ctx.data, 'cust_no_');
  const r = id ? await findOwn(ctx, id) : null;
  if (!r) return ctx.answer(L.notFound, true);
  if (r.status !== 'collected') return ctx.answer(L.cantDecide, true);
  s.disputeId = r.id;
  s.draft = undefined;
  await gotoStep(ctx, s, 'dispute');
});
