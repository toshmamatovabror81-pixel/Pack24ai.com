import 'server-only';
import { JournalError } from '@/lib/recycling/journal';
import { RequestError } from '@/lib/recycling/requests';
import { StaffError, supervisorByTelegram } from '@/lib/recycling/staff';
import { WalletError } from '@/lib/recycling/wallet';
import { esc } from '../api';
import { createBot, idFrom, type Ctx } from '../router';
import { BACK, cancelPrompt, cancelReasonCallback, clearButtons, type Sess } from './shCommon';
import * as F from './supervisorFlow';

/**
 * Masul roli — boshqaruv boti (@pack24AUP_bot): arizalar, haydovchi tayinlash, bazada qabul, to'lovlar, jurnal, punkt, yechib olish, shikoyatlar.
 * Har handler boshida masul aniqlanadi (supervisorByTelegram); yo'q bo'lsa ro'yxatdan o'tishga yo'naltiriladi.
 * Poydevor yuboradigan callback'lar: assign_<id>, cancel_<id>, pay_<collectionId>, complaint_<requestId>, wd_ok_/wd_no_<txId>.
 */
export const bot = createBot('supervisor');

type H = (ctx: Ctx, sup: F.Sup) => Promise<unknown>;
const auth = (h: H) => async (ctx: Ctx) => {
  const sup = await supervisorByTelegram(ctx.from.id);
  if (!sup) {
    if (ctx.callback) { await ctx.answer("Avval ro'yxatdan o'ting: /start", true); return; }
    await F.startRegistration(ctx);
    return;
  }
  await h(ctx, sup);
};
/** Menyu tugmasi / buyruq: chala qolgan suhbat bosqichi uziladi (keyingi matn eski oqimni davom ettirmasin) */
const menu = (h: H) => auth(async (ctx, sup) => { await ctx.clearSession(); await h(ctx, sup); });
const id = (ctx: Ctx, prefix: string) => idFrom(ctx.data, prefix);

// ─── Buyruqlar va menyu ──────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const sup = await supervisorByTelegram(ctx.from.id);
  if (!sup) { await F.startRegistration(ctx); return; }
  await F.showMenu(ctx, sup);
});
bot.command('menu', auth((ctx, sup) => F.showMenu(ctx, sup)));
bot.command('help', menu((ctx) => F.showHelp(ctx)));
bot.command('requests', menu((ctx, sup) => F.showRequests(ctx, sup)));

bot.hears(BACK, auth((ctx, sup) => F.showMenu(ctx, sup)));
bot.hears(F.MENU.requests, menu((ctx, sup) => F.showRequests(ctx, sup)));
bot.hears(F.MENU.drivers, menu(F.showDrivers));
bot.hears(F.MENU.payments, menu(F.showPayments));
bot.hears(F.MENU.journal, menu((ctx, sup) => F.showJournal(ctx, sup)));
bot.hears(F.MENU.point, menu((ctx, sup) => F.showPoint(ctx, sup)));
bot.hears(F.MENU.withdrawals, menu(F.showWithdrawals));
bot.hears(F.MENU.complaints, menu(F.showComplaints));
bot.hears(F.MENU.today, menu(F.showToday));
bot.hears(F.REG_REQUEST, async (ctx) => {
  const sup = await supervisorByTelegram(ctx.from.id);
  if (sup) { await F.showMenu(ctx, sup, "Siz allaqachon ro'yxatdan o'tgansiz."); return; }
  await F.guestText(ctx, await ctx.session<Sess>(), ctx.text);
});

// ─── Callback'lar ────────────────────────────────────────────────────────────

bot.callback('menu', async (ctx) => {
  await clearButtons(ctx);
  const sup = await supervisorByTelegram(ctx.from.id);
  if (!sup) { await ctx.clearSession(); await F.startRegistration(ctx); return; }
  await F.showMenu(ctx, sup);
});
// val_<qiymat>: bosqich savoliga tugma orqali javob
bot.callback('val_', auth(async (ctx, sup) => {
  const s = await ctx.session<Sess>();
  if (!s?.step) { await ctx.answer('Bosqich tugagan — menyudan qayta boshlang', true); return; }
  await clearButtons(ctx);
  await F.handleStep(ctx, sup, s, ctx.data.slice(4));
}));

