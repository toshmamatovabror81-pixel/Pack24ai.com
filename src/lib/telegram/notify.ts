import 'server-only';
import { sendMessage, type InlineKeyboard, type SendOptions } from './api';
import { botToken, type BotKind } from './bots';

/**
 * Bot orqali xabar yuborish: mijozga mijoz boti, xodimga boshqaruv boti orqali.
 * Token sozlanmagan yoki foydalanuvchi botni bloklagan bo'lsa jim o'tadi (false qaytaradi) — biznes jarayon to'xtamaydi.
 */
export async function notify(kind: BotKind, chatId: number | string | null | undefined, html: string, inline?: InlineKeyboard, opts: SendOptions = {}): Promise<boolean> {
  const token = botToken(kind);
  if (!token || !chatId) return false;
  try {
    await sendMessage(token, chatId, html, { ...opts, ...(inline ? { reply_markup: { inline_keyboard: inline } } : {}) });
    return true;
  } catch (e) {
    console.error(`[notify:${kind}] ${chatId}`, e instanceof Error ? e.message : e);
    return false;
  }
}

export const notifyCustomer = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard) => notify('customer', tgId, html, inline);
export const notifyStaff = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard) => notify('staff', tgId, html, inline);
