import 'server-only';
import type { TelegramCustomer } from '@prisma/client';
import { askAssistant, clearAssistantHistory } from '@/lib/ai/assistant';
import { aiConfigured } from '@/lib/ai/client';
import { customerDebt, getOrder, listOrders } from '@/lib/customerAccount';
import { paymentUrl } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { clip, esc, inline, removeKeyboard, sendChatAction, type InlineKeyboard } from '../api';
import {
  bindOrderByToken, botCustomer, customerScope, ensureBotCustomer, isBotLang, langOf, linkCustomerPhone,
  setCustomerLang, setCustomerNotify, unlinkCustomer, type BotLang,
} from '../customers';
import { createBot, idFrom, type Ctx } from '../router';
import { customerTexts, type CustomerTexts } from './customerTexts';
import {
  balanceHtml, balanceKeyboard, CB, contactKeyboard, contactsHtml, helloHtml, helpHtml, langKeyboard, mainKeyboard,
  orderCardHtml, orderCardKeyboard, ordersEmptyHtml, ordersListHtml, ordersListKeyboard, phoneLinkedHtml, phoneUnsupportedHtml,
  requisitesHtml, settingsHtml, settingsKeyboard, sharePhoneKeyboard, stopConfirmKeyboard,
} from './customerViews';

/**
 * Mijoz boti (@Pack24AI_bot). Mijoz o'z telefonini Telegram kontakti orqali ulaydi va buyurtmalarini (ro'yxatga olingan sana,
 * holat, ishlab chiqarish bosqichi, to'lov), balansini (to'lanishi kerak bo'lgan summa), rekvizitlar va aloqa ma'lumotlarini ko'radi.
 * Holat o'zgarganda xabarni orderNotify yuboradi; undagi "Batafsil" tugmasi (`o_<id>`) shu yerda ochiladi.
 * Xavfsizlik:
 *  - har bir so'rov CustomerScope bilan cheklanadi (customerAccount) — bot id bo'yicha "ochiq" qidirmaydi;
 *  - telefon faqat `contact.user_id === from.id` bo'lgan kontaktdan olinadi, yozib yuborilgan raqam hech narsani ulamaydi;
 *  - bot faqat shaxsiy chatda javob beradi: guruhga qo'shilsa, hech kimning buyurtmasi yoki qarzi guruhga chiqmaydi.
 */
export const bot = createBot('customer');

/** Suhbat holati: til hali tanlanmagan (birinchi murojaat) va /start bilan kelgan buyurtma havolasi */
type Session = { askLang?: boolean; token?: string };
/** /start <token> natijasi: buyurtma (taken — boshqa hisobga ulangan); 'missing' — havola yaroqsiz; null — havolasiz */
type StartLink = { orderId: number; taken: boolean } | 'missing' | null;
type Handler = (ctx: Ctx) => Promise<void>;
type CustomerHandler = (ctx: Ctx, customer: TelegramCustomer) => Promise<void>;

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;
const PAGE_SIZE = 6;
const { uz, ru } = customerTexts;

