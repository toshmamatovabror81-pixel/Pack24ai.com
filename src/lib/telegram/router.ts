import 'server-only';
import {
  answerCallbackQuery, editMessageReplyMarkup, editMessageText, sendLocation, sendMessage,
  type InlineKeyboard, type SendOptions, type TgCallbackQuery, type TgMessage, type TgUpdate, type TgUser,
} from './api';
import { botToken, type BotKind } from './bots';
import { clearSession, getSession, setSession } from './session';

/**
 * Kichik bot marshrutlagichi: buyruqlar, tugma matnlari, kontakt, joylashuv, rasm, callback prefikslari.
 * Har bir webhook so'rovi bitta update: handle(update) -> mos handler.
 */
export type Ctx = {
  kind: BotKind;
  token: string;
  update: TgUpdate;
  chatId: number;
  from: TgUser;
  /** Kelgan xabar (callback bo'lsa — tugma bosilgan xabar) */
  message?: TgMessage;
  /** Matn (xabar matni yoki rasm izohi), bo'lmasa '' */
  text: string;
  callback?: TgCallbackQuery;
  /** callback_data, bo'lmasa '' */
  data: string;
  reply: (html: string, opts?: SendOptions) => Promise<TgMessage | null>;
  /** Callback bosilgan xabarni tahrirlash (tugmalarni olib tashlaydi yoki yangilarini qo'yadi) */
  edit: (html: string, inline?: InlineKeyboard) => Promise<void>;
  /** Callback'ga javob (soat belgisini o'chiradi); alert=true bo'lsa oyna chiqadi */
  answer: (text?: string, alert?: boolean) => Promise<void>;
  sendLocation: (lat: number, lng: number) => Promise<void>;
  session: <T extends object>() => Promise<T | null>;
  setSession: <T extends object>(data: T) => Promise<void>;
  clearSession: () => Promise<void>;
};

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
type Matcher = string | string[] | RegExp;

const matches = (m: Matcher, text: string) =>
  m instanceof RegExp ? m.test(text) : Array.isArray(m) ? m.includes(text) : m === text;

export class Bot {
  private commands = new Map<string, Handler>();
  private hearsList: { m: Matcher; h: Handler }[] = [];
  private callbacks: { prefix: string; h: Handler }[] = [];
  private contactH?: Handler;
  private locationH?: Handler;
  private photoH?: Handler;
  private textH?: Handler;
  private errorH?: (e: unknown, ctx: Ctx) => Promise<unknown> | unknown;

  constructor(public kind: BotKind) {}

  /** /start, /help ... (argumentlar ctx.text da qoladi) */
  command(name: string, h: Handler) { this.commands.set(name, h); return this; }
  /** Reply-klaviatura tugmasi yoki aniq matn */
  hears(m: Matcher, h: Handler) { this.hearsList.push({ m, h }); return this; }
  /** callback_data prefiksi, masalan 'accept_' -> ctx.data = 'accept_12' */
  callback(prefix: string, h: Handler) { this.callbacks.push({ prefix, h }); return this; }
  contact(h: Handler) { this.contactH = h; return this; }
  location(h: Handler) { this.locationH = h; return this; }
  photo(h: Handler) { this.photoH = h; return this; }
  /** Boshqa hech narsaga mos kelmagan matn (suhbat bosqichlari uchun) */
  text(h: Handler) { this.textH = h; return this; }
  onError(h: (e: unknown, ctx: Ctx) => Promise<unknown> | unknown) { this.errorH = h; return this; }

  async handle(update: TgUpdate): Promise<void> {
    const token = botToken(this.kind);
    if (!token) return;
    const msg = update.message ?? update.edited_message;
    const cb = update.callback_query;
    const from = cb?.from ?? msg?.from;
    const chatId = cb?.message?.chat.id ?? msg?.chat.id;
    if (!from || chatId == null || from.is_bot) return;
    const message = cb?.message ?? msg;
    const text = (msg?.text ?? msg?.caption ?? '').trim();
    // Callback'ga Telegram faqat bitta javobni qabul qiladi: handler o'zi javob bergan bo'lsa, oxiridagi bo'sh javob yuborilmaydi
    let answered = false;
    const ctx: Ctx = {
      kind: this.kind, token, update, chatId, from, message, text, callback: cb, data: cb?.data ?? '',
      reply: (html, opts) => sendMessage(token, chatId, html, opts).catch((e) => { console.error(`[bot:${this.kind}] reply`, e); return null; }),
      edit: async (html, inlineKb) => {
        if (!cb?.message) { await sendMessage(token, chatId, html, inlineKb ? { reply_markup: { inline_keyboard: inlineKb } } : {}).catch(() => null); return; }
        await editMessageText(token, chatId, cb.message.message_id, html, inlineKb).catch((e) => { if (!String(e).includes('message is not modified')) console.error(`[bot:${this.kind}] edit`, e); });
      },
      answer: async (t, alert) => {
        if (!cb || answered) return;
        answered = true;
        await answerCallbackQuery(token, cb.id, t, alert).catch(() => undefined);
      },
      sendLocation: async (lat, lng) => { await sendLocation(token, chatId, lat, lng).catch(() => undefined); },
      session: <T extends object>() => getSession<T>(this.kind, from.id),
      setSession: (d) => setSession(this.kind, from.id, d),
      clearSession: () => clearSession(this.kind, from.id),
    };
    try {
      if (cb) {
        const h = this.callbacks.find((c) => ctx.data.startsWith(c.prefix));
        if (h) {
          await h.h(ctx);
          await ctx.answer();
          return;
        }
        // Eskirgan tugma (masalan olib tashlangan bo'limdan qolgan): jim qolmaymiz va tugmalarni olib tashlaymiz
        await ctx.answer('Bu tugma endi ishlamaydi. /start bosing.\nКнопка больше не работает, нажмите /start.', true);
        if (cb.message) await editMessageReplyMarkup(token, chatId, cb.message.message_id).catch(() => undefined);
        return;
      }
      if (!msg) return;
      if (msg.contact && this.contactH) return void (await this.contactH(ctx));
      if (msg.location && this.locationH) return void (await this.locationH(ctx));
      if (msg.photo?.length && this.photoH) return void (await this.photoH(ctx));
      if (text.startsWith('/')) {
        const name = text.slice(1).split(/[\s@]/)[0].toLowerCase();
        const h = this.commands.get(name);
        if (h) return void (await h(ctx));
      }
      const heard = this.hearsList.find((x) => matches(x.m, text));
      if (heard) return void (await heard.h(ctx));
      if (this.textH) await this.textH(ctx);
    } catch (e) {
      console.error(`[bot:${this.kind}] handler`, e);
      if (this.errorH) await this.errorH(e, ctx);
      else if (cb) await ctx.answer('Xatolik yuz berdi', true);
      else await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring yoki /start bosing.");
    }
  }
}

export const createBot = (kind: BotKind) => new Bot(kind);

/** callback_data dan raqamli id: 'accept_12' -> 12 (yo'q bo'lsa null) */
export function idFrom(data: string, prefix: string): number | null {
  const n = Number(data.slice(prefix.length).split('_')[0]);
  return Number.isSafeInteger(n) && n > 0 && n < 2147483647 ? n : null;
}
