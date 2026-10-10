'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, requireStaff } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { optText, text } from '@/lib/formData';
import { botToken } from '@/lib/telegram/bots';
import { issueStaffCode, setStaffNotify, unlinkStaff } from '@/lib/telegram/staffLink';

const ROLES: UserRole[] = ['staff', 'manager', 'admin'];

export async function createStaff(fd: FormData) {
  await requireStaff('staff');
  const phone = normalizePhone(text(fd, 'phone', 30));
  const name = text(fd, 'name', 100);
  const password = String(fd.get('password') ?? '');
  const role = ROLES.find((r) => r === fd.get('role')) ?? 'staff';
  if (!phone || name.length < 2) redirect('/admin/staff?error=fields');
  if (password.length < 10) redirect('/admin/staff?error=password');
  const email = optText(fd, 'email', 120)?.toLowerCase() ?? null;
  const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
  if (existing && existing.role !== 'user') redirect('/admin/staff?error=exists');
  const passwordHash = await hashPassword(password);
  if (existing) {
    // Mijoz akkauntini xodimga aylantirish
    await prisma.user.update({ where: { id: existing.id }, data: { role, name, passwordHash, isActive: true, deletedAt: null, ...(email ? { email } : {}) } });
  } else {
    await prisma.user.create({ data: { name, phone, email, passwordHash, role, position: optText(fd, 'position', 100) } });
  }
  revalidatePath('/admin/staff');
  redirect('/admin/staff?saved=1');
}

export async function updateStaff(fd: FormData) {
  const me = await requireStaff('staff');
  const id = Number(fd.get('id'));
  const role = ROLES.find((r) => r === fd.get('role'));
  const isActive = fd.get('isActive') === 'on';
  const password = String(fd.get('password') ?? '');
  if (id === me.id && (!isActive || role !== 'admin')) redirect('/admin/staff?error=self');
  if (password && password.length < 10) redirect('/admin/staff?error=password');
  await prisma.user.update({
    where: { id },
    data: { ...(role ? { role } : {}), isActive, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
  });
  // Boshqaruv botidan xabarnoma olish (yangi buyurtma, to'lov, kunlik eslatma); bot ulanmagan bo'lsa ulangach kuchga kiradi
  await setStaffNotify(id, fd.get('telegramNotify') === 'on');
  revalidatePath('/admin/staff');
  redirect('/admin/staff?saved=1');
}

/** Telegram amallari faqat Xodimlar ro'yxatidagi yozuvga (mijoz akkauntiga kod berib yoki uni uzib bo'lmaydi) */
async function staffRow(fd: FormData) {
  const id = Number(fd.get('id'));
  const row = Number.isSafeInteger(id) ? await prisma.user.findFirst({ where: { id, role: { in: ROLES }, deletedAt: null }, select: { id: true, isActive: true } }) : null;
  if (!row) redirect('/admin/staff');
  return row;
}

/**
 * "Telegram kodi": xodimni boshqaruv botiga ulash uchun bir martalik 6 xonali kod (30 daqiqa). Kod faqat shu yo'naltirishdagi
 * xabarda bir marta ko'rsatiladi — admin uni xodimga o'zi aytadi; bazada faqat tekshirish uchun turadi.
 */
export async function issueTelegramCode(fd: FormData) {
  await requireStaff('staff');
  const row = await staffRow(fd);
  // Boshqaruv boti tokeni kiritilmaguncha kodni qabul qiladigan bot yo'q (sahifada tugma ham yashirilgan) — befoyda kod chiqarmaymiz
  if (!botToken('staff')) redirect('/admin/staff?error=tgNoBot');
  // Faol bo'lmagan xodimni bot baribir ulamaydi — befoyda kod chiqarmaymiz
  if (!row.isActive) redirect('/admin/staff?error=tgInactive');
  const issued = await issueStaffCode(row.id).catch((e) => {
    console.error('issueStaffCode', row.id, e);
    return null;
  });
  if (!issued) redirect('/admin/staff?error=tgCode');
  redirect(`/admin/staff?code=${issued.code}&for=${row.id}`);
}

/** "Uzish": xodimning Telegram hisobi botdan uziladi (bot keyingi so'rovdayoq tanimaydi), berilgan kod ham bekor bo'ladi */
export async function unlinkTelegram(fd: FormData) {
  await requireStaff('staff');
  const row = await staffRow(fd);
  await unlinkStaff(row.id);
  revalidatePath('/admin/staff');
  redirect('/admin/staff?saved=1');
}