const fullName = (u: Ctx['from']) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
/** Yangi mijozning boshlang'ich tili Telegram tilidan taxmin qilinadi (keyin o'zi tanlaydi) */
const guessLang = (u: Ctx['from']): BotLang => (u.language_code?.toLowerCase().startsWith('ru') ? 'ru' : 'uz');
/** Tugma matni ikkala tilda: mijoz tilni almashtirgach eski klaviaturadan bosgan bo'lsa ham ishlaydi */
const both = (pick: (t: CustomerTexts) => string) => [pick(uz), pick(ru)];
/** Yozib yuborilgan telefon raqamiga o'xshash matn (qabul qilinmaydi — faqat yo'riqnoma beriladi) */
const looksLikePhone = (text: string) => /^\+?[\d\s().-]{7,24}$/.test(text) && text.replace(/\D/g, '').length >= 9;
const pageFrom = (data: string) => { const n = Number(data.slice(CB.list.length)); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
/** Kartaning o'z "Yangilash" tugmasi bosildimi: ma'lumot o'zgarmagan bo'lsa ham mijoz javob ko'rsin */
const isRefresh = (ctx: Ctx) => !!ctx.message?.reply_markup?.inline_keyboard.some((row) => row.some((b) => b.callback_data === ctx.data && (b.text === uz.card.refresh || b.text === ru.card.refresh)));

/**
 * Birinchi til so'rovi eskirgan: sessiya 7 kundan keyin o'qilmaydi (session.ts), xabar esa chatda qoladi va til hali tanlanmagan.
 * Bunday xabar tugmalarida ✓ yo'q (sozlamalar va /lang da joriy til belgilangan) va u sessiya muddatidan eski.
 */
const isExpiredFirstPrompt = (ctx: Ctx) => {
  const row = ctx.message?.reply_markup?.inline_keyboard[0];
  const sentAt = (ctx.message?.date ?? 0) * 1000;
  return !!row?.length && row.every((b) => !b.text.startsWith('✓')) && sentAt > 0 && sentAt < Date.now() - 7 * 86_400_000;
};

/** Faqat shaxsiy chat: bot guruhga qo'shilgan bo'lsa jim turadi */
const personal = (h: Handler): Handler => async (ctx) => { if (ctx.message?.chat.type === 'private') await h(ctx); };

/** Mijoz yozuvi (bo'lmasa yaratadi). `isNew` — shu murojaatda yaratildi, ya'ni til hali so'ralmagan */
async function load(ctx: Ctx): Promise<{ customer: TelegramCustomer; isNew: boolean }> {
  const existing = await botCustomer(ctx.from.id);
  if (existing) return { customer: existing, isNew: false };
  return { customer: await ensureBotCustomer(ctx.from.id, { name: fullName(ctx.from), lang: guessLang(ctx.from) }), isNew: true };
}

/**
 * Xabar (buyruq, menyu tugmasi, matn) uchun mijoz yozuvi. Birinchi murojaatda yoki til hali tanlanmagan bo'lsa
 * avval til so'raladi va null qaytadi; /start havolasi (token) til tanlangach davom etish uchun sessiyada saqlanadi.
 */
async function enter(ctx: Ctx, token: string | null = null): Promise<TelegramCustomer | null> {
  const { customer, isNew } = await load(ctx);
  const sess = isNew ? null : await ctx.session<Session>();
  if (!isNew && !sess?.askLang) return customer;
  const keep = token ?? sess?.token;
  await ctx.setSession<Session>({ askLang: true, ...(keep ? { token: keep } : {}) });
  await ctx.reply(`${uz.lang.choose}\n${ru.lang.choose}`, { reply_markup: inline(langKeyboard()) });
  return null;
}

const entered = (h: CustomerHandler): Handler => personal(async (ctx) => {
  const customer = await enter(ctx);
  if (customer) await h(ctx, customer);
});
/**
 * Til so'rab to'xtatilmaydigan yo'l (inline tugmalar, kontakt, /stop): xabarnomadagi "Batafsil" darhol ochilishi kerak.
 * Yozuv shu yerda yaratilgan bo'lsa (eski bot davridan ulangan chat), til keyingi xabarda so'raladi.
 */
const loaded = (h: CustomerHandler): Handler => personal(async (ctx) => {
  const { customer, isNew } = await load(ctx);
  if (isNew) await ctx.setSession<Session>({ askLang: true });
  await h(ctx, customer);
});

/** Callback bosilgan xabarni yangilaydi; oddiy xabarga (yoki fresh=true bo'lsa) yangi xabar bilan javob beradi */
async function show(ctx: Ctx, html: string, kb?: InlineKeyboard, fresh = false): Promise<void> {
  if (ctx.callback && !fresh) await ctx.edit(html, kb);
  else await ctx.reply(html, kb ? { reply_markup: inline(kb) } : {});
}

/** Telefon ulanmagan: xabarga javobda kontakt tugmasi darhol chiqadi, inline tugma bosilgan bo'lsa — "Raqamni ulashish" */
async function needPhone(ctx: Ctx, lang: BotLang, html: string): Promise<void> {
  if (ctx.callback) await ctx.edit(html, sharePhoneKeyboard(lang));
  else await ctx.reply(html, { reply_markup: contactKeyboard(lang) });
}

async function bindToken(ctx: Ctx, token: string | null | undefined): Promise<StartLink> {
  if (!token) return null;
  const res = await bindOrderByToken(ctx.from.id, token);
  if (!res) return 'missing';
  return { orderId: res.order.id, taken: !res.bound };
}

/**
 * Salomlashuv: telefon ulanmagan bo'lsa nima uchun kerakligi va kontakt tugmasi, aks holda asosiy menyu.
 * Havola bilan kelgan bo'lsa — buyurtma kartasi; boshqa hisobga ulangan buyurtma haqida begonaga hech narsa ochilmaydi.
 */
async function welcome(ctx: Ctx, customer: TelegramCustomer, link: StartLink): Promise<void> {
  const lang = langOf(customer);
  const t = customerTexts[lang];
  const hello = helloHtml(lang, fullName(ctx.from), (await getSettings()).companyName);
  if (customer.phone) await ctx.reply(`${hello}\n\n${t.start.menuHint}`, { reply_markup: mainKeyboard(lang) });
  else await ctx.reply(`${hello}\n\n${t.phone.why}`, { reply_markup: contactKeyboard(lang) });
  if (link === 'missing') await ctx.reply(t.start.orderMissing);
  else if (link) {
    // Boshqa chatga ulangan buyurtma faqat mijozning o'z telefoni (yoki akkaunti) bo'yicha ko'rinsa ochiladi
    const mine = !link.taken || (!!customer.phone && !!(await getOrder(await customerScope(customer), link.orderId)));
    if (mine) await showOrder(ctx, customer, link.orderId, true);
    else await ctx.reply(t.start.orderTaken);
  }
}

async function showOrders(ctx: Ctx, customer: TelegramCustomer, page = 0): Promise<void> {
  const lang = langOf(customer);
  const scope = await customerScope(customer);
  const list = await listOrders(scope, page, PAGE_SIZE);
  if (list.total) return show(ctx, ordersListHtml(list, lang, !!scope.phone), ordersListKeyboard(list));
  if (scope.phone) return show(ctx, ordersEmptyHtml(lang));
  await needPhone(ctx, lang, customerTexts[lang].phone.needForOrders);
}

/** Buyurtma kartasi; ko'rsatildimi — qaytaradi. Topilmasa "begona" va "mavjud emas" farqlanmaydi. */
async function showOrder(ctx: Ctx, customer: TelegramCustomer, id: number | null, fresh = false): Promise<boolean> {
  const lang = langOf(customer);
  const order = id ? await getOrder(await customerScope(customer), id) : null;
  if (!order) {
    // Xabarnomadagi tugma bosilgan bo'lsa xabar matni o'chib ketmasin: tahrirlamasdan, oyna bilan javob beramiz
    if (ctx.callback && !fresh) await ctx.answer(customerTexts[lang].card.notFound, true);
    else await ctx.reply(customerTexts[lang].card.notFound);
    return false;
  }
  await show(ctx, orderCardHtml(order, lang), orderCardKeyboard(order, lang, paymentUrl(order, lang)), fresh);
  return true;
}

async function showBalance(ctx: Ctx, customer: TelegramCustomer): Promise<void> {
  const lang = langOf(customer);
  const scope = await customerScope(customer);
  const debt = scope.phone ? await customerDebt(scope) : null;
  if (!debt) return needPhone(ctx, lang, customerTexts[lang].phone.needForBalance);
  await show(ctx, balanceHtml(debt, lang), balanceKeyboard(debt, lang));
}

/** Har doim yangi xabar: balans ostidagi tugmadan ochilganda balans xabari o'rnida qolsin */
async function showRequisites(ctx: Ctx, customer: TelegramCustomer): Promise<void> {
  await ctx.reply(requisitesHtml(await getSettings(), langOf(customer)));
}

async function showContacts(ctx: Ctx, customer: TelegramCustomer): Promise<void> {
  await ctx.reply(contactsHtml(await getSettings(), langOf(customer)));
}

async function showSettings(ctx: Ctx, customer: Pick<TelegramCustomer, 'lang' | 'notify' | 'phone'>): Promise<void> {
  const lang = langOf(customer);
  await show(ctx, settingsHtml(customer, lang), settingsKeyboard(customer, lang));
}

async function showMenu(ctx: Ctx, customer: TelegramCustomer, html: string): Promise<void> {
  await ctx.reply(html, { reply_markup: mainKeyboard(langOf(customer)) });
}

/**
 * Menyudan tashqari har qanday matn shu yerga keladi. AI ulangan bo'lsa (ANTHROPIC_API_KEY) savolga Claude javob beradi;
 * ulanmagan bo'lsa qisqa yo'riqnoma va menyu qaytariladi. Javob bir necha soniya olishi mumkin, Telegram esa webhook
 * javobini kutib turadi — shuning uchun javob fonda yuboriladi va webhook darhol 200 qaytaradi.
 */
async function fallback(ctx: Ctx, customer: TelegramCustomer): Promise<void> {
  const lang = langOf(customer);
  if (!aiConfigured()) return showMenu(ctx, customer, customerTexts[lang].fallback);
  // Stiker, ovozli xabar va shu kabilar: savol matni yo'q
  if (ctx.text.length < 2) return showMenu(ctx, customer, customerTexts[lang].ai.hint);
  void answerWithAi(ctx, customer).catch(async (e) => {
    // Webhook allaqachon javob bergan, bot.onError bu yerga yetmaydi: mijoz javobsiz qolmasin
    console.error('[bot:customer] ai', e);
    // Shu orada mijoz botdan chiqqan bo'lsa hech narsa yuborilmaydi; tilni almashtirgan bo'lsa — yangi tilda.
    // Yozuvni o'qib bo'lmasa (xato aynan bazada bo'lishi mumkin) boshidagi yozuv bilan javob beriladi
    const current = await botCustomer(ctx.from.id).catch(() => customer);
    if (!current || current.id !== customer.id) return;
    await showMenu(ctx, current, customerTexts[langOf(current)].ai.unavailable).catch(() => undefined);
  });
}

/** Javobni qochirilgan holda Telegram chegarasiga sig'dirish: avval qisqartiriladi, keyin esc() — belgi kodi (&amp;) o'rtasidan kesilmaydi */
function answerHtml(text: string): string {
  let raw = clip(text, 3500);
  let html = esc(raw);
  while (html.length > 4000) {
    // Bitta belgi qochirilganda ko'pi bilan 5 belgiga aylanadi (&amp;): ortiqchaning beshdan biricha qisqartiriladi — har aylanishda
    // kamida 1 belgi ketadi, lekin keragidan ortiq emas (ortiqchaning o'zicha qisqartirilsa "&" ko'p matn butunlay bo'shab qolardi)
    raw = clip(raw, raw.length - Math.max(1, Math.ceil((html.length - 4000) / 5)));
    html = esc(raw);
  }
  return html;
}

async function answerWithAi(ctx: Ctx, customer: TelegramCustomer): Promise<void> {
  const lang = langOf(customer);
  const typing = () => { void sendChatAction(ctx.token, ctx.chatId).catch(() => undefined); };
  typing();
  const timer = setInterval(typing, 4500);
  let reply: Awaited<ReturnType<typeof askAssistant>>;
  try {
    reply = await askAssistant({ scope: await customerScope(customer), lang, question: ctx.text });
  } finally {
    clearInterval(timer);
  }
  // Javob kelguncha mijoz botdan chiqqan (qayta kirgan bo'lsa ham — yozuv id si boshqa) yoki raqamini almashtirgan bo'lsa, eski
  // ma'lumotli javob yuborilmaydi va tarixda qolmaydi (askAssistant yozib qo'ygan tarix ham shu yerda o'chadi)
  const current = await botCustomer(ctx.from.id);
  if (!current || current.id !== customer.id || current.phone !== customer.phone) {
    await clearAssistantHistory(ctx.from.id).catch((e) => console.error('[bot:customer] ai tarixi', e));
    return;
  }
  // Til javob tayyorlanayotganda almashgan bo'lishi mumkin: klaviatura va matnlar yangi o'qilgan yozuvdan
  // Javob oddiy matn: HTML sifatida talqin qilinmasligi uchun qochiriladi
  if (reply.ok) return showMenu(ctx, current, answerHtml(reply.text));
  const t = customerTexts[langOf(current)].ai;
  if (reply.reason === 'busy') { await ctx.reply(t.busy); return; }
  await showMenu(ctx, current, reply.reason === 'limit' ? t.limit : t.unavailable);
}

// ─── Buyruqlar va menyu ──────────────────────────────────────────────────────

bot.command('start', personal(async (ctx) => {
  const payload = ctx.text.split(/\s+/)[1] ?? '';
  const token = TOKEN_RE.test(payload) ? payload : null;
  const customer = await enter(ctx, token);
  // Havola til tanlanishini kutmasdan bog'lanadi: mijoz tugmani bosmay chiqib ketsa ham holat xabarlari kelaveradi
  const link = await bindToken(ctx, token);
  if (customer) await welcome(ctx, customer, link);
}));

bot.command('orders', entered((ctx, customer) => showOrders(ctx, customer)));
bot.command('balance', entered(showBalance));
bot.command('lang', entered(async (ctx, customer) => {
  await ctx.reply(`${uz.lang.choose}\n${ru.lang.choose}`, { reply_markup: inline(langKeyboard(langOf(customer))) });
}));
bot.command('help', entered(async (ctx, customer) => showMenu(ctx, customer, helpHtml(langOf(customer), (await getSettings()).phone, aiConfigured()))));
bot.command('stop', loaded(async (ctx, customer) => {
  const lang = langOf(customer);
  await ctx.reply(customerTexts[lang].stop.confirm, { reply_markup: inline(stopConfirmKeyboard(lang)) });
}));

bot.hears(both((t) => t.menu.orders), entered((ctx, customer) => showOrders(ctx, customer)));
bot.hears(both((t) => t.menu.balance), entered(showBalance));
bot.hears(both((t) => t.menu.requisites), entered(showRequisites));
bot.hears(both((t) => t.menu.contacts), entered(showContacts));
bot.hears(both((t) => t.menu.settings), entered(showSettings));
bot.hears(both((t) => t.phone.later), entered((ctx, customer) => showMenu(ctx, customer, customerTexts[langOf(customer)].phone.laterNote)));

// ─── Telefonni ulash ─────────────────────────────────────────────────────────

bot.contact(loaded(async (ctx, customer) => {
  const lang = langOf(customer);
  const contact = ctx.message?.contact;
  // Faqat o'z kontakti: birovning raqami (yoki uzatilgan kontakt) bilan begona buyurtma va qarzni ochib bo'lmasin
  if (!contact || contact.user_id !== ctx.from.id) {
    await ctx.reply(customerTexts[lang].phone.notOwn, { reply_markup: contactKeyboard(lang) });
    return;
  }
  const linked = await linkCustomerPhone(ctx.from.id, contact.phone_number, fullName(ctx.from));
  if (!linked?.phone) return showMenu(ctx, customer, phoneUnsupportedHtml(lang, (await getSettings()).phone));
  const { total } = await listOrders(await customerScope(linked), 0, 1);
  await showMenu(ctx, linked, phoneLinkedHtml(lang, linked.phone, total));
}));

bot.callback(CB.phone, loaded(async (ctx, customer) => {
  const lang = langOf(customer);
  await ctx.reply(customer.phone ? customerTexts[lang].phone.change : customerTexts[lang].phone.why, { reply_markup: contactKeyboard(lang) });
}));

// ─── Inline tugmalar ─────────────────────────────────────────────────────────

bot.callback(CB.order, loaded(async (ctx, customer) => {
  const shown = await showOrder(ctx, customer, idFrom(ctx.data, CB.order));
  if (shown && isRefresh(ctx)) await ctx.answer(customerTexts[langOf(customer)].card.refreshed);
}));

bot.callback(CB.list, loaded((ctx, customer) => showOrders(ctx, customer, pageFrom(ctx.data))));

bot.callback(CB.requisites, loaded(showRequisites));

bot.callback(CB.lang, loaded(async (ctx, customer) => {
  const lang = ctx.data.slice(CB.lang.length);
  if (!isBotLang(lang)) return;
  const sess = await ctx.session<Session>();
  // Til o'zgarmadi (birinchi tanlovdagi tugma ikki marta bosildi yoki tanlangan tilning o'zi): xabar va klaviaturaga tegilmaydi
  const firstRun = !!sess?.askLang || isExpiredFirstPrompt(ctx);
  if (!firstRun && langOf(customer) === lang) return ctx.answer(customerTexts[lang].lang.chosen);
  await setCustomerLang(ctx.from.id, lang);
  const updated = { ...customer, lang };
  if (!firstRun) {
    // Sozlamalardan almashtirildi: reply-klaviatura faqat yangi xabar bilan yangilanadi
    await showSettings(ctx, updated);
    await showMenu(ctx, updated, customerTexts[lang].lang.changed);
    return;
  }
  // Birinchi murojaat: til tanlandi — salomlashuv va (bo'lsa) /start havolasidagi buyurtma bilan davom etamiz
  await ctx.clearSession();
  await ctx.edit(customerTexts[lang].lang.chosen);
  await welcome(ctx, updated, await bindToken(ctx, sess?.token));
}));

bot.callback(CB.notify, loaded(async (ctx, customer) => {
  const value = ctx.data.slice(CB.notify.length);
  if (value !== 'on' && value !== 'off') return;
  const notify = value === 'on';
  await setCustomerNotify(ctx.from.id, notify);
  await showSettings(ctx, { ...customer, notify });
  await ctx.answer(notify ? customerTexts[langOf(customer)].settings.turnedOn : customerTexts[langOf(customer)].settings.turnedOff);
}));

bot.callback(CB.stop, loaded(async (ctx, customer) => {
  const lang = langOf(customer);
  const step = ctx.data.slice(CB.stop.length);
  if (step === 'ask') return ctx.edit(customerTexts[lang].stop.confirm, stopConfirmKeyboard(lang));
  if (step !== 'yes') return showSettings(ctx, customer);
  await unlinkCustomer(ctx.from.id);
  await ctx.clearSession();
  // AI suhbat tarixida buyurtma va qarz ma'lumoti bor: u ham uziladi (xatosi chiqishni to'xtatmaydi)
  await clearAssistantHistory(ctx.from.id).catch((e) => console.error('[bot:customer] ai tarixi', e));
  await ctx.edit(customerTexts[lang].stop.done);
  await ctx.reply(customerTexts[lang].stop.bye, { reply_markup: removeKeyboard });
}));

// ─── Boshqa matn ─────────────────────────────────────────────────────────────

bot.text(entered(async (ctx, customer) => {
  const lang = langOf(customer);
  // Yozib yuborilgan raqam hech narsani ulamaydi: faqat tugma orqali ulashish yo'riqnomasi.
  // Telefoni ulangan mijozga bu yo'riqnoma kerak emas (yozgani STIR yoki to'lov raqami bo'lishi mumkin) — menyu joyida qoladi
  if (!customer.phone && looksLikePhone(ctx.text)) {
    await ctx.reply(customerTexts[lang].phone.typed, { reply_markup: contactKeyboard(lang) });
    return;
  }
  await fallback(ctx, customer);
}));

// Xato matni mijozga chiqmaydi (logda qoladi). Til bazadan o'qilmaydi — xato aynan bazada bo'lishi mumkin, shuning uchun ikki tilda.
bot.onError(async (_e, ctx) => {
  const text = `${uz.error}\n${ru.error}`;
  if (ctx.callback) await ctx.answer(text, true);
  else await ctx.reply(text);
});
