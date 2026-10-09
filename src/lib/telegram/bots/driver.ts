import 'server-only';
import type { Driver, RecyclePoint, Supervisor } from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayPhone, formatDate, normalizePhone, toNumber } from '@/lib/format';
import { createAccessRequest } from '@/lib/recycling/access';
import { recordWeighing } from '@/lib/recycling/collections';
import { acceptTask, driverTasks, markArrived, rejectTask, setDriverOnline, startCollecting, startEnRoute, updateDriverLocation } from '@/lib/recycling/driverTasks';
import { yandexMapsUrl } from '@/lib/recycling/geo';
import { requestCardHtml, type RequestWithRefs } from '@/lib/recycling/notifications';
import { getRequest, REQUEST_INCLUDE, RequestError } from '@/lib/recycling/requests';
import { driverByTelegram, issueDriverCredentials, registerByCode, resetDriverPassword, StaffError } from '@/lib/recycling/staff';
import { TERMINAL_STATUSES } from '@/lib/recycling/statuses';
import { addCard, cardTypeFromNumber, driverBalance, driverCards, driverTransactions, maskCard, MIN_WITHDRAWAL, requestWithdrawal, WalletError } from '@/lib/recycling/wallet';
import { siteUrl } from '@/lib/site';
import { esc, keyboard, type InlineKeyboard } from '../api';
import { createBot, idFrom, type Ctx } from '../router';
import { cardParts, fmtSum, parseExpiry, parseNumber, tgName } from './cdCommon';
import {
  cardTypeLabel, D, DISCOUNT_OPTIONS, DISCOUNT_REASONS, discountReasonLabel, driverStatusLabel, M, prevDrvStep, REJECT_REASONS, rejectReasonLabel,
  txStatusLabel, txTypeLabel, weighPreview, type DrvSession, type DrvStep,
} from './driverFlow';

/**
 * Haydovchi boti (@pack24MX_bot): ro'yxatdan o'tish (kod + kontakt), topshiriqlar, tortish kalkulyatori,
 * onlayn/oflayn, GPS, hamyon, kartalar, kabinet paroli. Faqat o'zbek.
 * Suhbat qadamlari sessiyada (DrvSession.step); har qadamda "Orqaga" (prevDrvStep) va "Bekor qilish" bor.
 */
export const bot = createBot('driver');

type DriverFull = Driver & { point: RecyclePoint | null; supervisor: Supervisor | null };

const cabinetUrl = () => `${siteUrl()}/driver`;
const sess = async (ctx: Ctx): Promise<DrvSession> => (await ctx.session<DrvSession>()) ?? {};
const getDriver = (ctx: Ctx) => driverByTelegram(ctx.from.id);
/** Tortish/yakun mumkin bo'lmagan yakuniy holatlar (tugma eskirgan) */
const FINISHED = [...TERMINAL_STATUSES, 'confirmed'] as string[];

// ─── Klaviaturalar ───────────────────────────────────────────────────────────

const menuKb = (d: { isOnline: boolean }) =>
  keyboard([
    [M.tasks, M.weigh],
    [d.isOnline ? M.goOffline : M.goOnline, M.wallet],
    [{ text: M.sendLocation, request_location: true }, M.password],
    [M.info],
  ]);
const guestKb = keyboard([[M.accessRequest]]);
/** Matn qadamlari: Orqaga (oldingi qadam bo'lsa) + Bekor */
const navKb = (back: boolean, extra: string[][] = []) => keyboard([...extra, back ? [M.back, M.cancel] : [M.cancel]], { one_time_keyboard: true });
const contactKb = (back: boolean) => keyboard([[{ text: M.shareContact, request_contact: true }], back ? [M.back, M.cancel] : [M.cancel]], { one_time_keyboard: true });
/** Inline qadamlar uchun navigatsiya qatori */
const navInline = (back: boolean): InlineKeyboard[number] => [
  ...(back ? [{ text: D.btn.back, callback_data: 'nav_back' }] : []),
  { text: D.btn.cancel, callback_data: 'nav_cancel' },
];

const showMenu = (ctx: Ctx, d: { isOnline: boolean }, text: string = D.menuHint) => ctx.reply(text, { reply_markup: menuKb(d) });

const hasPendingAccess = (ctx: Ctx) =>
  prisma.botAccessRequest.findFirst({ where: { role: 'driver', telegramId: String(ctx.from.id), status: 'pending' }, select: { id: true } });

