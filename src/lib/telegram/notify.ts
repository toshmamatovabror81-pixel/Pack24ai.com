import 'server-only';
import { sendMessage, type InlineKeyboard, type SendOptions } from './api';
import { botToken, type BotKind } from './bots';
import { enqueue, retryable, supersede } from './outbox';

/**
 * Mavzuli xabarlarning CHIQARILISH tartibi. Ikki yuborish ustma-ust tushsa (ikki xodim bitta buyurtmani ketma-ket o'zgartirdi,
 * birinchisining so'rovi hali Telegram javobini kutmoqda) qaysi biri oldin tugagani emas, qaysi biri keyin chiqarilgani hal qiladi:
 * eski xabar yangisini bekor qilmaydi va undan keyin navbatga ham tushmaydi. Ilova bitta jarayon — xotiradagi hisob yetarli;
 * globalThis: Next modulni bir necha nusxada yig'sa ham hisob bitta bo'lib qoladi.
 */
const g = globalThis as unknown as { p24NotifyLatest?: Map<string, number>; p24NotifySeq?: number };
const latest = (g.p24NotifyLatest ??= new Map<string, number>());

/**
 * Bot orqali xabar yuborish: mijozga mijoz boti, xodimga boshqaruv boti orqali.
 * Token sozlanmagan yoki foydalanuvchi botni bloklagan bo'lsa jim o'tadi (false qaytaradi) — biznes jarayon to'xtamaydi.
 * Telegram vaqtincha javob bermasa (tarmoq, 5xx, 429) xabar navbatga tushadi va keyinroq qayta yuboriladi (outbox.ts);
 * bu holda ham false qaytadi — "hozir yetib bormadi".
 * `topic` — bitta narsaning holati haqidagi xabarlar uchun (masalan `order-status:15`): yangi xabar chiqqanda shu oluvchining
 * navbatda turgan shu mavzudagi eski xabari bekor bo'ladi (kechikib, yangisidan keyin yetib bormasin).
 */
export async function notify(kind: BotKind, chatId: number | string | null | undefined, html: string, inline?: InlineKeyboard, opts: SendOptions = {}, topic?: string): Promise<boolean> {
  const token = botToken(kind);
  if (!token || !chatId) return false;
  const key = topic ? `${kind}:${chatId}:${topic}` : null;
  const mine = (g.p24NotifySeq = (g.p24NotifySeq ?? 0) + 1);
  if (key) latest.set(key, mine);
  // Shu mavzuda mendan keyin yangi xabar chiqmagan bo'lsagina navbatga tegaman
  const newest = () => !key || latest.get(key) === mine;
  try {
    await sendMessage(token, chatId, html, { ...opts, ...(inline ? { reply_markup: { inline_keyboard: inline } } : {}) });
    if (topic && newest()) await supersede(kind, chatId, topic).catch((e) => console.error(`[notify:${kind}] navbat`, e instanceof Error ? e.message : e));
    return true;
  } catch (e) {
    console.error(`[notify:${kind}] ${chatId}`, e instanceof Error ? e.message : e);
    // Navbatga faqat oddiy xabar (matn + inline tugmalar) qo'yiladi; navbat xatosi biznes jarayonni to'xtatmaydi.
    // Yuborilayotgan paytda shu mavzuda yangisi chiqqan bo'lsa bu xabar eskirgan — navbatga qo'yilmaydi
    if (retryable(e) && newest()) await enqueue(kind, chatId, html, inline, e, new Date(), topic).catch((err) => console.error(`[notify:${kind}] navbatga yozilmadi`, err instanceof Error ? err.message : err));
    return false;
  } finally {
    // Yo'lda hech narsa qolmaganda hisob bo'shaydi (xotira o'smaydi)
    if (key && latest.get(key) === mine) latest.delete(key);
  }
}

/**
 * Mavzusi shu bilan boshlanadigan, ayni paytda YUBORILAYOTGAN (Telegram javobini kutayotgan) xabarlarni eskirgan deb belgilash:
 * ular o'tmasa navbatga qo'yilmaydi. supersedePrefix (outbox.ts) faqat navbatda turganlarini bekor qiladi — bu uning juftligi.
 */
export function staleInFlight(kind: BotKind, topicPrefix: string): void {
  for (const key of [...latest.keys()]) {
    // Kalit: <bot>:<chat>:<mavzu> — chat raqamida ":" bo'lmaydi, mavzuda bo'lishi mumkin
    const [bot, , ...topic] = key.split(':');
    if (bot === kind && topic.join(':').startsWith(topicPrefix)) latest.delete(key);
  }
}

export const notifyCustomer = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard, topic?: string) => notify('customer', tgId, html, inline, {}, topic);
export const notifyStaff = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard) => notify('staff', tgId, html, inline);
