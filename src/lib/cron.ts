import 'server-only';
import type { Prisma } from '@prisma/client';
import { dailyAudit } from './ai/audit';
import { settleWithin } from './background';
import { prisma } from './db';
import { sendDailyDigest } from './orderNotify';
import { flushOutbox, type FlushResult } from './telegram/outbox';
import { tashkentClock } from './tashkent';

/**
 * Davriy ishlar. Server cron'i (deploy/auto-update.sh, har 5 daqiqada) POST /api/cron/tick yuboradi; qaysi ish
 * qachon bajarilgani SiteSetting("cron") da saqlanadi, shuning uchun qayta ishga tushirish yoki takroriy tick zarar qilmaydi.
 */

const KEY = 'cron';
const DIGEST_HOUR = 9; // Toshkent vaqti bilan shu soatdan keyin, kuniga bir marta
const AUDIT_HOUR = 8; // kunlik tekshiruv ish kuni boshlanishidan oldin
const AUDIT_WAIT_MS = 25_000; // AI xulosasi uzoqroq cho'zilsa tick kutmaydi: tekshiruv fonda tugaydi (cron so'rovi 60 s da uziladi)
type CronState = { digestDay?: string; auditDay?: string };
/** audit: natija; 'running' — 25 s da tugamadi, fonda davom etyapti; 'failed' — xato bilan tugadi (sababi logda), bugun takrorlanmaydi */
type TickResult = { digest: { finance: number; orders: number } | null; audit: { findings: number; sent: number; ai: boolean } | 'running' | 'failed' | null; outbox: FlushResult | null };

// Vaqt hisobi alohida modulda (AI bo'limi ham ishlatadi); eski import joylari uchun shu yerdan ham eksport qilinadi
export { tashkentClock } from './tashkent';

export async function runTick(now = new Date()): Promise<TickResult> {
  const { day, hour } = tashkentClock(now);
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const state = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}) as CronState;
  const auditDue = hour >= AUDIT_HOUR && state.auditDay !== day;
  const digestDue = hour >= DIGEST_HOUR && state.digestDay !== day;
  // Har signalda: yuborilmay qolgan bot xabarlari qayta yuboriladi; xatosi (null) kunlik ishlarni to'xtatmaydi. Ikkala kunlik ish
  // bitta signalga tushgan kamdan-kam holda navbat shu safar yuborilmaydi (null): Telegram javob bermayotgan bo'lsa navbat (25 s gacha) +
  // tekshiruv (25 s) + eslatma birga cron so'rovining 60 s chegarasidan oshardi — 5 daqiqadan keyingi signal yuboradi
  const outbox = auditDue && digestDue ? null : await flushOutbox(now).catch((e) => {
    console.error('[cron] xabarlar navbati', e);
    return null;
  });
  if (!auditDue && !digestDue) return { digest: null, audit: null, outbox };
  // Avval belgi qo'yiladi: ish yarmida uzilsa ham ertasi kungacha takrorlanmaydi (ikki marta yuborgandan ko'ra yaxshi)
  const value = { ...state, ...(auditDue ? { auditDay: day } : {}), ...(digestDue ? { digestDay: day } : {}) } as Prisma.InputJsonObject;
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  // Tekshiruv xatosi eslatmani to'xtatmaydi va "davom etyapti" bo'lib ko'rinmaydi
  const runAudit = () => dailyAudit(now).catch((e) => {
    console.error('[cron] kunlik tekshiruv', e);
    return 'failed' as const;
  });
  const audit = auditDue ? ((await settleWithin(runAudit(), AUDIT_WAIT_MS)) ?? 'running') : null;
  return { digest: digestDue ? await sendDailyDigest(now) : null, audit, outbox };
}