/** Ro'yxatdan o'tmagan foydalanuvchi: kod kiritish holati */
async function guestStart(ctx: Ctx) {
  const pending = await hasPendingAccess(ctx);
  await ctx.setSession<DrvSession>({ step: 'reg_code' });
  await ctx.reply(pending ? `${D.regPending}\n\n${D.regIntro}` : D.regIntro, { reply_markup: guestKb });
}

// ─── Qadamlar ────────────────────────────────────────────────────────────────

/** Qadamga o'tish: sessiyani saqlab, qadam savolini (Orqaga/Bekor bilan) yuboradi */
async function gotoStep(ctx: Ctx, s: DrvSession, step: DrvStep) {
  s.step = step;
  await ctx.setSession(s);
  const back = !!prevDrvStep(step, s);
  switch (step) {
    case 'reg_code':
      return ctx.reply(D.regIntro, { reply_markup: guestKb });
    case 'reg_phone':
      return ctx.reply(D.askRegPhone, { reply_markup: contactKb(back) });
    case 'acc_name':
      return ctx.reply(D.askAccName, { reply_markup: navKb(back) });
    case 'acc_phone':
      return ctx.reply(D.askAccPhone, { reply_markup: contactKb(back) });
    case 'acc_point': {
      const points = await prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });
      return ctx.reply(D.askAccPoint, {
        reply_markup: { inline_keyboard: [...points.map((p) => [{ text: `🏭 ${p.cityUz}${p.address ? ` · ${p.address}` : ''}`.slice(0, 60), callback_data: `accpt_${p.id}` }]), [{ text: D.noPoint, callback_data: 'accpt_0' }], navInline(back)] },
      });
    }
    case 'acc_vehicle':
      return ctx.reply(D.askVehicle, { reply_markup: navKb(back, [[M.skip]]) });
    case 'weigh_weight':
      return ctx.reply(D.askWeight(s.weigh?.requestId ?? 0, esc(s.weigh?.name ?? '')), { reply_markup: navKb(back) });
    case 'weigh_discount':
      return ctx.reply(D.askDiscount(s.weigh?.weight ?? 0), {
        reply_markup: { inline_keyboard: [DISCOUNT_OPTIONS.map((p) => ({ text: `${p}%`, callback_data: `disc_${p}` })), navInline(back)] },
      });
    case 'weigh_reason':
      return ctx.reply(D.askDiscountReason, {
        reply_markup: { inline_keyboard: [DISCOUNT_REASONS.map((x) => ({ text: x.label, callback_data: `dreason_${x.key}` })), navInline(back)] },
      });
    case 'weigh_reason_text':
      return ctx.reply(D.askDiscountText, { reply_markup: navKb(back) });
    case 'weigh_confirm':
      return showWeighConfirm(ctx, s);
    case 'reject_text':
      return ctx.reply(D.askRejectText, { reply_markup: navKb(back) });
    case 'wd_amount': {
      const d = await getDriver(ctx);
      const { balance } = d ? await driverBalance(d.id) : { balance: 0 };
      return ctx.reply(D.askAmount(fmtSum(balance), fmtSum(MIN_WITHDRAWAL)), { reply_markup: navKb(back, [[D.allBalance(fmtSum(balance))]]) });
    }
    case 'card_number':
      return ctx.reply(D.askCardNumber, { reply_markup: navKb(back) });
    case 'card_holder':
      return ctx.reply(D.askHolder(maskCard(s.card?.last4 ?? '0000'), cardTypeLabel[cardTypeFromNumber(s.card?.first4 ?? '')]), { reply_markup: navKb(back) });
    case 'card_expiry':
      return ctx.reply(D.askExpiry, { reply_markup: navKb(back) });
    default:
      return;
  }
}

/** Oqimni bekor qilish → menyu (mehmon bo'lsa kod kiritish holati) */
async function cancelFlow(ctx: Ctx, text: string = D.cancelled) {
  await ctx.clearSession();
  const d = await getDriver(ctx);
  if (d) return showMenu(ctx, d, text);
  await guestStart(ctx);
}

/** Orqaga: oldingi qadam (yo'q bo'lsa — bekor) */
async function goBack(ctx: Ctx, s: DrvSession) {
  const prev = s.step ? prevDrvStep(s.step, s) : null;
  if (!prev) return cancelFlow(ctx);
  await gotoStep(ctx, s, prev);
}

