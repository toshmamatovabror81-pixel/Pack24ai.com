'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { text } from '@/lib/formData';
import { createHqAdmin, resetHqAdminTelegram, StaffError } from '@/lib/recycling/staff';
import { adminEvent } from '../events/audit';

/** HQ adminlar (HQ boti foydalanuvchilari): yaratish (kod), faol/nofaol, Telegramni uzish. Hodisalar «ko'rilgan» holatda yoziladi */

const BASE = '/admin/recycling/hq';

const idOf = (fd: FormData): number => {
  const n = Number(fd.get('id'));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

function errMsg(e: unknown): string {
  if (e instanceof StaffError) return e.message;
  console.error('[admin/hq]', e);
  return "Xato yuz berdi. Qayta urinib ko'ring";
}

export async function createHqAdminAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const name = text(fd, 'name', 100);
  const phone = text(fd, 'phone', 30);
  let to: string;
  try {
    const a = await createHqAdmin({ name, phone });
    await adminEvent({ eventType: 'hq_admin_created', title: `HQ admin yaratildi: ${a.name}`, message: `Admin: ${user.name}` });
    to = `${BASE}?created=${a.id}`;
  } catch (e) {
    // URL'ga faqat xato: ism/telefon (shaxsiy ma'lumot) server logi va brauzer tarixiga tushmasin
    to = `${BASE}?error=${encodeURIComponent(errMsg(e))}`;
  }
  revalidatePath(BASE);
  redirect(to);
}

export async function toggleHqAdminAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const id = idOf(fd);
  const isActive = fd.get('isActive') === 'true';
  let to = `${BASE}?saved=1`;
  try {
    if (!id) throw new StaffError('not_found', 'HQ admin topilmadi');
    const a = await prisma.telegramHqAdmin.update({ where: { id }, data: { isActive } });
    await adminEvent({ eventType: isActive ? 'hq_admin_activated' : 'hq_admin_deactivated', title: `HQ admin ${isActive ? 'faollashtirildi' : 'nofaol qilindi'}: ${a.name}`, message: `Admin: ${user.name}` });
  } catch (e) {
    to = `${BASE}?error=${encodeURIComponent(errMsg(e))}`;
  }
  revalidatePath(BASE);
  redirect(to);
}

export async function resetHqAdminTelegramAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const id = idOf(fd);
  let to: string;
  try {
    if (!id) throw new StaffError('not_found', 'HQ admin topilmadi');
    await resetHqAdminTelegram(id);
    const a = await prisma.telegramHqAdmin.findUnique({ where: { id }, select: { name: true } });
    await adminEvent({ eventType: 'hq_admin_telegram_reset', severity: 'warning', title: `HQ admin Telegram uzildi: ${a?.name ?? id}`, message: `Admin: ${user.name}` });
    to = `${BASE}?reset=${id}`;
  } catch (e) {
    to = `${BASE}?error=${encodeURIComponent(errMsg(e))}`;
  }
  revalidatePath(BASE);
  redirect(to);
}
