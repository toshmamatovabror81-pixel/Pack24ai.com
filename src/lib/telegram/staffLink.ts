import 'server-only';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { can, type Section } from '@/lib/auth/permissions';
import { STAFF_ROLES, type Role } from '@/lib/auth/session';
import { normalizeContactPhone } from '@/lib/format';

/**
 * Xodimni boshqaruv botiga ulash. Xodim — admin paneldagi Xodimlar ro'yxatidagi faol foydalanuvchi (User, rol staff/manager/admin).
 * Ikki yo'l: (1) botda o'z telefonini ulashadi va u ro'yxatdagi telefon bilan bir xil bo'ladi; (2) admin Xodimlar sahifasida
 * bir martalik kod beradi (telefoni yo'q "admin" login uchun ham). Har bir bot so'rovida xodim qaytadan tekshiriladi:
 * admin panelda o'chirilgan yoki roli olingan xodim botdan ham darhol uziladi.
 */

const CODE_TTL_MS = 30 * 60_000;
const SELECT = { id: true, name: true, role: true, phone: true, telegramId: true, telegramNotify: true } as const;
export type StaffUser = { id: number; name: string; role: Role; phone: string; telegramId: string | null; telegramNotify: boolean };

const activeStaff = { role: { in: STAFF_ROLES }, isActive: true, deletedAt: null };

export async function staffByTelegram(telegramId: number | string): Promise<StaffUser | null> {
  return prisma.user.findFirst({ where: { telegramId: String(telegramId), ...activeStaff }, select: SELECT });
}

/** Shu Telegram hisobini xodimga biriktirish (ilgari boshqa foydalanuvchiga ulangan bo'lsa — o'sha uziladi) */
async function attach(userId: number, telegramId: string): Promise<StaffUser> {
  const [, user] = await prisma.$transaction([
    prisma.user.updateMany({ where: { telegramId, id: { not: userId } }, data: { telegramId: null, telegramVerifiedAt: null } }),
    prisma.user.update({ where: { id: userId }, data: { telegramId, telegramVerifiedAt: new Date(), telegramCode: null, otpExpiry: null, otpAttempts: 0 }, select: SELECT }),
  ]);
  return user;
}

export type LinkResult = { ok: true; user: StaffUser } | { ok: false; reason: 'not_found' | 'code' };

/** Telegram tasdiqlagan telefon (kontakt, to'liq xalqaro ko'rinishda) Xodimlar ro'yxatidagi telefon bilan bir xil bo'lsa ulaydi */
export async function linkStaffByPhone(telegramId: number | string, rawPhone: string): Promise<LinkResult> {
  const phone = normalizeContactPhone(rawPhone);
  if (!phone) return { ok: false, reason: 'not_found' };
  const user = await prisma.user.findFirst({ where: { phone, ...activeStaff }, select: { id: true } });
  if (!user) return { ok: false, reason: 'not_found' };
  return { ok: true, user: await attach(user.id, String(telegramId)) };
}

/** Admin bergan 6 xonali bir martalik kod (30 daqiqa amal qiladi) */
export async function linkStaffByCode(telegramId: number | string, rawCode: string): Promise<LinkResult> {
  const code = rawCode.replace(/\D/g, '');
  if (code.length !== 6) return { ok: false, reason: 'code' };
  const user = await prisma.user.findFirst({ where: { telegramCode: code, otpExpiry: { gt: new Date() }, ...activeStaff }, select: { id: true } });
  if (!user) return { ok: false, reason: 'code' };
  // Kod shartli yangilash bilan "sarflanadi": ikki Telegram hisobi bir vaqtda yuborsa ham faqat bittasi ulanadi
  const used = await prisma.user.updateMany({ where: { id: user.id, telegramCode: code }, data: { telegramCode: null, otpExpiry: null } });
  if (used.count !== 1) return { ok: false, reason: 'code' };
  return { ok: true, user: await attach(user.id, String(telegramId)) };
}

/** Admin panel: xodim uchun ulash kodi (boshqa xodimda bir xil faol kod bo'lmasligi tekshiriladi) */
export async function issueStaffCode(userId: number): Promise<{ code: string; expires: Date }> {
  const expires = new Date(Date.now() + CODE_TTL_MS);
  for (let i = 0; i < 5; i += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const clash = await prisma.user.findFirst({ where: { telegramCode: code, otpExpiry: { gt: new Date() }, id: { not: userId } }, select: { id: true } });
    if (clash) continue;
    await prisma.user.update({ where: { id: userId }, data: { telegramCode: code, otpExpiry: expires, otpAttempts: 0 } });
    return { code, expires };
  }
  throw new Error('Kod yaratib bo\'lmadi, qayta urinib ko\'ring');
}

export async function unlinkStaff(userId: number): Promise<void> {
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
  await prisma.user.update({ where: { id: userId }, data: { telegramId: null, telegramVerifiedAt: null, telegramCode: null, otpExpiry: null } });
  // Navbatda turgan xabarlar (mijoz ma'lumotli buyurtma kartalari) uzilgan xodimga keyinroq yetib bormasin
  if (before?.telegramId) await prisma.botOutbox.deleteMany({ where: { bot: 'staff', chatId: before.telegramId, sentAt: null, failedAt: null } }).catch((e) => console.error('[staffLink] navbatni tozalash', e));
}

export async function setStaffNotify(userId: number, on: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { telegramNotify: on } });
}

/** Shu bo'limga ruxsati bor, botga ulangan va xabarnomani o'chirmagan xodimlar */
export async function staffRecipients(section: Section): Promise<StaffUser[]> {
  const rows = await prisma.user.findMany({ where: { telegramId: { not: null }, telegramNotify: true, ...activeStaff }, select: SELECT });
  return rows.filter((u) => can(u.role, section));
}