// ─── Topshiriqlar ────────────────────────────────────────────────────────────

function taskButtons(r: RequestWithRefs): InlineKeyboard {
  const B = D.btn;
  const rows: InlineKeyboard = [];
  if (r.status === 'assigned') rows.push([{ text: B.accept, callback_data: `accept_${r.id}` }, { text: B.reject, callback_data: `reject_${r.id}` }], [{ text: B.enroute, callback_data: `enroute_${r.id}` }]);
  else if (r.status === 'en_route') rows.push([{ text: B.arrived, callback_data: `arrived_${r.id}` }]);
  else if (r.status === 'arrived' || r.status === 'collecting') rows.push([{ text: B.weigh, callback_data: `weigh_${r.id}` }]);
  if (r.pickupType === 'pickup' && r.pickupLat != null && r.pickupLng != null) rows.push([{ text: B.map, url: yandexMapsUrl(r.pickupLat, r.pickupLng) }]);
  return rows;
}

async function showTasks(ctx: Ctx, d: DriverFull) {
  const tasks = await driverTasks(d.id);
  if (!tasks.length) return showMenu(ctx, d, D.noTasks);
  await ctx.reply(D.tasksTitle(tasks.length), { reply_markup: menuKb(d) });
  for (const r of tasks) await ctx.reply(requestCardHtml(r), { reply_markup: { inline_keyboard: taskButtons(r) } });
}

/** Callback'dagi ariza shu haydovchiniki ekanini tekshirish */
async function ownTask(ctx: Ctx, d: DriverFull, prefix: string): Promise<RequestWithRefs | null> {
  const id = idFrom(ctx.data, prefix);
  const r = id ? await getRequest(id) : null;
  if (!r || r.assignedDriverId !== d.id) {
    await ctx.answer(D.notYours, true);
    return null;
  }
  return r;
}

/** Callback uchun haydovchi; yo'q bo'lsa ogohlantiradi */
async function cbDriver(ctx: Ctx): Promise<DriverFull | null> {
  const d = await getDriver(ctx);
  if (!d) await ctx.answer(D.notRegistered, true);
  return d;
}

const reqErr = (e: unknown) => (e instanceof RequestError ? (e.code === 'driver' ? D.notYours : e.message) : null);

// ─── Tortish ─────────────────────────────────────────────────────────────────

async function startWeigh(ctx: Ctx, d: DriverFull, id: number) {
  const r = await getRequest(id);
  if (!r || r.assignedDriverId !== d.id) return ctx.answer(D.notYours, true);
  if (FINISHED.includes(r.status)) return ctx.answer(D.requestFinished, true);
  if (!['arrived', 'collecting', 'collected', 'disputed'].includes(r.status)) return ctx.answer(D.weighOnlyAfterArrive, true);
  if (r.status === 'arrived') await startCollecting(r.id, d.id).catch(() => null);
  await gotoStep(ctx, { weigh: { requestId: r.id, name: r.name } }, 'weigh_weight');
}

async function showWeighConfirm(ctx: Ctx, s: DrvSession) {
  const w = s.weigh;
  const r = w ? await prisma.recycleRequest.findUnique({ where: { id: w.requestId }, include: REQUEST_INCLUDE }) : null;
  if (!w || !r) { await ctx.clearSession(); return ctx.reply(D.notYours); }
  const price = toNumber(r.point.pricePerKg);
  const p = weighPreview(w.weight ?? 0, w.discount ?? 0, price, toNumber(r.point.driverRatePerKg));
  await ctx.reply(D.weighSummary({ id: r.id, name: esc(r.name), weight: p.weight, discount: p.discount, reason: w.reason ? esc(w.reason) : null, effective: p.effective, price, total: fmtSum(p.total), earning: fmtSum(p.earning) }), {
    reply_markup: { inline_keyboard: [[{ text: D.btn.save, callback_data: 'wgh_save' }], [{ text: D.btn.redo, callback_data: 'wgh_redo' }], navInline(true)] },
  });
}

