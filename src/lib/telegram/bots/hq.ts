import 'server-only';
import { JournalError } from '@/lib/recycling/journal';
import { RequestError } from '@/lib/recycling/requests';
import { StaffError } from '@/lib/recycling/staff';
import { WalletError } from '@/lib/recycling/wallet';
import { esc } from '../api';
import { createBot, idFrom, type Ctx } from '../router';
import { BACK, cancelPrompt, cancelReasonCallback, clearButtons, ids, type Sess } from './shCommon';
import * as F from './hqFlow';

/**
 * Rahbariyat (HQ) roli — boshqaruv boti (@pack24AUP_bot) ichida, alohida bot emas: barcha punktlar nazorati. Ruxsat — TelegramHqAdmin (faol) yoki HQ_ALLOWED_TELEGRAM_IDS.
 * Poydevor yuboradigan callback'lar: acc_ok_/acc_no_<id> (kirish so'rovi), wd_ok_/wd_no_<txId> (yechib olish), complaint_<requestId>.
 */
export const bot = createBot('hq');

type H = (ctx: Ctx, hq: F.Hq) => Promise<unknown>;
const auth = (h: H) => async (ctx: Ctx) => {
  const hq = await F.resolveHq(ctx);
  if (!hq) {
    if (ctx.callback) { await ctx.answer("⛔ Ruxsat yo'q", true); return; }
    await F.guestStart(ctx);
    return;
  }
  await h(ctx, hq);
};
/** Menyu tugmasi / buyruq: chala qolgan suhbat bosqichi uziladi */
const menu = (h: H) => auth(async (ctx, hq) => { await ctx.clearSession(); await h(ctx, hq); });
const id = (ctx: Ctx, prefix: string) => idFrom(ctx.data, prefix);

// ─── Buyruqlar va menyu ──────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const hq = await F.resolveHq(ctx);
  if (!hq) { await F.guestStart(ctx); return; }
  await F.showMenu(ctx, hq);
});
bot.command('menu', auth((ctx, hq) => F.showMenu(ctx, hq)));
bot.command('help', menu((ctx) => F.showHelp(ctx)));
bot.command('events', menu((ctx) => F.showEvents(ctx)));

bot.hears(BACK, auth((ctx, hq) => F.showMenu(ctx, hq)));
bot.hears(F.MENU.today, menu((ctx) => F.showToday(ctx)));
bot.hears(F.MENU.requests, menu((ctx) => F.showRequests(ctx)));
bot.hears(F.MENU.supervisors, menu((ctx) => F.showSupervisors(ctx)));
bot.hears(F.MENU.drivers, menu((ctx) => F.showDrivers(ctx)));
bot.hears(F.MENU.points, menu((ctx) => F.showPoints(ctx)));
bot.hears(F.MENU.access, menu((ctx) => F.showAccess(ctx)));
bot.hears(F.MENU.withdrawals, menu((ctx) => F.showWithdrawals(ctx)));
bot.hears(F.MENU.events, menu((ctx) => F.showEvents(ctx)));
bot.hears(F.MENU.complaints, menu((ctx) => F.showComplaints(ctx)));

// ─── Callback'lar ────────────────────────────────────────────────────────────

bot.callback('menu', auth(async (ctx, hq) => { await clearButtons(ctx); await F.showMenu(ctx, hq); }));
// val_<qiymat>: bosqich savoliga tugma orqali javob
bot.callback('val_', auth(async (ctx, hq) => {
  const s = await ctx.session<Sess>();
  if (!s?.step) { await ctx.answer('Bosqich tugagan — menyudan qayta boshlang', true); return; }
  await clearButtons(ctx);
  await F.handleStep(ctx, hq, s, ctx.data.slice(4));
}));

// Arizalar
bot.callback('disp_', auth((ctx) => F.startDispatch(ctx, id(ctx, 'disp_'))));
bot.callback('sup_', auth(F.pickSupervisor));
bot.callback('cancel_', auth(async (ctx) => { const rid = id(ctx, 'cancel_'); await cancelPrompt(ctx, rid ?? 0, !!rid); }));
bot.callback('cres_', auth((ctx, hq) => cancelReasonCallback(ctx, F.actorOf(hq), async () => true)));

