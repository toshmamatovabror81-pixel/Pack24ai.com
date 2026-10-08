import 'server-only';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, type Driver, type Supervisor, type TelegramHqAdmin } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/format';

type Tx = Prisma.TransactionClient;

/**
 * Masul, haydovchi va HQ admin yozuvlari: telefon formati, ro'yxatdan o'tish kodlari, parollar.
 * Telefon bazada faqat raqam ko'rinishida saqlanadi: 998901234567.
 */

/** Kiritilgan telefonni 998XXXXXXXXX ga keltiradi; noto'g'ri bo'lsa null */
export const phoneDigits = (input: string | null | undefined): string | null => (input ? normalizePhone(input) : null);

/** Eski bazada +998..., 0..., 9 xonali ko'rinishlar bo'lishi mumkin: qidiruvda hammasini sinab ko'ramiz */
export function phoneVariants(input: string): string[] {
  const d = phoneDigits(input);
  if (!d) return [];
  const last9 = d.slice(-9);
  return Array.from(new Set([d, `+${d}`, `0${last9}`, last9]));
}

export class StaffError extends Error {
  constructor(public code: 'phone' | 'name' | 'duplicate' | 'not_found' | 'inactive' | 'point', message: string) {
    super(message);
  }
}

/** 5 xonali, uchta jadvalda ham takrorlanmaydigan ro'yxatdan o'tish kodi */
export async function uniqueRegistrationCode(tx: Tx | typeof prisma = prisma): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = String(randomInt(10000, 100000));
    const [s, d, h] = await Promise.all([
      tx.supervisor.findUnique({ where: { registrationCode: code }, select: { id: true } }),
      tx.driver.findUnique({ where: { registrationCode: code }, select: { id: true } }),
      tx.telegramHqAdmin.findUnique({ where: { registrationCode: code }, select: { id: true } }),
    ]);
    if (!s && !d && !h) return code;
  }
  throw new Error("Ro'yxatdan o'tish kodi yaratib bo'lmadi");
}

// Parol belgilari: lotin harflar va raqamlar, 0/O, 1/l/I yo'q — telefonda adashmaslik uchun (bu sir emas, alifbo)
const PASSWORD_CHARS = ['ABCDEFGHJKMNPQRSTUVWXYZ', 'abcdefghjkmnpqrstuvwxyz', '23456789'].join('');
export function generatePassword(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  return out;
}

export const hashSecret = (plain: string) => bcrypt.hash(plain, 11);
export const checkSecret = (plain: string, hash: string | null | undefined) => (hash ? bcrypt.compare(plain, hash) : Promise.resolve(false));

function requireName(name: string): string {
  const n = name.trim().slice(0, 100);
  if (n.length < 2) throw new StaffError('name', "Ism kamida 2 ta harf bo'lsin");
  return n;
}
function requirePhone(phone: string): string {
  const d = phoneDigits(phone);
  if (!d) throw new StaffError('phone', "Telefon noto'g'ri. Namuna: +998 90 123 45 67");
  return d;
}

// ─── Masul ───────────────────────────────────────────────────────────────────

export async function findSupervisorByPhone(phone: string): Promise<Supervisor | null> {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;
  return prisma.supervisor.findFirst({ where: { phone: { in: variants } } });
}

export async function createSupervisor(input: { name: string; phone: string; pointId: number | null }): Promise<Supervisor> {
  const name = requireName(input.name);
  const phone = requirePhone(input.phone);
  if (await findSupervisorByPhone(phone)) throw new StaffError('duplicate', 'Bu telefon raqamli masul allaqachon bor');
  if (input.pointId && !(await prisma.recyclePoint.findUnique({ where: { id: input.pointId }, select: { id: true } }))) throw new StaffError('point', 'Punkt topilmadi');
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    return tx.supervisor.create({ data: { name, phone, pointId: input.pointId, registrationCode } });
  });
}

export async function updateSupervisor(id: number, patch: { name?: string; phone?: string; pointId?: number | null; isActive?: boolean }): Promise<Supervisor> {
  const data: Prisma.SupervisorUpdateInput = {};
  if (patch.name !== undefined) data.name = requireName(patch.name);
  if (patch.phone !== undefined) {
    const phone = requirePhone(patch.phone);
    const other = await findSupervisorByPhone(phone);
    if (other && other.id !== id) throw new StaffError('duplicate', 'Bu telefon boshqa masulda');
    data.phone = phone;
  }
  if (patch.pointId !== undefined) data.point = patch.pointId ? { connect: { id: patch.pointId } } : { disconnect: true };
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  return prisma.supervisor.update({ where: { id }, data });
}

/** Botdan chiqarish: Telegram bog'lanishini uzib, yangi kod beradi (qayta ro'yxatdan o'tishi uchun) */
export async function resetSupervisorTelegram(id: number): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    await tx.supervisor.update({ where: { id }, data: { telegramId: null, telegramName: null, registeredAt: null, registrationCode } });
    return registrationCode;
  });
}