/** "⚖️ Tortish" menyusi: avval joriy (yetib kelgan / e'tirozli) arizalar, keyin oxirgi 3 ta tortilgan (qayta tortish uchun) */
async function weighMenu(ctx: Ctx, d: DriverFull) {
  const [active, recent] = await Promise.all([
    prisma.recycleRequest.findMany({ where: { assignedDriverId: d.id, status: { in: ['arrived', 'collecting', 'disputed'] } }, orderBy: { id: 'desc' }, take: 20 }),
    prisma.recycleRequest.findMany({ where: { assignedDriverId: d.id, status: 'collected' }, orderBy: { id: 'desc' }, take: 3 }),
  ]);
  const rows = [...active, ...recent];
  if (!rows.length) return showMenu(ctx, d, D.noWeigh);
  await ctx.reply(D.chooseWeigh, {
    reply_markup: { inline_keyboard: rows.map((r) => [{ text: `#${r.id} · ${r.name}${r.status === 'collected' || r.status === 'disputed' ? ` ${D.weighRedo}` : ''}`.slice(0, 60), callback_data: `weigh_${r.id}` }]) },
  });
}

// ─── Hamyon ──────────────────────────────────────────────────────────────────

async function showWallet(ctx: Ctx, d: DriverFull) {
  const [bal, txs, cards] = await Promise.all([driverBalance(d.id), driverTransactions(d.id, 5), driverCards(d.id)]);
  const W = D.wallet;
  const lines = [
    D.walletTitle,
    `💵 ${W.balance}: <b>${fmtSum(bal.balance)}</b>`,
    `📈 ${W.earned}: ${fmtSum(bal.earned)} · 📤 ${W.withdrawn}: ${fmtSum(bal.withdrawn)}${bal.pending ? ` · ⏳ ${W.pending}: ${fmtSum(bal.pending)}` : ''}`,
    '',
    `<b>${W.recent}</b>`,
    ...(txs.length ? txs.map((t) => `${txStatusLabel[t.status]} ${txTypeLabel[t.type]}: ${t.type === 'withdrawal' ? '−' : '+'}${fmtSum(t.amount)} · ${formatDate(t.createdAt, 'uz')}${t.description ? ` · ${esc(t.description)}` : ''}`) : [W.none]),
    '',
    `<b>${W.cards}</b>`,
    ...(cards.length ? cards.map((c) => `💳 ${cardTypeLabel[c.cardType]} <code>${esc(c.cardNumber)}</code>${c.isDefault ? ' ⭐' : ''}`) : [W.noCards]),
  ];
  await ctx.reply(lines.join('\n'), { reply_markup: { inline_keyboard: [[{ text: D.btn.withdraw, callback_data: 'wd_start' }, { text: D.btn.addCard, callback_data: 'card_add' }]] } });
}

// ─── Ma'lumot ────────────────────────────────────────────────────────────────

function infoHtml(d: DriverFull): string {
  const I = D.info;
  const lines = [
    D.infoTitle,
    `${I.name}: <b>${esc(d.name)}</b>`,
    `${I.phone}: ${esc(displayPhone(d.phone))}`,
    `${I.point}: ${d.point ? `${esc(d.point.cityUz)}${d.point.address ? `, ${esc(d.point.address)}` : ''}` : I.none}`,
    `${I.supervisor}: ${d.supervisor ? `${esc(d.supervisor.name)} · ${esc(displayPhone(d.supervisor.phone))}` : I.none}`,
    `${I.vehicle}: ${d.vehicleInfo ? esc(d.vehicleInfo) : I.none}`,
    `${I.status}: ${driverStatusLabel[d.status]} · ${d.isOnline ? I.online : I.offline}`,
  ];
  if (d.registeredAt) lines.push(`${I.since}: ${formatDate(d.registeredAt, 'uz')}`);
  return lines.join('\n');
}

// ─── Ro'yxatdan o'tish ───────────────────────────────────────────────────────

async function register(ctx: Ctx, code: string, phone: string) {
  const res = await registerByCode('driver', code, phone, { id: ctx.from.id, name: tgName(ctx.from) });
  if (!res.ok) {
    await ctx.setSession<DrvSession>({ step: 'reg_code' });
    return ctx.reply(`${D.regFail[res.reason]}\n\n${D.regIntro}`, { reply_markup: guestKb });
  }
  if (res.role !== 'driver') return;
  const password = await issueDriverCredentials(res.driver.id);
  await ctx.clearSession();
  const full = await getDriver(ctx);
  await ctx.reply(`${D.registered(esc(res.driver.name))}\n\n${D.cabinet(cabinetUrl(), displayPhone(res.driver.phone), password)}`, { reply_markup: menuKb(full ?? { isOnline: false }) });
}

