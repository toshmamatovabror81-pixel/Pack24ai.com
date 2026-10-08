'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, requireStaff } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { optText, text } from '@/lib/formData';

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
  revalidatePath('/admin/staff');
  redirect('/admin/staff?saved=1');
}
