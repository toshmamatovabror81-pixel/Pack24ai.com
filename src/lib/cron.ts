import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { sendDailyDigest } from './orderNotify';

/**
 * Davriy ishlar. Server cron'i (deploy/auto-update.sh, har 5 daqiqada) POST /api/cron/tick yuboradi; qaysi ish
 * qachon bajarilgani SiteSetting("cron") da saqlanadi, shuning uchun qayta ishga tushirish yoki takroriy tick zarar qilmaydi.
 */

const KEY = 'cron';
const DIGEST_HOUR = 9; // Toshkent vaqti bilan shu soatdan keyin, kuniga bir marta
type CronState = { digestDay?: string };

/** Toshkent (UTC+5, yozgi vaqt yo'q) bo'yicha sana va soat */
export function tashkentClock(now: Date): { day: string; hour: number } {
  const t = new Date(now.getTime() + 5 * 3_600_000);
  return { day: t.toISOString().slice(0, 10), hour: t.getUTCHours() };
}

export async function runTick(now = new Date()): Promise<{ digest: { finance: number; orders: number } | null }> {
  const { day, hour } = tashkentClock(now);
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const state = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}) as CronState;
  if (hour < DIGEST_HOUR || state.digestDay === day) return { digest: null };
  // Avval belgi qo'yiladi: eslatma yuborish yarmida uzilsa ham ertasi kungacha takrorlanmaydi (ikki marta yuborgandan ko'ra yaxshi)
  const value = { ...state, digestDay: day } as Prisma.InputJsonObject;
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return { digest: await sendDailyDigest(now) };
}