async function submitAccess(ctx: Ctx, s: DrvSession) {
  const a = s.acc ?? {};
  await ctx.clearSession();
  if (!a.name || !a.phone) return guestStart(ctx);
  try {
    await createAccessRequest({ role: 'driver', name: a.name, phone: a.phone, telegramId: String(ctx.from.id), telegramName: tgName(ctx.from), vehicleInfo: a.vehicle ?? null, requestedPointId: a.pointId ?? null });
    await ctx.reply(D.accSent, { reply_markup: guestKb });
  } catch (e) {
    if (!(e instanceof StaffError)) throw e;
    await ctx.reply(e.code === 'duplicate' ? D.accDuplicate : `❌ ${esc(e.message)}`, { reply_markup: guestKb });
    await ctx.setSession<DrvSession>({ step: 'reg_code' });
  }
}

// ─── Buyruqlar ───────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const d = await getDriver(ctx);
  if (!d) return guestStart(ctx);
  await ctx.clearSession();
  await showMenu(ctx, d, `👋 Salom, <b>${esc(d.name)}</b>!${d.point ? ` Punkt: ${esc(d.point.cityUz)}.` : ''}\n${D.menuHint}`);
});

bot.command('help', async (ctx) => {
  const d = await getDriver(ctx);
  await ctx.reply(D.help, { reply_markup: d ? menuKb(d) : guestKb });
});

bot.command('tasks', async (ctx) => {
  const d = await getDriver(ctx);
  if (!d) return guestStart(ctx);
  await ctx.clearSession();
  await showTasks(ctx, d);
});

async function askPassword(ctx: Ctx) {
  const d = await getDriver(ctx);
  if (!d) return guestStart(ctx);
  await ctx.reply(D.pwConfirm, { reply_markup: { inline_keyboard: [[{ text: D.btn.pwYes, callback_data: 'pw_yes' }, { text: D.btn.pwNo, callback_data: 'pw_no' }]] } });
}
bot.command('password', askPassword);

// ─── Menyu tugmalari ─────────────────────────────────────────────────────────

/** Menyu tugmasi: faqat ro'yxatdan o'tgan haydovchi; bosilganda joriy qadam tozalanadi */
const menu = (h: (ctx: Ctx, d: DriverFull) => Promise<unknown>) => async (ctx: Ctx) => {
  const d = await getDriver(ctx);
  if (!d) return guestStart(ctx);
  await ctx.clearSession();
  await h(ctx, d);
};

bot.hears(M.tasks, menu((ctx, d) => showTasks(ctx, d)));
bot.hears(M.weigh, menu((ctx, d) => weighMenu(ctx, d)));
bot.hears(M.wallet, menu((ctx, d) => showWallet(ctx, d)));
bot.hears(M.info, menu((ctx, d) => showMenu(ctx, d, infoHtml(d))));
bot.hears(M.password, menu((ctx) => askPassword(ctx)));
bot.hears([M.goOnline, M.goOffline], menu(async (ctx, d) => {
  const online = ctx.text === M.goOnline;
  await setDriverOnline(d.id, online);
  await showMenu(ctx, { isOnline: online }, online ? D.online : D.offline);
}));
bot.hears(M.cancel, (ctx) => cancelFlow(ctx));
bot.hears(M.back, async (ctx) => goBack(ctx, await sess(ctx)));
bot.hears(M.accessRequest, async (ctx) => {
  if (await getDriver(ctx)) return;
  // Kutilayotgan so'rov bo'lsa — qayta oqim boshlamaymiz
  if (await hasPendingAccess(ctx)) {
    await ctx.setSession<DrvSession>({ step: 'reg_code' });
    return ctx.reply(D.regPending, { reply_markup: guestKb });
  }
  await gotoStep(ctx, { acc: {} }, 'acc_name');
});

// ─── Kontakt / joylashuv ─────────────────────────────────────────────────────

bot.contact(async (ctx) => {
  const c = ctx.message?.contact;
  if (!c) return;
  const s = await sess(ctx);
  if (s.step !== 'reg_phone' && s.step !== 'acc_phone') {
    // Boshqa qadamda kelgan kontakt: joriy savol qaytariladi, jim qolmaymiz
    if (s.step) return gotoStep(ctx, s, s.step);
    const d = await getDriver(ctx);
    return d ? showMenu(ctx, d) : guestStart(ctx);
  }
  const back = !!prevDrvStep(s.step, s);
  if (c.user_id !== ctx.from.id) return ctx.reply(D.ownContactOnly, { reply_markup: contactKb(back) });
  const phone = normalizePhone(c.phone_number);
  if (!phone) return ctx.reply(D.badPhone, { reply_markup: contactKb(back) });
  if (s.step === 'reg_phone') {
    if (!s.code) return gotoStep(ctx, s, 'reg_code');
    return register(ctx, s.code, phone);
  }
  s.acc = { ...s.acc, phone };
  return gotoStep(ctx, s, 'acc_point');
});