// Masullar (supv_ — tafsilot; sup_ bilan to'qnashmasligi uchun boshqa prefiks)
bot.callback('supnew', auth((ctx) => F.startSupervisorAdd(ctx)));
bot.callback('suptg_', auth((ctx, hq) => F.supervisorAction(ctx, hq, 'tg', id(ctx, 'suptg_'))));
bot.callback('supblock_', auth((ctx, hq) => F.supervisorAction(ctx, hq, 'block', id(ctx, 'supblock_'))));
bot.callback('supact_', auth((ctx, hq) => F.supervisorAction(ctx, hq, 'act', id(ctx, 'supact_'))));
bot.callback('supv_', auth((ctx) => F.showSupervisor(ctx, id(ctx, 'supv_'))));
bot.callback('sapt_', auth((ctx, hq) => F.stepPick(ctx, hq, 'sapt_')));

// Haydovchilar
bot.callback('drvnew', auth((ctx) => F.startDriverAdd(ctx)));
bot.callback('bonus_', auth((ctx) => F.startBonus(ctx, id(ctx, 'bonus_'))));
bot.callback('hqdrvtg_', auth((ctx, hq) => F.driverAction(ctx, hq, 'tg', id(ctx, 'hqdrvtg_'))));
bot.callback('hqdrvblock_', auth((ctx, hq) => F.driverAction(ctx, hq, 'block', id(ctx, 'hqdrvblock_'))));
bot.callback('hqdrvact_', auth((ctx, hq) => F.driverAction(ctx, hq, 'act', id(ctx, 'hqdrvact_'))));
bot.callback('hqdrv_', auth((ctx) => F.showDriver(ctx, id(ctx, 'hqdrv_'))));
bot.callback('hdpt_', auth((ctx, hq) => F.stepPick(ctx, hq, 'hdpt_')));
bot.callback('hdsup_', auth((ctx, hq) => F.stepPick(ctx, hq, 'hdsup_')));

// Punktlar
bot.callback('ptprice_', auth((ctx) => F.startPointEdit(ctx, 'price', id(ctx, 'ptprice_'))));
bot.callback('ptrate_', auth((ctx) => F.startPointEdit(ctx, 'rate', id(ctx, 'ptrate_'))));
bot.callback('pttoggle_', auth((ctx, hq) => F.togglePoint(ctx, hq, id(ctx, 'pttoggle_'))));

// Kirish so'rovlari (access.ts aynan acc_ok_/acc_no_ yuboradi)
bot.callback('acc_ok_', auth((ctx, hq) => F.approveAccess(ctx, hq, id(ctx, 'acc_ok_'))));
bot.callback('acc_no_', auth((ctx) => F.startReject(ctx, id(ctx, 'acc_no_'))));
bot.callback('accpt_', auth((ctx, hq) => { const [rid, pid] = ids(ctx.data, 'accpt_'); return F.approveAccess(ctx, hq, rid ?? null, pid ?? 0); }));

// Yechib olish (wallet.ts aynan wd_ok_/wd_no_ yuboradi)
bot.callback('wd_ok_', auth((ctx, hq) => F.settle(ctx, hq, true, id(ctx, 'wd_ok_'))));
bot.callback('wd_no_', auth((ctx, hq) => F.settle(ctx, hq, false, id(ctx, 'wd_no_'))));

// Hodisalar va shikoyatlar
bot.callback('ev_seen', auth((ctx) => F.markAllSeen(ctx)));
bot.callback('complaint_', auth((ctx) => F.startComplaintReply(ctx, id(ctx, 'complaint_'))));
bot.callback('cmpdir_', auth((ctx, hq) => F.escalate(ctx, hq, id(ctx, 'cmpdir_'))));

// ─── Kontakt va matn (suhbat bosqichlari) ────────────────────────────────────

bot.contact(async (ctx) => {
  const hq = await F.resolveHq(ctx);
  if (hq) { await F.showMenu(ctx, hq, "Siz allaqachon ro'yxatdan o'tgansiz."); return; }
  await F.guestContact(ctx, await ctx.session<Sess>());
});

bot.text(async (ctx) => {
  const s = await ctx.session<Sess>();
  const hq = await F.resolveHq(ctx);
  if (!hq) { await F.guestText(ctx, s, ctx.text); return; }
  if (!s?.step) { await F.showMenu(ctx, hq, "🤔 Tushunmadim. Menyudan bo'limni tanlang:"); return; }
  await F.handleStep(ctx, hq, s, ctx.text);
});

bot.onError(async (e, ctx) => {
  const known = e instanceof RequestError || e instanceof StaffError || e instanceof WalletError || e instanceof JournalError;
  const msg = known ? e.message : "Xatolik yuz berdi. Qaytadan urinib ko'ring yoki /start bosing.";
  if (ctx.callback) await ctx.answer(msg.slice(0, 190), true);
  await ctx.reply(`❌ ${esc(msg)}`);
});
