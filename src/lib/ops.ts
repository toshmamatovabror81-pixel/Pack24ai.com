import 'server-only';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * Server holati. deploy/watchdog.sh har 5 daqiqada serverning o'zidan ko'rinadigan faktlarni yuboradi (disk, oxirgi zaxira
 * nusxa yoshi, tiklash sinovi, sertifikat muddati, saytning internetdan ochilishi, davriy signal) — ilova ichidan bularni
 * bilib bo'lmaydi. Oxirgi holat SiteSetting("ops") da turadi: Admin > AI tekshiruv sahifasi va kunlik tekshiruv shundan o'qiydi.
 */

const KEY = 'ops';
/** Shu vaqtdan eski holat "kuzatuv signali kelmayapti" deb hisoblanadi (signal har 5 daqiqada keladi; yangilanish paytida 10 daqiqagacha kechikishi mumkin) */
export const OPS_STALE_MS = 30 * 60_000;

/** -1 — aniqlab bo'lmadi / hali yo'q (watchdog.sh shunday yuboradi) */
export const OPS_FACTS = z.object({
  disk: z.number().int().min(-1).max(100), // ildiz bo'lim, band foiz
  backupAgeH: z.number().int().min(-1).max(100_000), // oxirgi kunlik baza nusxasi necha soat oldin olingan
  restoreOk: z.number().int().min(-1).max(1), // zaxirani sinov tariqasida tiklash: 1 o'tdi, 0 o'tmadi
  offsiteOk: z.number().int().min(-1).max(1).default(-1), // serverdan tashqaridagi nusxa: -1 yoqilmagan, 1 yuborilgan, 0 yuborilmagan
  certDays: z.number().int().min(-1).max(10_000), // HTTPS sertifikat tugashiga necha kun qoldi
  siteOk: z.number().int().min(0).max(1), // sayt internetdan (domen orqali) ochilyaptimi
  tickOk: z.number().int().min(0).max(1), // davriy ishlar signali o'tyaptimi
});
export type OpsFacts = z.infer<typeof OPS_FACTS>;
export type OpsState = OpsFacts & { at: string };

export async function saveOps(facts: OpsFacts, now = new Date()): Promise<void> {
  const value = { ...facts, at: now.toISOString() } as Prisma.InputJsonObject;
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Oxirgi holat (hali kelmagan yoki shakli buzilgan bo'lsa null) va u eskirganmi */
export async function readOps(now = new Date()): Promise<{ state: OpsState; stale: boolean } | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const facts = OPS_FACTS.safeParse(value);
  const at = typeof value.at === 'string' ? new Date(value.at) : null;
  if (!facts.success || !at || Number.isNaN(at.getTime())) return null;
  return { state: { ...facts.data, at: at.toISOString() }, stale: now.getTime() - at.getTime() > OPS_STALE_MS };
}

/**
 * Server nosozligi haqidagi xabarlarni oladiganlar: boshqaruv botiga ulangan faol administratorlar. Xabarnoma sozlamasi
 * (telegramNotify) bu yerda hisobga olinmaydi — sayt ishlamay qolgani kundalik xabar emas. watchdog.sh bu ro'yxatni
 * serverda saqlab qo'yadi va sayt ishlamay qolganda Telegram'ga to'g'ridan-to'g'ri shu chatlarga yozadi.
 */
export async function alertChats(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: 'admin', isActive: true, deletedAt: null, telegramId: { not: null } }, select: { telegramId: true }, orderBy: { id: 'asc' }, take: 10 });
  return rows.map((r) => r.telegramId).filter((id): id is string => !!id && /^-?\d{4,20}$/.test(id));
}
