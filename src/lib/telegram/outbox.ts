import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { clip, sendMessage, TelegramError, type InlineKeyboard } from './api';
import { BOT_KINDS, botToken, isBotKind, type BotKind } from './bots';
import { botCustomer } from './customers';
import { staffByTelegram } from './staffLink';

/**
 * Xabarnomalar navbati. Telegram vaqtincha javob bermasa (tarmoq uzilishi, 5xx, 429) xabar yo'qolmaydi: shu jadvalga
 * tushadi va davriy signal (cron tick, har 5 daqiqada) uni qayta yuboradi. Urinishlar oralig'i o'sib boradi; bir kunga
 * yaqin vaqtda ham yetib bormasa "yuborilmadi" deb belgilanadi va kunlik tekshiruvda ko'rinadi.
 * Doimiy xatolar (mijoz botni bloklagan, chat topilmadi, matn yaroqsiz) navbatga tushmaydi — qayta urinish foydasiz.
 * Kafolat "kamida bir marta": javobi yo'qolgan, lekin aslida yetib borgan xabar ikkinchi marta ham borishi mumkin.
 * Mavzu (topic): bitta narsaning HOLATI haqidagi xabarlar (masalan buyurtma holati) uchun — yangi xabar chiqqanda navbatda
 * turgan eski holat bekor bo'ladi, aks holda mijoz "Yetkazildi"dan keyin kechikkan "Yo'lda"ni olardi.
 */

/** Keyingi urinishgacha kutish, daqiqa: 1-urinish darhol (notify), keyin 5 daq, 15 daq, 1 soat, 3 soat, 12 soat */
const BACKOFF_MIN = [5, 15, 60, 180, 720];
export const OUTBOX_MAX_ATTEMPTS = BACKOFF_MIN.length + 1;
const BATCH = 40; // bitta tick'da ko'pi bilan
/** Shu vaqtdan keyin yangi xabar yuborish boshlanmaydi. Boshlangan yuborish 10 s gacha cho'zilishi mumkin, ya'ni Telegram javob bermayotganda flush ~25 s oladi */
const FLUSH_BUDGET_MS = 15_000;
const KEEP_SENT_DAYS = 3;
const KEEP_FAILED_DAYS = 30;
const EXPIRE_NO_TOKEN_DAYS = 2;
/** Yangi xabar o'rnini bosgan (eskirgan) navbat yozuvining belgisi: "yetkazilmadi" hisobiga kirmaydi */
const SUPERSEDED = 'eskirgan';

const MINUTE = 60_000;
const DAY = 86_400_000;
const nextAfter = (attempts: number, now: Date) => new Date(now.getTime() + BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length) - 1] * MINUTE);

/** Qayta urinish foydalimi: tarmoq xatosi, vaqt tugashi, Telegram 5xx yoki 429. 400/401/403 (chat yo'q, token xato, bot bloklangan) — yo'q */
export function retryable(e: unknown): boolean {
  if (e instanceof TelegramError) return e.code === 429 || e.code >= 500;
  return true;
}

const errorText = (e: unknown) => clip(e instanceof Error ? e.message : String(e), 300);

/** Shu oluvchiga shu mavzudagi navbatda turgan xabarlarni bekor qilish (yangisi chiqdi). O'chirilmaydi — belgilanadi: ayni paytda yuborilayotgan yozuv "topilmadi" xatosiga uchramasin */
export async function supersede(kind: BotKind, chatId: number | string, topic: string, now = new Date()): Promise<void> {
  await prisma.botOutbox.updateMany({ where: { bot: kind, chatId: String(chatId), topic, sentAt: null, failedAt: null }, data: { failedAt: now, lastError: SUPERSEDED } });
}

/** Mavzusi shu bilan boshlanadigan navbatdagi xabarlarni (hamma oluvchilarda) bekor qilish — masalan bekor qilingan buyurtmaning ishlab chiqarish xabarlari */
export async function supersedePrefix(kind: BotKind, prefix: string, now = new Date()): Promise<void> {
  await prisma.botOutbox.updateMany({ where: { bot: kind, topic: { startsWith: prefix }, sentAt: null, failedAt: null }, data: { failedAt: now, lastError: SUPERSEDED } });
}

/** Darhol yuborib bo'lmagan xabarni navbatga qo'yish (birinchi urinish allaqachon bo'lgan) */
export async function enqueue(kind: BotKind, chatId: number | string, html: string, inline: InlineKeyboard | undefined, error: unknown, now = new Date(), topic?: string): Promise<void> {
  if (topic) await supersede(kind, chatId, topic, now);
  // Telegram "N soniyadan keyin qayta urining" desa (429), undan oldin urinilmaydi
  const wait = error instanceof TelegramError && error.retryAfter ? Math.max(error.retryAfter * 1000, BACKOFF_MIN[0] * MINUTE) : BACKOFF_MIN[0] * MINUTE;
  await prisma.botOutbox.create({
    data: { bot: kind, chatId: String(chatId), topic: topic ?? null, html, inline: (inline ?? undefined) as Prisma.InputJsonValue | undefined, attempts: 1, nextAt: new Date(now.getTime() + wait), lastError: errorText(error) },
  });
}

/**
 * Xabar navbatda turgan paytda oluvchi uzilgan bo'lishi mumkin (xodim ishdan ketgan, mijoz botdan chiqqan): xodim — faol, ulangan va
 * xabarnomasi yoniq bo'lsa; mijoz — yozuvi bo'lsa xabarnomasi yoniq, yozuvi yo'q chat esa faqat havola orqali ulangan buyurtmasi bo'lsa.
 */
