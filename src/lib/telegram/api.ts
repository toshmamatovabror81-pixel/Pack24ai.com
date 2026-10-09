import 'server-only';

/**
 * Telegram Bot API: kutubxonasiz, fetch orqali. Faqat kerakli metodlar.
 * Har bir chaqiruv 10 soniyada uziladi; xatolar TelegramError bilan qaytadi (chaqiruvchi ushlaydi).
 */

export type InlineButton = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
export type InlineKeyboard = InlineButton[][];
export type ReplyButton = { text: string; request_contact?: boolean; request_location?: boolean };
export type ReplyKeyboard = { keyboard: ReplyButton[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean };
export type RemoveKeyboard = { remove_keyboard: true };
export type ReplyMarkup = { inline_keyboard: InlineKeyboard } | ReplyKeyboard | RemoveKeyboard;

export type TgUser = { id: number; is_bot?: boolean; first_name: string; last_name?: string; username?: string; language_code?: string };
export type TgChat = { id: number; type: string; title?: string };
export type TgContact = { phone_number: string; first_name: string; last_name?: string; user_id?: number };
export type TgLocation = { latitude: number; longitude: number };
export type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number };
export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  contact?: TgContact;
  location?: TgLocation;
  photo?: TgPhotoSize[];
  caption?: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
};
export type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: TgCallbackQuery };

export class TelegramError extends Error {
  constructor(public method: string, public code: number, description: string) {
    super(`Telegram ${method}: ${code} ${description}`);
  }
}

/** HTML parse_mode uchun foydalanuvchi matnini qochirish (ism, izoh va h.k.) */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

/** Test uchun almashtirish mumkin (TELEGRAM_API_BASE=http://localhost:8081 — soxta server) */
export const apiBase = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');

export async function call<T = unknown>(token: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({ ok: false, description: 'invalid json' }))) as { ok: boolean; result?: T; error_code?: number; description?: string };
  if (!json.ok) throw new TelegramError(method, json.error_code ?? res.status, json.description ?? 'unknown error');
  return json.result as T;
}

export type SendOptions = { reply_markup?: ReplyMarkup; disable_web_page_preview?: boolean; disable_notification?: boolean };

export function sendMessage(token: string, chatId: number | string, html: string, opts: SendOptions = {}) {
  return call<TgMessage>(token, 'sendMessage', { chat_id: chatId, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, ...opts });
}

export function editMessageText(token: string, chatId: number | string, messageId: number, html: string, inline?: InlineKeyboard) {
  return call<TgMessage | true>(token, 'editMessageText', {
    chat_id: chatId, message_id: messageId, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: inline ? { inline_keyboard: inline } : { inline_keyboard: [] },
  });
}

/** Faqat tugmalarni o'zgartirish/olib tashlash (matn va HTML formati saqlanadi) */
export function editMessageReplyMarkup(token: string, chatId: number | string, messageId: number, inline?: InlineKeyboard) {
  return call<true>(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: inline ?? [] } });
}

export function answerCallbackQuery(token: string, id: string, text?: string, alert = false) {
  return call<true>(token, 'answerCallbackQuery', { callback_query_id: id, text: text?.slice(0, 200), show_alert: alert });
}

export function sendLocation(token: string, chatId: number | string, lat: number, lng: number) {
  return call<TgMessage>(token, 'sendLocation', { chat_id: chatId, latitude: lat, longitude: lng });
}

export function getMe(token: string) {
  return call<TgUser>(token, 'getMe');
}

export function setWebhook(token: string, url: string, secret: string) {
  return call<true>(token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
}

export function deleteWebhook(token: string) {
  return call<true>(token, 'deleteWebhook', { drop_pending_updates: false });
}

export function getWebhookInfo(token: string) {
  return call<{ url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number }>(token, 'getWebhookInfo');
}

export function setMyCommands(token: string, commands: { command: string; description: string }[]) {
  return call<true>(token, 'setMyCommands', { commands });
}

export function setChatMenuButton(token: string, text: string, url: string) {
  return call<true>(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text, web_app: { url } } });
}

/** Telegram'dagi faylni (rasm) yuklab olish: Buffer + fayl yo'li. Token havolasi bazaga YOZILMAYDI. */
export async function downloadFile(token: string, fileId: string): Promise<{ buffer: Buffer; path: string } | null> {
  const info = await call<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId });
  if (!info.file_path) return null;
  if ((info.file_size ?? 0) > 10 * 1024 * 1024) return null;
  const res = await fetch(`${apiBase()}/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return { buffer: Buffer.from(await res.arrayBuffer()), path: info.file_path };
}

export const inline = (rows: InlineKeyboard): { inline_keyboard: InlineKeyboard } => ({ inline_keyboard: rows });
export const keyboard = (rows: (string | ReplyButton)[][], opts: Partial<ReplyKeyboard> = {}): ReplyKeyboard => ({
  keyboard: rows.map((r) => r.map((b) => (typeof b === 'string' ? { text: b } : b))),
  resize_keyboard: true,
  ...opts,
});
export const removeKeyboard: RemoveKeyboard = { remove_keyboard: true };
