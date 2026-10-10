import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { BotKind } from './bots';

/** Sessiya kaliti: bot turi yoki shu botning suhbat sessiyasidan alohida turadigan hisoblagichi (clearSession(bot) uni o'chirmaydi) */
export type SessionScope = BotKind | 'staff_code';

/**
 * Bot suhbat holati bazada (BotSession). Har bir webhook alohida so'rov bo'lgani uchun
 * xotiradagi Map ishlamaydi; server qayta ishga tushganda ham holat saqlanib qoladi.
 * 7 kundan eski sessiyalar vaqti-vaqti bilan o'chiriladi.
 */
export async function getSession<T extends object>(bot: SessionScope, telegramId: number | string): Promise<T | null> {
  const row = await prisma.botSession.findUnique({ where: { bot_telegramId: { bot, telegramId: String(telegramId) } } });
  if (!row) return null;
  if (row.updatedAt.getTime() < Date.now() - 7 * 86_400_000) return null;
  return row.data as T;
}

export async function setSession<T extends object>(bot: SessionScope, telegramId: number | string, data: T): Promise<void> {
  const value = data as unknown as Prisma.InputJsonValue;
  await prisma.botSession.upsert({
    where: { bot_telegramId: { bot, telegramId: String(telegramId) } },
    create: { bot, telegramId: String(telegramId), data: value },
    update: { data: value },
  });
  if (Math.random() < 0.02) {
    await prisma.botSession.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } }).catch(() => undefined);
  }
}

export async function clearSession(bot: SessionScope, telegramId: number | string): Promise<void> {
  await prisma.botSession.deleteMany({ where: { bot, telegramId: String(telegramId) } });
}