bot.location(async (ctx) => {
  const loc = ctx.message?.location;
  const d = await getDriver(ctx);
  if (!loc || !d) return;
  // updateDriverLocation haydovchini onlayn qiladi
  await updateDriverLocation(d.id, loc.latitude, loc.longitude);
  const s = await sess(ctx);
  if (s.step) {
    // Oqim o'rtasida: joylashuvni saqlab, joriy qadamda qolamiz
    await ctx.reply(D.locationSaved);
    return gotoStep(ctx, s, s.step);
  }
  await showMenu(ctx, { isOnline: true }, D.locationSaved);
});

// ─── Matn: suhbat qadamlari ──────────────────────────────────────────────────

bot.text(async (ctx) => {
  const s = await sess(ctx);
  const text = ctx.text;
  const d = await getDriver(ctx);

  if (!d) {
    // Mehmon: kod yoki kirish so'rovi qadamlari
    switch (s.step) {
      case 'acc_name': {
        const name = text.slice(0, 100);
        if (name.length < 2) return ctx.reply(D.badName);
        s.acc = { ...s.acc, name };
        return gotoStep(ctx, s, 'acc_phone');
      }
      case 'acc_phone':
      case 'acc_point':
      case 'reg_phone':
        return gotoStep(ctx, s, s.step);
      case 'acc_vehicle':
        s.acc = { ...s.acc, vehicle: text === M.skip ? null : text.slice(0, 120) };
        return submitAccess(ctx, s);
      default: {
        const code = text.replace(/\D/g, '');
        if (code.length !== 5 || !/^\d{5}$/.test(text.trim())) {
          if (s.step === 'reg_code') return ctx.reply(D.badCode, { reply_markup: guestKb });
          return guestStart(ctx);
        }
        return gotoStep(ctx, { code }, 'reg_phone');
      }
    }
  }

  if (!s.step) return showMenu(ctx, d, D.menuHint);
  switch (s.step) {
    case 'weigh_weight': {
      const n = parseNumber(text);
      if (!n || n > 100_000) return ctx.reply(D.badWeight);
      s.weigh = { ...s.weigh!, weight: Math.round(n * 100) / 100 };
      return gotoStep(ctx, s, 'weigh_discount');
    }
    case 'weigh_reason_text':
      s.weigh = { ...s.weigh!, reason: text.slice(0, 200) };
      return gotoStep(ctx, s, 'weigh_confirm');
    case 'weigh_discount':
    case 'weigh_reason':
    case 'weigh_confirm':
      // inline tanlov kutilmoqda — savolni qayta ko'rsatamiz
      return gotoStep(ctx, s, s.step);
    case 'reject_text': {
      const id = s.rejectId;
      await ctx.clearSession();
      if (!id) return showMenu(ctx, d);
      try {
        await rejectTask(id, d.id, text.slice(0, 200));
        return showMenu(ctx, d, D.rejected(esc(text.slice(0, 200))));
      } catch (e) {
        const msg = reqErr(e);
        if (!msg) throw e;
        return showMenu(ctx, d, `❌ ${esc(msg)}`);
      }
    }
    case 'wd_amount': {
      const n = parseNumber(text);
      if (!n) return ctx.reply(D.badAmount);
      try {
        const trx = await requestWithdrawal(d.id, n);
        await ctx.clearSession();
        return showMenu(ctx, d, D.wdSent(fmtSum(trx.amount), esc(trx.description ?? '')));
      } catch (e) {
        if (!(e instanceof WalletError)) throw e;
        return ctx.reply(`❗️ ${esc(e.message)}`);
      }
    }
    case 'card_number': {
      const parts = cardParts(text);
      if (!parts) return ctx.reply(D.badCard);
      s.card = parts;
      return gotoStep(ctx, s, 'card_holder');
    }
    case 'card_holder': {
      const holder = text.slice(0, 100);
      if (holder.length < 2) return ctx.reply(D.badName);
      if (!s.card) return gotoStep(ctx, s, 'card_number');
      s.card = { ...s.card, holder };
      return gotoStep(ctx, s, 'card_expiry');
    }
    case 'card_expiry': {
      const exp = parseExpiry(text);
      const c = s.card;
      if (!exp) return ctx.reply(D.badExpiry);
      if (!c?.holder) return gotoStep(ctx, s, 'card_number');
      try {
        // To'liq raqam sessiyada yo'q: turi uchun birinchi 4, niqob uchun oxirgi 4 yetarli
        const card = await addCard(d.id, { number: `${c.first4}00000000${c.last4}`, holder: c.holder, expiryMonth: exp.month, expiryYear: exp.year });
        await ctx.clearSession();
        return showMenu(ctx, d, D.cardAdded(esc(card.cardNumber), cardTypeLabel[card.cardType], card.isDefault));
      } catch (e) {
        if (!(e instanceof WalletError)) throw e;
        return ctx.reply(`❗️ ${esc(e.message)}`);
      }
    }
    default:
      await ctx.clearSession();
      return showMenu(ctx, d);
  }
});

