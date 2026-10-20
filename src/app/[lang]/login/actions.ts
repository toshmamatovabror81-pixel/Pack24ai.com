'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkPassword, endSession, hashPassword, startSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { rateLimit } from '@/lib/rateLimit';

export type AuthState = { error?: 'invalid' | 'exists' | 'mismatch' | 'short' | 'phone' | 'rate' | 'name' } | null;

const loc = (v: FormDataEntryValue | null) => (typeof v === 'string' && isLocale(v) ? v : 'uz');

export async function loginAction(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit('login', 10, 15 * 60_000))) return { error: 'rate' };
  const phone = normalizePhone(String(fd.get('phone') ?? ''));
  const password = String(fd.get('password') ?? '');
  if (!phone || !password) return { error: 'invalid' };
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive || user.deletedAt || !(await checkPassword(password, user.passwordHash))) return { error: 'invalid' };
  await startSession({ id: user.id, role: user.role, name: user.name });
  redirect(`/${loc(fd.get('locale'))}/profile`);
}

const registerSchema = z.object({ name: z.string().trim().min(2).max(100), password: z.string().min(8).max(200) });

export async function registerAction(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit('register', 5, 60 * 60_000))) return { error: 'rate' };
  const phone = normalizePhone(String(fd.get('phone') ?? ''));
  if (!phone) return { error: 'phone' };
  const password = String(fd.get('password') ?? '');
  if (password !== String(fd.get('password2') ?? '')) return { error: 'mismatch' };
  const parsed = registerSchema.safeParse({ name: fd.get('name'), password });
  if (!parsed.success) return { error: password.length < 8 ? 'short' : 'name' };
  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) return { error: 'exists' };
  const companyName = String(fd.get('company') ?? '').trim().slice(0, 150) || null;
  const user = await prisma.user.create({
    data: { name: parsed.data.name, phone, passwordHash: await hashPassword(password), role: 'user', companyName, customerType: companyName ? 'corporate' : 'individual' },
  });
  await startSession({ id: user.id, role: user.role, name: user.name });
  redirect(`/${loc(fd.get('locale'))}/profile`);
}

export async function logoutAction(fd: FormData) {
  await endSession();
  redirect(`/${loc(fd.get('locale'))}`);
}