// ─── Haydovchi ───────────────────────────────────────────────────────────────

export async function findDriverByPhone(phone: string): Promise<Driver | null> {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;
  return prisma.driver.findFirst({ where: { phone: { in: variants } } });
}

export async function createDriver(input: {
  name: string;
  phone: string;
  supervisorId?: number | null;
  pointId?: number | null;
  vehicleInfo?: string | null;
  invitedBySupervisorId?: number | null;
}): Promise<Driver> {
  const name = requireName(input.name);
  const phone = requirePhone(input.phone);
  if (await findDriverByPhone(phone)) throw new StaffError('duplicate', 'Bu telefon raqamli haydovchi allaqachon bor');
  let pointId = input.pointId ?? null;
  const supervisorId = input.supervisorId ?? null;
  if (supervisorId) {
    const sup = await prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { pointId: true } });
    if (!sup) throw new StaffError('not_found', 'Masul topilmadi');
    pointId = pointId ?? sup.pointId;
  }
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    return tx.driver.create({
      data: {
        name, phone, supervisorId, pointId, registrationCode,
        vehicleInfo: input.vehicleInfo?.trim().slice(0, 120) || null,
        invitedBySupervisorId: input.invitedBySupervisorId ?? null,
        invitedByPointId: input.invitedBySupervisorId ? pointId : null,
        invitedAt: input.invitedBySupervisorId ? new Date() : null,
      },
    });
  });
}

export async function updateDriver(
  id: number,
  patch: { name?: string; phone?: string; supervisorId?: number | null; pointId?: number | null; vehicleInfo?: string | null; status?: Driver['status'] },
): Promise<Driver> {
  const data: Prisma.DriverUpdateInput = {};
  if (patch.name !== undefined) data.name = requireName(patch.name);
  if (patch.phone !== undefined) {
    const phone = requirePhone(patch.phone);
    const other = await findDriverByPhone(phone);
    if (other && other.id !== id) throw new StaffError('duplicate', 'Bu telefon boshqa haydovchida');
    data.phone = phone;
  }
  if (patch.supervisorId !== undefined) data.supervisor = patch.supervisorId ? { connect: { id: patch.supervisorId } } : { disconnect: true };
  if (patch.pointId !== undefined) data.point = patch.pointId ? { connect: { id: patch.pointId } } : { disconnect: true };
  if (patch.vehicleInfo !== undefined) data.vehicleInfo = patch.vehicleInfo?.trim().slice(0, 120) || null;
  if (patch.status !== undefined) data.status = patch.status;
  return prisma.driver.update({ where: { id }, data });
}

/**
 * Haydovchi kabineti (/driver) uchun parol: faqat bir marta, hali parol bo'lmasa, yaratiladi va ochiq ko'rinishda qaytariladi.
 * Keyin faqat haydovchi boti orqali (Telegram egaligi tasdiqlangan holda) tiklanadi — resetDriverPassword.
 */
export async function issueDriverCredentials(driverId: number): Promise<string | null> {
  const d = await prisma.driver.findUnique({ where: { id: driverId }, select: { passwordHash: true } });
  if (!d || d.passwordHash) return null;
  const password = generatePassword();
  await prisma.driver.update({ where: { id: driverId }, data: { passwordHash: await hashSecret(password), passwordSetByBotAt: new Date() } });
  return password;
}

/** Yangi parol (haydovchi botidan, telegramId mos kelganda chaqiriladi) */
export async function resetDriverPassword(driverId: number, telegramId: string): Promise<string> {
  const d = await prisma.driver.findUnique({ where: { id: driverId }, select: { telegramId: true, status: true } });
  if (!d || d.telegramId !== telegramId) throw new StaffError('not_found', 'Haydovchi topilmadi');
  if (d.status === 'inactive') throw new StaffError('inactive', 'Haydovchi faol emas');
  const password = generatePassword();
  await prisma.driver.update({ where: { id: driverId }, data: { passwordHash: await hashSecret(password), passwordSetByBotAt: new Date() } });
  return password;
}

export async function resetDriverTelegram(id: number): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    await tx.driver.update({ where: { id }, data: { telegramId: null, telegramName: null, registeredAt: null, registrationCode, isOnline: false } });
    return registrationCode;
  });
}

// ─── HQ admin ────────────────────────────────────────────────────────────────

export async function findHqAdminByPhone(phone: string): Promise<TelegramHqAdmin | null> {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;
  return prisma.telegramHqAdmin.findFirst({ where: { phone: { in: variants } } });
}

