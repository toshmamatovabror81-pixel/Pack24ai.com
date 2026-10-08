'use server';

import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { checkPassword, hashPassword, startSession } from '@/lib/auth';
import { STAFF_ROLES } from '@/lib/auth/session';
import { normalizePhone } from '@/lib/format';
import { rateLimit } from '@/lib/rateLimit';

export type StaffLoginState = { error?: 'invalid' | 'rate' } | null;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Xodim kirishi: telefon yoki email + parol.
 * Bazada hali birorta admin bo'lmasa, Vercel'dagi ADMIN_USERNAME/ADMIN_PASSWORD bilan birinchi admin yaratiladi.
 */
export async function staffLogin(_: StaffLoginState, fd: FormData): Promise<StaffLoginState> {
  if (!(await rateLimit('staff-login', 8, 15 * 60_000))) return { error: 'rate' };
  const login = String(fd.get('login') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (!login || !password) return { error: 'invalid' };

  const phone = normalizePhone(login);
  let user = await prisma.user.findFirst({
    where: { role: { in: STAFF_ROLES }, isActive: true, deletedAt: null, OR: [{ phone: phone ?? login }, { email: login.toLowerCase() }] },
  });

  if (!user) {
    const envUser = process.env.ADMIN_USERNAME ?? '';
    const envPass = process.env.ADMIN_PASSWORD ?? '';
    const anyAdmin = await prisma.user.count({ where: { role: 'admin', deletedAt: null } });
    if (anyAdmin === 0 && envUser && envPass.length >= 8 && same(login, envUser) && same(password, envPass)) {
      user = await prisma.user.create({
        data: { name: 'Administrator', phone: `admin:${envUser}`, email: null, passwordHash: await hashPassword(envPass), role: 'admin' },
      });
      await startSession({ id: user.id, role: user.role, name: user.name });
      redirect('/admin/staff?first=1');
    }
    // Admin yaratilgandan keyin ham shu login bilan kirish mumkin
    if (envUser && same(login, envUser)) {
      user = await prisma.user.findFirst({ where: { phone: `admin:${envUser}`, isActive: true, deletedAt: null } });
    }
  }

  if (!user || !(await checkPassword(password, user.passwordHash))) return { error: 'invalid' };
  await startSession({ id: user.id, role: user.role, name: user.name });
  redirect('/admin');
}
