import 'server-only';
import { prisma } from '@/lib/db';
import { sendMessage, type InlineKeyboard, type SendOptions } from './api';
import { botToken, hqAllowedIds, type BotKind } from './bots';
import { notifyAdmins } from '@/lib/telegram';

/**
 * Botlararo xabar yuborish: mijozga mijoz boti, haydovchiga haydovchi boti, masul va rahbariyatga (HQ) boshqaruv boti orqali.
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
export const notifyDriver = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard) => notify('driver', tgId, html, inline);
export const notifySupervisor = (tgId: string | null | undefined, html: string, inline?: InlineKeyboard) => notify('supervisor', tgId, html, inline);

/** Barcha faol HQ adminlarga (bazadagi + .env dagi doimiy ID'lar) */
export async function notifyHqAdmins(html: string, inline?: InlineKeyboard): Promise<number> {
  if (!botToken('hq')) return 0;
  const rows = await prisma.telegramHqAdmin.findMany({ where: { isActive: true, telegramId: { not: null } }, select: { telegramId: true } });
  const ids = new Set<string>([...rows.map((r) => r.telegramId!).filter(Boolean), ...hqAllowedIds()]);
  let sent = 0;
  for (const id of ids) if (await notify('hq', id, html, inline)) sent += 1;
  return sent;
}

/** Umumiy admin guruhi (TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID): buyurtma/ariza xabarlari bilan bir xil kanal */
export const notifyOpsChat = (lines: (string | null | undefined)[]) => notifyAdmins(lines);