export async function createHqAdmin(input: { name: string; phone: string }): Promise<TelegramHqAdmin> {
  const name = requireName(input.name);
  const phone = requirePhone(input.phone);
  if (await findHqAdminByPhone(phone)) throw new StaffError('duplicate', 'Bu telefon raqamli HQ admin allaqachon bor');
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    return tx.telegramHqAdmin.create({ data: { name, phone, registrationCode } });
  });
}

export async function resetHqAdminTelegram(id: number): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const registrationCode = await uniqueRegistrationCode(tx);
    await tx.telegramHqAdmin.update({ where: { id }, data: { telegramId: null, telegramName: null, registeredAt: null, registrationCode } });
    return registrationCode;
  });
}

// ─── Botda ro'yxatdan o'tish (kod + telefon mosligi) ─────────────────────────

export type RegisterResult =
  | { ok: true; role: 'supervisor'; supervisor: Supervisor }
  | { ok: true; role: 'driver'; driver: Driver }
  | { ok: true; role: 'hq'; admin: TelegramHqAdmin }
  | { ok: false; reason: 'code' | 'phone' | 'taken' | 'inactive' };

/**
 * Kod bo'yicha yozuvni topib, telefon mos kelsa Telegram'ni bog'laydi. Kod bir martalik: muvaffaqiyatdan so'ng o'chiriladi.
 * `role` berilsa faqat shu jadvalda qidiriladi (masul boti masul kodini, haydovchi boti haydovchi kodini qabul qiladi).
 */
export async function registerByCode(role: 'supervisor' | 'driver' | 'hq', code: string, phone: string, tg: { id: number | string; name?: string }): Promise<RegisterResult> {
  const c = code.replace(/\D/g, '');
  if (c.length !== 5) return { ok: false, reason: 'code' };
  const variants = phoneVariants(phone);
  if (!variants.length) return { ok: false, reason: 'phone' };
  const telegramId = String(tg.id);
  const telegramName = tg.name?.slice(0, 100) ?? null;
  const taken = async (where: 'supervisor' | 'driver' | 'hq', id: number) => {
    const t = where === 'supervisor'
      ? await prisma.supervisor.findUnique({ where: { telegramId }, select: { id: true } })
      : where === 'driver'
        ? await prisma.driver.findUnique({ where: { telegramId }, select: { id: true } })
        : await prisma.telegramHqAdmin.findUnique({ where: { telegramId }, select: { id: true } });
    return !!t && t.id !== id;
  };
  if (role === 'supervisor') {
    const s = await prisma.supervisor.findUnique({ where: { registrationCode: c } });
    if (!s) return { ok: false, reason: 'code' };
    if (!variants.includes(s.phone)) return { ok: false, reason: 'phone' };
    if (!s.isActive) return { ok: false, reason: 'inactive' };
    if (await taken('supervisor', s.id)) return { ok: false, reason: 'taken' };
    const supervisor = await prisma.supervisor.update({ where: { id: s.id }, data: { telegramId, telegramName, registeredAt: new Date(), registrationCode: null } });
    return { ok: true, role, supervisor };
  }
  if (role === 'driver') {
    const d = await prisma.driver.findUnique({ where: { registrationCode: c } });
    if (!d) return { ok: false, reason: 'code' };
    if (!variants.includes(d.phone)) return { ok: false, reason: 'phone' };
    if (d.status === 'inactive') return { ok: false, reason: 'inactive' };
    if (await taken('driver', d.id)) return { ok: false, reason: 'taken' };
    const driver = await prisma.driver.update({ where: { id: d.id }, data: { telegramId, telegramName, registeredAt: new Date(), registrationCode: null } });
    return { ok: true, role, driver };
  }
  const h = await prisma.telegramHqAdmin.findUnique({ where: { registrationCode: c } });
  if (!h) return { ok: false, reason: 'code' };
  if (!variants.includes(h.phone)) return { ok: false, reason: 'phone' };
  if (!h.isActive) return { ok: false, reason: 'inactive' };
  if (await taken('hq', h.id)) return { ok: false, reason: 'taken' };
  const admin = await prisma.telegramHqAdmin.update({ where: { id: h.id }, data: { telegramId, telegramName, registeredAt: new Date(), registrationCode: null, lastSeenAt: new Date() } });
  return { ok: true, role, admin };
}

/** Telegram ID bo'yicha faol masul / haydovchi / HQ admin */
export const supervisorByTelegram = (telegramId: number | string) =>
  prisma.supervisor.findFirst({ where: { telegramId: String(telegramId), isActive: true }, include: { point: true } });
export const driverByTelegram = (telegramId: number | string) =>
  prisma.driver.findFirst({ where: { telegramId: String(telegramId), status: { not: 'inactive' } }, include: { point: true, supervisor: true } });
export const hqAdminByTelegram = (telegramId: number | string) =>
  prisma.telegramHqAdmin.findFirst({ where: { telegramId: String(telegramId), isActive: true } });