// ─── Callback'lar: navigatsiya ───────────────────────────────────────────────

bot.callback('nav_back', async (ctx) => {
  await ctx.edit(ctx.message?.text ? esc(ctx.message.text) : '…');
  await goBack(ctx, await sess(ctx));
});
bot.callback('nav_cancel', async (ctx) => {
  await ctx.edit(ctx.message?.text ? esc(ctx.message.text) : '…');
  await cancelFlow(ctx);
});

// ─── Callback'lar: topshiriqlar ──────────────────────────────────────────────

bot.callback('accept_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'accept_');
  if (!r) return;
  try {
    await acceptTask(r.id, d.id);
    await ctx.edit(`${requestCardHtml(r)}\n\n${D.accepted}`, [[{ text: D.btn.enroute, callback_data: `enroute_${r.id}` }], [{ text: D.btn.reject, callback_data: `reject_${r.id}` }]]);
  } catch (e) {
    const msg = reqErr(e);
    if (!msg) throw e;
    await ctx.answer(msg, true);
  }
});

bot.callback('reject_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'reject_');
  if (!r) return;
  if (!['assigned', 'en_route'].includes(r.status)) return ctx.answer("Bu bosqichda rad etib bo'lmaydi", true);
  await ctx.edit(`${requestCardHtml(r)}\n\n${D.askRejectReason}`, [
    ...REJECT_REASONS.map((x) => [{ text: x.label, callback_data: `rej_${r.id}_${x.key}` }]),
    [{ text: D.btn.back, callback_data: `rejback_${r.id}` }],
  ]);
});

bot.callback('rejback_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'rejback_');
  if (!r) return;
  await ctx.edit(requestCardHtml(r), taskButtons(r));
});

bot.callback('rej_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'rej_');
  if (!r) return;
  const key = ctx.data.split('_')[2] ?? '';
  const label = rejectReasonLabel(key);
  if (!label) return;
  if (key === 'boshqa') {
    await ctx.edit(requestCardHtml(r));
    return gotoStep(ctx, { rejectId: r.id }, 'reject_text');
  }
  try {
    await rejectTask(r.id, d.id, label);
    await ctx.edit(`${requestCardHtml(r)}\n\n${D.rejected(label)}`);
  } catch (e) {
    const msg = reqErr(e);
    if (!msg) throw e;
    await ctx.answer(msg, true);
  }
});

bot.callback('enroute_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'enroute_');
  if (!r) return;
  try {
    const u = await startEnRoute(r.id, d.id);
    await ctx.edit(`${requestCardHtml(u)}\n\n${D.enroute}`, taskButtons(u));
  } catch (e) {
    const msg = reqErr(e);
    if (!msg) throw e;
    await ctx.answer(msg, true);
  }
});

bot.callback('arrived_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const r = await ownTask(ctx, d, 'arrived_');
  if (!r) return;
  try {
    const u = await markArrived(r.id, d.id);
    await ctx.edit(`${requestCardHtml(u)}\n\n${D.arrived}`, taskButtons(u));
  } catch (e) {
    const msg = reqErr(e);
    if (!msg) throw e;
    await ctx.answer(msg, true);
  }
});

// ─── Callback'lar: tortish ───────────────────────────────────────────────────

bot.callback('weigh_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const id = idFrom(ctx.data, 'weigh_');
  if (!id) return;
  await startWeigh(ctx, d, id);
});