// reqpg_<n>: arizalar ro'yxati sahifasi
bot.callback('reqpg_', auth(async (ctx, sup) => { await clearButtons(ctx); await F.showRequests(ctx, sup, Number(ctx.data.slice(6)) || 0); }));
bot.callback('assign_', auth((ctx, sup) => F.startAssign(ctx, sup, id(ctx, 'assign_'))));
bot.callback('pick_', auth(F.pickDriver));
bot.callback('cancel_', auth(async (ctx, sup) => { const rid = id(ctx, 'cancel_'); await cancelPrompt(ctx, rid ?? 0, !!rid && (await F.ownsRequest(sup, rid))); }));
bot.callback('cres_', auth((ctx, sup) => cancelReasonCallback(ctx, F.actorOf(sup), (rid) => F.ownsRequest(sup, rid))));
bot.callback('base_', auth((ctx, sup) => F.startBase(ctx, sup, id(ctx, 'base_'))));
bot.callback('pay_', auth((ctx, sup) => F.startPay(ctx, sup, id(ctx, 'pay_'))));
bot.callback('reweigh_', auth((ctx, sup) => F.startReweigh(ctx, sup, id(ctx, 'reweigh_'))));

bot.callback('drvnew', auth((ctx) => F.startDriverAdd(ctx)));
bot.callback('drvtg_', auth((ctx, sup) => F.driverAction(ctx, sup, 'tg', id(ctx, 'drvtg_'))));
bot.callback('drvblock_', auth((ctx, sup) => F.driverAction(ctx, sup, 'block', id(ctx, 'drvblock_'))));
bot.callback('drvact_', auth((ctx, sup) => F.driverAction(ctx, sup, 'act', id(ctx, 'drvact_'))));
bot.callback('drv_', auth((ctx, sup) => F.showDriver(ctx, sup, id(ctx, 'drv_'))));

bot.callback('jr_', auth((ctx, sup) => F.journalAction(ctx, sup, ctx.data.slice(3))));
bot.callback('pt_toggle', auth(F.togglePoint));
bot.callback('pt_price', auth(F.startPointPrice));
bot.callback('wd_ok_', auth((ctx, sup) => F.settle(ctx, sup, true, id(ctx, 'wd_ok_'))));
bot.callback('wd_no_', auth((ctx, sup) => F.settle(ctx, sup, false, id(ctx, 'wd_no_'))));
bot.callback('complaint_', auth((ctx, sup) => F.startComplaintReply(ctx, sup, id(ctx, 'complaint_'))));
bot.callback('accpt_', async (ctx) => {
  const sup = await supervisorByTelegram(ctx.from.id);
  if (sup) { await F.accptIgnore(ctx); return; }
  await F.guestPointPick(ctx, await ctx.session<Sess>(), id(ctx, 'accpt_'));
});

// ─── Kontakt va matn (suhbat bosqichlari) ────────────────────────────────────

bot.contact(async (ctx) => {
  const sup = await supervisorByTelegram(ctx.from.id);
  if (sup) { await F.showMenu(ctx, sup, "Siz allaqachon ro'yxatdan o'tgansiz."); return; }
  await F.guestContact(ctx, await ctx.session<Sess>());
});

bot.text(async (ctx) => {
  const s = await ctx.session<Sess>();
  const sup = await supervisorByTelegram(ctx.from.id);
  if (!sup) { await F.guestText(ctx, s, ctx.text); return; }
  if (!s?.step) { await F.showMenu(ctx, sup, "🤔 Tushunmadim. Menyudan bo'limni tanlang:"); return; }
  await F.handleStep(ctx, sup, s, ctx.text);
});

bot.onError(async (e, ctx) => {
  const known = e instanceof RequestError || e instanceof StaffError || e instanceof WalletError || e instanceof JournalError;
  const msg = known ? e.message : "Xatolik yuz berdi. Qaytadan urinib ko'ring yoki /start bosing.";
  if (ctx.callback) await ctx.answer(msg.slice(0, 190), true);
  await ctx.reply(`❌ ${esc(msg)}`);
});