async function stillRecipient(bot: BotKind, chatId: string): Promise<boolean> {
  if (bot === 'staff') return (await staffByTelegram(chatId))?.telegramNotify === true;
  const c = await botCustomer(chatId);
  if (c) return c.notify;
  return (await prisma.order.count({ where: { telegramUserId: chatId, deletedAt: null } })) > 0;
}

export type FlushResult = { sent: number; retry: number; failed: number };

/** Vaqti kelgan xabarlarni qayta yuborish va eski yozuvlarni tozalash (cron tick chaqiradi) */
export async function flushOutbox(now = new Date()): Promise<FlushResult> {
  const out: FlushResult = { sent: 0, retry: 0, failed: 0 };
  const started = Date.now();
  // Tokeni yo'q botning xabarlari tanlanmaydi: aks holda ular to'plamni egallab, boshqa botning navbatini to'sib qo'yardi
  const live = BOT_KINDS.filter((k) => botToken(k));
  const due = live.length ? await prisma.botOutbox.findMany({ where: { bot: { in: live }, sentAt: null, failedAt: null, nextAt: { lte: now } }, orderBy: { id: 'asc' }, take: BATCH }) : [];
  for (const row of due) {
    if (Date.now() - started > FLUSH_BUDGET_MS) break;
    const token = isBotKind(row.bot) ? botToken(row.bot) : null;
    if (!token || !isBotKind(row.bot)) continue;
    // Oluvchi uzilgan: xabar yuborilmaydi va o'chiriladi — "yuborilmadi" deb sanalmaydi, chunki bu Telegram xatosi emas
    if (!(await stillRecipient(row.bot, row.chatId))) {
      await prisma.botOutbox.deleteMany({ where: { id: row.id, attempts: row.attempts, sentAt: null, failedAt: null } });
      continue;
    }
    const attempts = row.attempts + 1;
    // Avval "band qilinadi": shartli yangilanish ikki jarayon bir xabarni baravar yuborishining oldini oladi, keyingi vaqt esa
    // oldindan qo'yiladi — yuborish o'rtasida jarayon o'chsa xabar yo'qolmaydi, keyinroq qayta uriniladi
    const claimed = await prisma.botOutbox.updateMany({ where: { id: row.id, attempts: row.attempts, sentAt: null, failedAt: null }, data: { attempts, nextAt: nextAfter(attempts, now) } });
    if (claimed.count !== 1) continue;
    try {
      const inline = Array.isArray(row.inline) ? (row.inline as unknown as InlineKeyboard) : undefined;
      await sendMessage(token, row.chatId, row.html, inline ? { reply_markup: { inline_keyboard: inline } } : {});
      // Shartli: shu orada yangi xabar o'rnini bosgan (eskirgan deb belgilangan) yozuv "yuborildi"ga qayta yozilmaydi
      await prisma.botOutbox.updateMany({ where: { id: row.id, failedAt: null }, data: { sentAt: now, lastError: null } });
      out.sent += 1;
    } catch (e) {
      const final = !retryable(e) || attempts >= OUTBOX_MAX_ATTEMPTS;
      const wait = e instanceof TelegramError && e.retryAfter ? new Date(Math.max(now.getTime() + e.retryAfter * 1000, nextAfter(attempts, now).getTime())) : undefined;
      await prisma.botOutbox
        .updateMany({ where: { id: row.id, failedAt: null }, data: { lastError: errorText(e), ...(final ? { failedAt: now } : wait ? { nextAt: wait } : {}) } })
        .catch((err) => console.error('[outbox] holatni yozib bo\'lmadi', row.id, err));
      if (final) out.failed += 1;
      else out.retry += 1;
    }
  }
  // Token 2 kunda ham qaytmasa (yoki bot turi olib tashlangan bo'lsa) xabar eskirgan: "yuborilmadi" bo'ladi, 30 kundan keyin tozalanadi
  await prisma.botOutbox
    .updateMany({ where: { bot: { notIn: live }, sentAt: null, failedAt: null, createdAt: { lt: new Date(now.getTime() - EXPIRE_NO_TOKEN_DAYS * DAY) } }, data: { failedAt: now, lastError: "bot tokeni yo'q" } })
    .catch((e) => console.error('[outbox] eskirganlarni belgilash', e));
  await prisma.botOutbox
    .deleteMany({ where: { OR: [{ sentAt: { lt: new Date(now.getTime() - KEEP_SENT_DAYS * DAY) } }, { failedAt: { lt: new Date(now.getTime() - KEEP_FAILED_DAYS * DAY) } }] } })
    .catch((e) => console.error('[outbox] tozalash', e));
  return out;
}

/** Navbat holati (kunlik tekshiruv va admin sahifasi uchun): kutayotganlar, bir soatdan beri kutayotganlar, oxirgi 24 soatda yuborilmaganlar (eskirib, o'rnini yangisi bosganlar sanalmaydi) */
export async function outboxStats(now = new Date()): Promise<{ pending: number; stuck: number; failed24h: number }> {
  const [pending, stuck, failed24h] = await Promise.all([
    prisma.botOutbox.count({ where: { sentAt: null, failedAt: null } }),
    prisma.botOutbox.count({ where: { sentAt: null, failedAt: null, createdAt: { lt: new Date(now.getTime() - 60 * MINUTE) } } }),
    // OR: SQL'da NOT (lastError = 'eskirgan') xatosi yozilmagan (NULL) yozuvlarni ham tashlab yuborardi
    prisma.botOutbox.count({ where: { failedAt: { gt: new Date(now.getTime() - DAY) }, OR: [{ lastError: null }, { lastError: { not: SUPERSEDED } }] } }),
  ]);
  return { pending, stuck, failed24h };
}