bot.callback('disc_', async (ctx) => {
  const s = await sess(ctx);
  if (s.step !== 'weigh_discount' || !s.weigh) return ctx.answer(D.restartWeigh, true);
  const p = Number(ctx.data.slice(5));
  if (!(DISCOUNT_OPTIONS as readonly number[]).includes(p)) return;
  s.weigh.discount = p;
  s.weigh.reason = null;
  await ctx.edit(`➖ Chegirma: ${p}%`);
  return gotoStep(ctx, s, p === 0 ? 'weigh_confirm' : 'weigh_reason');
});

bot.callback('dreason_', async (ctx) => {
  const s = await sess(ctx);
  if (s.step !== 'weigh_reason' || !s.weigh) return ctx.answer(D.restartWeigh, true);
  const key = ctx.data.slice(8);
  const label = discountReasonLabel(key);
  if (!label) return;
  if (key === 'boshqa') {
    await ctx.edit(D.askDiscountReason);
    return gotoStep(ctx, s, 'weigh_reason_text');
  }
  s.weigh.reason = label;
  await ctx.edit(`📝 Sabab: ${label}`);
  return gotoStep(ctx, s, 'weigh_confirm');
});

bot.callback('wgh_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const s = await sess(ctx);
  const action = ctx.data.slice(4);
  if (action === 'cancel') {
    await ctx.edit(D.weighCancelled);
    return cancelFlow(ctx);
  }
  if (!s.weigh || !['weigh_confirm', 'weigh_discount', 'weigh_reason', 'weigh_reason_text'].includes(s.step ?? '')) return ctx.answer(D.restartWeigh, true);
  if (action === 'redo') {
    await ctx.edit(D.btn.redo);
    return gotoStep(ctx, { weigh: { requestId: s.weigh.requestId, name: s.weigh.name } }, 'weigh_weight');
  }
  if (action !== 'save' || s.step !== 'weigh_confirm') return;
  try {
    const { collection } = await recordWeighing({ requestId: s.weigh.requestId, actualWeight: s.weigh.weight ?? 0, discountPercent: s.weigh.discount ?? 0, discountReason: s.weigh.reason ?? null, actor: { kind: 'driver', id: d.id, name: d.name } });
    await ctx.clearSession();
    // Daromad poydevor tomonidan DriverTransaction (earning) sifatida yozilgan
    const earn = await prisma.driverTransaction.findFirst({ where: { collectionId: collection.id, type: 'earning' }, select: { amount: true } });
    await ctx.edit(`${ctx.message?.text ? esc(ctx.message.text) : ''}\n\n${D.weighSaved(fmtSum(earn?.amount ?? 0))}`);
    await showMenu(ctx, d);
  } catch (e) {
    const msg = reqErr(e);
    if (!msg) throw e;
    await ctx.answer(msg, true);
  }
});

// ─── Callback'lar: hamyon, karta, parol, kirish so'rovi ──────────────────────

bot.callback('wd_start', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  const { balance } = await driverBalance(d.id);
  if (balance < MIN_WITHDRAWAL) return ctx.answer(D.lowBalance(fmtSum(MIN_WITHDRAWAL), fmtSum(balance)), true);
  await gotoStep(ctx, {}, 'wd_amount');
});

bot.callback('card_add', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  await gotoStep(ctx, {}, 'card_number');
});

bot.callback('pw_', async (ctx) => {
  const d = await cbDriver(ctx);
  if (!d) return;
  if (ctx.data !== 'pw_yes') return ctx.edit(D.pwKept);
  try {
    const password = await resetDriverPassword(d.id, String(ctx.from.id));
    await ctx.edit(D.pwNew(password, cabinetUrl(), displayPhone(d.phone)));
  } catch (e) {
    if (!(e instanceof StaffError)) throw e;
    await ctx.answer(e.message, true);
  }
});

bot.callback('accpt_', async (ctx) => {
  const s = await sess(ctx);
  if (s.step !== 'acc_point') return ctx.answer(D.restartAccess, true);
  const id = idFrom(ctx.data, 'accpt_');
  const p = id ? await prisma.recyclePoint.findFirst({ where: { id, status: 'active' } }) : null;
  s.acc = { ...s.acc, pointId: p?.id ?? null };
  await ctx.edit(`🏭 Punkt: ${p ? esc(p.cityUz) : D.noPoint}`);
  await gotoStep(ctx, s, 'acc_vehicle');
});
